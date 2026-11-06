import { afterEach, describe, expect, it, vi } from 'vitest';
import { getContentPack } from '../src/content/index.js';
import type { Attempt, Scenario, Turn } from '../src/core/types.js';
import { AnthropicClient } from '../src/llm/anthropic.js';
import { createLlmClient, readLlmEnv } from '../src/llm/index.js';
import { MockClient } from '../src/llm/mock/index.js';
import { mockStudentTurn, teacherHandled } from '../src/llm/mock/student.js';
import { OpenAICompatClient } from '../src/llm/openai.js';
import { extractJsonObject, parseScorerResponse, parseStudentTurn } from '../src/llm/parsing.js';
import { buildScorerPrompt, buildStudentPrompt } from '../src/llm/prompts.js';
import type { LlmEnv } from '../src/llm/types.js';

const pack = await getContentPack();
const rubric = pack.rubric;
const scenario = pack.scenarios.find((s) => s.studentPersona.misconception)!;

function attempt(turns: Turn[]): Attempt {
  return {
    id: 'a_test_00000000000000000000000000000002',
    teacherId: 't_test_00000000000000000000000000000002',
    scenarioId: scenario.id,
    scenarioVersion: scenario.version,
    rubricId: rubric.id,
    rubricVersion: rubric.version,
    turns,
    mode: 'online',
    clientCreatedAt: '2026-11-01T00:00:00.000Z',
    heardCorrectly: true,
  };
}

const goodTeacherTurn: Turn[] = [
  { role: 'student', text: scenario.studentPersona.opening.hi, ts: 0 },
  {
    role: 'teacher',
    text: 'पहले बताओ तुमने कैसे सोचा? जैसे गोली से एक-एक करके देखें।',
    ts: 1,
    transport: 'voice',
  },
];

describe('mock student (deterministic roleplay)', () => {
  it('always opens with the authored persona line', () => {
    const plan = mockStudentTurn(scenario, [], 'hi');
    expect(plan.text).toBe(scenario.studentPersona.opening.hi);
    expect(plan.done).toBe(false);
  });

  it('escalates when the teacher has not explored the child’s thinking', () => {
    const plan = mockStudentTurn(
      scenario,
      [{ role: 'student', text: scenario.studentPersona.opening.hi, ts: 0 },
       { role: 'teacher', text: 'नहीं, ऐसा नहीं होता।', ts: 1 }],
      'hi',
    );
    expect(plan.done).toBe(false);
    const resistance = scenario.studentPersona.misconception!.resistance.map((r) => r.hi);
    expect(resistance).toContain(plan.text);
  });

  it('concedes once the teacher asks and gives substance', () => {
    const plan = mockStudentTurn(scenario, goodTeacherTurn, 'hi');
    expect(plan.done).toBe(true);
    expect(plan.text).toBe(scenario.studentPersona.misconception!.concession.hi);
  });

  it('detects handled turns from scenario markers only', () => {
    const handled = teacherHandled(scenario, goodTeacherTurn);
    expect(handled.handled).toBe(true);
    expect(handled.signals.question).toBe(true);
    expect(handled.signals.surfaced).toBe(true);
  });

  it('is deterministic for identical transcripts', () => {
    expect(mockStudentTurn(scenario, goodTeacherTurn, 'hi')).toEqual(
      mockStudentTurn(scenario, goodTeacherTurn, 'hi'),
    );
  });
});

describe('persona isolation in prompts', () => {
  const studentPrompt = buildStudentPrompt({ scenario, turns: [], lang: 'hi' });
  const scorerPrompt = buildScorerPrompt({
    scenario,
    attempt: attempt(goodTeacherTurn),
    rubric,
  });

  const studentText = [studentPrompt.system, ...studentPrompt.messages.map((m) => m.content)].join('\n');
  const scorerText = [scorerPrompt.system, ...scorerPrompt.messages.map((m) => m.content)].join('\n');

  it('never leaks the rubric, weights or scoring bands into the student prompt', () => {
    expect(studentText).not.toMatch(/rubric/i);
    expect(studentText).not.toMatch(/competenc/i);
    expect(studentText).not.toMatch(/passThreshold|competencyFloor|pass bar|0\.72/i);
    expect(studentText).not.toContain(rubric.id);
  });

  it('never leaks the student’s resistance ladder or concession into the scorer prompt', () => {
    const hidden = [
      ...scenario.studentPersona.misconception!.resistance.map((r) => r.en),
      scenario.studentPersona.misconception!.concession.en,
    ];
    for (const line of hidden) {
      expect(scorerText).not.toContain(line);
    }
  });

  it('keeps the student inside authored bounds', () => {
    expect(studentText).toContain(scenario.studentPersona.name);
    expect(studentText).toContain(String(scenario.studentPersona.age));
    expect(studentText).toContain(scenario.studentPersona.bounds.allowedTopics[0]!);
    expect(studentText).toContain(String(scenario.studentPersona.bounds.maxStudentTurns));
  });

  it('gives the scorer the rubric, indicators and cite-or-abstain rule', () => {
    expect(scorerText).toContain(rubric.id);
    expect(scorerText).toContain(rubric.competencies[0]!.indicators[0]!.en);
    expect(scorerText).toMatch(/verbatim/i);
    expect(scorerText).toMatch(/abstained/i);
    expect(scorerText).toContain('TEACHER:');
  });
});

describe('model output parsing (untrusted input)', () => {
  it('extracts JSON from fenced responses', () => {
    expect(extractJsonObject('```json\n{"text":"hi","done":false}\n```')).toEqual({
      text: 'hi',
      done: false,
    });
  });

  it('rejects non-JSON noise instead of guessing', () => {
    expect(() => extractJsonObject('I cannot help with that.')).toThrow(/JSON/);
  });

  it('parses a valid student reply and defaults done to false', () => {
    expect(parseStudentTurn('{"text":"  अच्छा!  "}')).toEqual({ text: 'अच्छा!', done: false });
  });

  it('accepts a plain-text student reply but never ends the roleplay by accident', () => {
    const parsed = parseStudentTurn('Student: पर मैंने तो ऐसे सीखा था!');
    expect(parsed.text).toContain('पर मैंने');
    expect(parsed.done).toBe(false);
  });

  it('drops unknown or duplicate competencies from a scorer reply', () => {
    const parsed = parseScorerResponse(
      JSON.stringify({
        competencyScores: [
          { competency: 'accuracy', score: 0.8, confidence: 0.9, evidence: [{ quote: 'x', turnIndex: 1 }] },
          { competency: 'accuracy', score: 0.2, confidence: 0.2, evidence: [] },
          { competency: 'creativity', score: 0.9, confidence: 0.9, evidence: [] },
        ],
        summary: { en: 's', hi: 'स' },
        suggestion: { en: 'g', hi: 'सु' },
        overallConfidence: 0.8,
      }),
      scenario.competencies,
    );
    expect(parsed.competencyScores).toHaveLength(1);
    expect(parsed.competencyScores[0]!.competency).toBe('accuracy');
  });

  it('rejects a scorer reply with no valid competencies', () => {
    expect(() =>
      parseScorerResponse('{"competencyScores":[{"competency":"creativity","score":1}]}', ['accuracy']),
    ).toThrow(/no valid competencies/i);
  });
});

describe('provider selection and fallback', () => {
  const baseEnv: LlmEnv = {
    provider: 'mock',
    timeoutMs: 1000,
    fallbackToMock: true,
  };

  it('defaults to the deterministic engine with no keys', () => {
    const runtime = createLlmClient(baseEnv);
    expect(runtime.engine).toBe('mock');
    expect(runtime.mode).toBe('mock');
  });

  it('maps provider aliases from the environment', () => {
    expect(readLlmEnv({ LLM_PROVIDER: 'openai-compat' }).provider).toBe('openai');
    expect(readLlmEnv({ LLM_PROVIDER: 'MOCK' }).provider).toBe('mock');
    expect(readLlmEnv({ LLM_PROVIDER: 'nonsense' }).provider).toBe('auto');
    expect(readLlmEnv({ LLM_FALLBACK_TO_MOCK: 'false' }).fallbackToMock).toBe(false);
  });

  it('falls back to the deterministic engine when the cloud call fails', async () => {
    const runtime = createLlmClient({
      provider: 'openai',
      openaiApiKey: 'test-key',
      openaiBaseUrl: 'http://127.0.0.1:9',
      timeoutMs: 60,
      fallbackToMock: true,
    });
    expect(runtime.engine).toBe('openai-compat');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const score = await runtime.client.scoreAttempt({
      scenario,
      attempt: attempt(goodTeacherTurn),
      rubric,
    });
    expect(score.engine).toBe('mock');
    expect(score.competencyScores.length).toBeGreaterThan(0);
    warn.mockRestore();
  });

  it('mock client implements the same contract as the adapters', async () => {
    const client = new MockClient();
    const reply = await client.studentTurn({ scenario, turns: [], lang: 'hi' });
    expect(reply.text).toBe(scenario.studentPersona.opening.hi);
    const score = await client.scoreAttempt({ scenario, attempt: attempt(goodTeacherTurn), rubric });
    expect(score.engine).toBe('mock');
    expect(score.rubricVersion).toBe(rubric.version);
  });
});

describe('OpenAI-compatible adapter', () => {
  afterEach(() => vi.unstubAllGlobals());

  const validScorerBody = {
    competencyScores: scenario.competencies.map((id) => ({
      competency: id,
      score: 0.8,
      confidence: 0.8,
      evidence: [{ quote: 'पहले बताओ तुमने कैसे सोचा?', turnIndex: 1 }],
    })),
    summary: { en: 'Clear question.', hi: 'स्पष्ट प्रश्न।' },
    suggestion: { en: 'Add an example.', hi: 'उदाहरण जोड़ें।' },
    overallConfidence: 0.8,
  };

  it('sends the system prompt, JSON mode and parses the score', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(validScorerBody) } }] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const client = new OpenAICompatClient({ apiKey: 'sk-test', model: 'test-model' });
    const score = await client.scoreAttempt({
      scenario,
      attempt: attempt(goodTeacherTurn),
      rubric,
    });

    expect(score.engine).toBe('openai-compat');
    expect(score.competencyScores).toHaveLength(scenario.competencies.length);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.openai.com/v1/chat/completions');
    const body = JSON.parse(String(init.body)) as {
      model: string;
      response_format: { type: string };
      messages: { role: string; content: string }[];
    };
    expect(body.model).toBe('test-model');
    expect(body.response_format.type).toBe('json_object');
    expect(body.messages[0]!.role).toBe('system');
    expect(body.messages[0]!.content).toMatch(/expert Indian primary-school teacher educator/i);
    expect((init.headers as Record<string, string>).authorization).toBe('Bearer sk-test');
  });

  it('retries once on a 5xx and then succeeds', async () => {
    let calls = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        calls++;
        if (calls === 1) return new Response('busy', { status: 503 });
        return new Response(
          JSON.stringify({ choices: [{ message: { content: JSON.stringify(validScorerBody) } }] }),
          { status: 200 },
        );
      }),
    );
    const client = new OpenAICompatClient({ apiKey: 'sk-test', timeoutMs: 1000 });
    const score = await client.scoreAttempt({ scenario, attempt: attempt(goodTeacherTurn), rubric });
    expect(calls).toBe(2);
    expect(score.engine).toBe('openai-compat');
  });

  it('surfaces HTTP failures instead of inventing a grade', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('unauthorized', { status: 401 })));
    const client = new OpenAICompatClient({ apiKey: 'bad', timeoutMs: 1000 });
    await expect(
      client.scoreAttempt({ scenario, attempt: attempt(goodTeacherTurn), rubric }),
    ).rejects.toThrow(/401/);
  });
});

describe('Anthropic adapter', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('uses the Messages API with a separate system prompt', async () => {
    const body = {
      competencyScores: scenario.competencies.map((id) => ({
        competency: id,
        score: 0.7,
        confidence: 0.75,
        evidence: [{ quote: 'जैसे गोली से एक-एक करके देखें।', turnIndex: 1 }],
      })),
      summary: { en: 'ok', hi: 'ठीक' },
      suggestion: { en: 'more', hi: 'और' },
      overallConfidence: 0.75,
    };
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ content: [{ type: 'text', text: JSON.stringify(body) }] }), {
        status: 200,
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const client = new AnthropicClient({ apiKey: 'ant-test', model: 'claude-test' });
    const score = await client.scoreAttempt({ scenario, attempt: attempt(goodTeacherTurn), rubric });

    expect(score.engine).toBe('anthropic');
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.anthropic.com/v1/messages');
    const headers = init.headers as Record<string, string>;
    expect(headers['x-api-key']).toBe('ant-test');
    expect(headers['anthropic-version']).toBe('2023-06-01');
    const requestBody = JSON.parse(String(init.body)) as {
      system: string;
      messages: { role: string }[];
    };
    expect(requestBody.system).toMatch(/rubric/i);
    expect(requestBody.messages.every((m) => m.role !== 'system')).toBe(true);
  });
});
