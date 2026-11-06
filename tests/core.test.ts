import { describe, expect, it } from 'vitest';
import { getContentPack } from '../src/content/index.js';
import type {
  Attempt,
  CompetencyId,
  CompetencyScore,
  Rubric,
  Scenario,
  ScorerOutput,
  TeacherState,
  Turn,
} from '../src/core/types.js';
import {
  firstSentenceWith,
  normalizeForMatch,
  quoteInTranscript,
  verifyEvidence,
} from '../src/core/evidence.js';
import { clamp01, evaluateAttempt, normalizeScorerOutput, scoreBand } from '../src/core/scoring.js';
import {
  applyAttempt,
  applyLevelUp,
  checkLevelUp,
  emptyTeacherState,
  levelProgress,
  weakestCompetency,
} from '../src/core/progression.js';
import {
  levelCatalog,
  scenariosForProfile,
  selectNextScenario,
  selectRetryScenario,
} from '../src/core/selection.js';

const pack = await getContentPack();
const rubric = pack.rubric;

function scenarioWith(level: 1 | 2 | 3 | 4 | 5, competencies: CompetencyId[]): Scenario {
  return (
    pack.scenarios.find(
      (s) =>
        s.level === level &&
        s.curriculum.class === 3 &&
        s.curriculum.subject === 'maths' &&
        s.competencies.join(',') === competencies.join(','),
    ) ??
    pack.scenarios.find(
      (s) => s.level === level && s.competencies.join(',') === competencies.join(','),
    )!
  );
}

function turnsOf(...texts: string[]): Turn[] {
  return texts.map((text, i) => ({
    role: i % 2 === 0 ? 'student' : 'teacher',
    text,
    ts: i,
  }));
}

function teacherTurns(...texts: string[]): Turn[] {
  return texts.flatMap<Turn>((text, i) => [
    { role: 'teacher', text, ts: i * 2 },
    { role: 'student', text: '...', ts: i * 2 + 1 },
  ]);
}

function attemptFor(scenario: Scenario, turns: Turn[]): Attempt {
  return {
    id: 'a_test_00000000000000000000000000000001',
    teacherId: 't_test_00000000000000000000000000000001',
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

function competencyScore(
  competency: CompetencyId,
  score: number,
  confidence: number,
  quotes: string[] = [],
): CompetencyScore {
  return {
    competency,
    score,
    confidence,
    abstained: false,
    evidence: quotes.map((quote, i) => ({ quote, turnIndex: i * 2, verified: false })),
  };
}

function scorerOutput(
  attempt: Attempt,
  scores: CompetencyScore[],
  overallConfidence = 0.9,
): ScorerOutput {
  return {
    attemptId: attempt.id,
    competencyScores: scores,
    summary: { en: 'summary', hi: 'सार' },
    suggestion: { en: 'suggestion', hi: 'सुझाव' },
    overallConfidence,
    engine: 'mock',
    rubricVersion: rubric.version,
    scoredAt: '2026-11-01T00:00:00.000Z',
  };
}

function attemptRecord(scenario: Scenario, decision: 'pass' | 'retry' = 'pass') {
  const attempt = attemptFor(scenario, teacherTurns('तुमने कैसे सोचा? जैसे गोली से दिखाऊँ।'));
  return {
    attempt,
    score: scorerOutput(attempt, [
      competencyScore('accuracy', 0.9, 0.9, ['जैसे गोली से दिखाऊँ।']),
      competencyScore('clarity', 0.9, 0.9, ['जैसे गोली से दिखाऊँ।']),
    ]),
    decision: {
      status: decision,
      weighted: 0.9,
      level: scenario.level,
      rationale: { en: 'ok', hi: 'ठीक' },
      rubricVersion: rubric.version,
      weightsHash: rubric.hash ?? '',
      computedAt: '2026-11-01T00:00:00.000Z',
    },
    verified: true,
  };
}

function passRecord(state: TeacherState, scenario: Scenario, decision: 'pass' | 'retry' = 'pass') {
  return applyAttempt(state, attemptRecord(scenario, decision), scenario.level, '2026-11-01T00:00:00.000Z');
}

describe('evidence verification (anti-hallucination)', () => {
  it('normalizes unicode, quotes and whitespace', () => {
    expect(normalizeForMatch('  “अच्छा”\n  सवाल?  ')).toBe('"अच्छा" सवाल?');
  });

  it('finds a long verbatim quote only in teacher turns', () => {
    const turns = turnsOf(
      'मैडम, 5 में से 3 घटाओ तो?',
      'पहले बताओ तुमने कैसे सोचा, फिर मिलकर देखें।',
    );
    expect(quoteInTranscript('तुमने कैसे सोचा', turns)).toBe(true);
    expect(quoteInTranscript('मैडम, 5 में से 3 घटाओ', turns)).toBe(false);
  });

  it('requires short numeric evidence to be a whole token', () => {
    const turns = teacherTurns('जवाब 73 है।');
    expect(quoteInTranscript('73', turns)).toBe(true);
    expect(quoteInTranscript('7', turns)).toBe(false);
    expect(quoteInTranscript('3', turns)).toBe(false);
  });

  it('rejects one-character quotes outright', () => {
    expect(quoteInTranscript('अ', teacherTurns('अ आ इ'))).toBe(false);
  });

  it('marks each item and lowers confidence for fabricated quotes', () => {
    const evidence = [
      { quote: 'सही जवाब 73 है', turnIndex: 0, verified: false },
      { quote: 'यह जवाब कभी नहीं कहा गया', turnIndex: 2, verified: false },
    ];
    const { verifiedFactor, verifiedCount } = verifyEvidence(
      evidence,
      teacherTurns('तो सही जवाब 73 है।', 'अब तुम करो।'),
    );
    expect(verifiedCount).toBe(1);
    expect(verifiedFactor).toBeCloseTo(0.5, 5);
    expect(evidence[0]!.verified).toBe(true);
    expect(evidence[1]!.verified).toBe(false);
  });

  it('finds the first sentence containing a marker', () => {
    const hit = firstSentenceWith(
      teacherTurns('ठीक है। तुमने कैसे सोचा? जैसे गोली से देखो।'),
      ['कैसे सोचा'],
    );
    expect(hit?.quote).toBe('तुमने कैसे सोचा?');
  });
});

describe('deterministic decision engine', () => {
  const scenario = scenarioWith(1, ['accuracy', 'clarity']);
  const turns = teacherTurns('सही जवाब 73 है। जैसे गोली से दिखाऊँ।');

  it('passes a strong, fully-evidenced attempt', () => {
    const attempt = attemptFor(scenario, turns);
    const score = scorerOutput(attempt, [
      competencyScore('accuracy', 0.9, 0.9, ['सही जवाब 73 है।']),
      competencyScore('clarity', 0.85, 0.85, ['जैसे गोली से दिखाऊँ।']),
    ]);
    const decision = evaluateAttempt({
      score,
      attempt,
      rubric,
      level: scenario.level,
      requiredCompetencies: scenario.competencies,
      computedAt: '2026-11-01T00:00:00.000Z',
    });
    expect(decision.status).toBe('pass');
    expect(decision.weighted).toBeGreaterThanOrEqual(rubric.decision.passThreshold);
    expect(score.competencyScores.every((c) => c.evidence.every((e) => e.verified))).toBe(true);
  });

  it('is deterministic across repeated evaluation', () => {
    const build = () => {
      const attempt = attemptFor(scenario, turns);
      const score = scorerOutput(attempt, [
        competencyScore('accuracy', 0.9, 0.9, ['सही जवाब 73 है।']),
        competencyScore('clarity', 0.8, 0.8, ['जैसे गोली से दिखाऊँ।']),
      ]);
      return evaluateAttempt({
        score,
        attempt,
        rubric,
        level: scenario.level,
        requiredCompetencies: scenario.competencies,
        computedAt: '2026-11-01T00:00:00.000Z',
      });
    };
    expect(build()).toEqual(build());
  });

  it('refuses to pass when a critical competency is below the floor', () => {
    // Level 5 weights every competency equally, so the overall score can clear
    // the pass bar while a critical skill is still below the floor.
    const integrated = pack.scenarios.find((s) => s.level === 5 && s.competencies.length === 4)!;
    const attempt = attemptFor(integrated, turns);
    const quote = 'सही जवाब 73 है। जैसे गोली से दिखाऊँ।';
    const score = scorerOutput(attempt, [
      competencyScore('accuracy', 0.2, 0.9, [quote]),
      competencyScore('clarity', 0.95, 0.9, [quote]),
      competencyScore('questioning', 0.95, 0.9, [quote]),
      competencyScore('misconceptions', 0.95, 0.9, [quote]),
    ]);
    const decision = evaluateAttempt({
      score,
      attempt,
      rubric,
      level: integrated.level,
      requiredCompetencies: integrated.competencies,
      computedAt: '2026-11-01T00:00:00.000Z',
    });
    expect(decision.status).not.toBe('pass');
    expect(decision.status).toBe('retry');
    expect(decision.weighted).toBeGreaterThanOrEqual(rubric.decision.passThreshold);
    expect(decision.rationale.en).toContain('accuracy');
  });

  it('abstains and goes provisional when every quote is fabricated', () => {
    const attempt = attemptFor(scenario, turns);
    const score = scorerOutput(attempt, [
      competencyScore('accuracy', 0.95, 0.95, ['कभी नहीं कहा गया यह वाक्य']),
      competencyScore('clarity', 0.95, 0.95, ['यह भी नहीं कहा गया']),
    ]);
    const decision = evaluateAttempt({
      score,
      attempt,
      rubric,
      level: scenario.level,
      requiredCompetencies: scenario.competencies,
      computedAt: '2026-11-01T00:00:00.000Z',
    });
    expect(decision.status).toBe('provisional');
    expect(decision.weighted).toBe(0);
    expect(score.competencyScores.every((c) => c.abstained)).toBe(true);
  });

  it('abstains when confidence is too low', () => {
    const attempt = attemptFor(scenario, turns);
    const score = scorerOutput(
      attempt,
      [
        competencyScore('accuracy', 0.9, 0.2, ['सही जवाब 73 है।']),
        competencyScore('clarity', 0.9, 0.2, ['जैसे गोली से दिखाऊँ।']),
      ],
      0.2,
    );
    const decision = evaluateAttempt({
      score,
      attempt,
      rubric,
      level: scenario.level,
      requiredCompetencies: scenario.competencies,
      computedAt: '2026-11-01T00:00:00.000Z',
    });
    expect(decision.status).toBe('provisional');
    expect(decision.rationale.en).toMatch(/confidence/i);
  });

  it('requires honest coverage across required competencies', () => {
    const attempt = attemptFor(scenario, turns);
    // Two required but only one has usable evidence → 50% coverage, at the edge.
    const score = scorerOutput(attempt, [
      competencyScore('accuracy', 0.9, 0.9, ['सही जवाब 73 है।']),
      competencyScore('clarity', 0, 0, []),
    ]);
    const decision = evaluateAttempt({
      score,
      attempt,
      rubric,
      level: scenario.level,
      requiredCompetencies: [...scenario.competencies, 'questioning'],
      computedAt: '2026-11-01T00:00:00.000Z',
    });
    expect(decision.status).toBe('provisional');
    expect(decision.rationale.en).toMatch(/covered only/i);
  });

  it('adds missing required competencies as abstentions instead of silently dropping them', () => {
    const normalized = normalizeScorerOutput(
      scorerOutput(attemptFor(scenario, turns), [
        competencyScore('accuracy', 0.8, 0.8, ['सही जवाब 73 है।']),
      ]),
      ['accuracy', 'clarity'],
    );
    expect(normalized.competencyScores.map((c) => c.competency)).toEqual(['accuracy', 'clarity']);
    expect(normalized.competencyScores[1]!.abstained).toBe(true);
  });

  it('clamps out-of-range values and de-duplicates competencies', () => {
    const normalized = normalizeScorerOutput(
      {
        ...scorerOutput(attemptFor(scenario, turns), []),
        competencyScores: [
          { competency: 'accuracy', score: 4, confidence: -2, abstained: false, evidence: [] },
          { competency: 'accuracy', score: 0.5, confidence: 0.5, abstained: false, evidence: [] },
        ],
      },
      ['accuracy'],
    );
    expect(normalized.competencyScores).toHaveLength(1);
    expect(normalized.competencyScores[0]!.score).toBe(0.5);
    expect(clamp01(9)).toBe(1);
    expect(clamp01(-9)).toBe(0);
  });

  it('uses stable score bands', () => {
    expect(scoreBand(0.7)).toBe('met');
    expect(scoreBand(0.69)).toBe('partial');
    expect(scoreBand(0.4)).toBe('partial');
    expect(scoreBand(0.39)).toBe('missing');
  });
});

describe('progression', () => {
  it('starts every skill at a neutral prior and moves the EMA', () => {
    const state = emptyTeacherState({
      id: 't_test_00000000000000000000000000000001',
      createdAt: '2026-11-01T00:00:00.000Z',
      curriculum: { class: 3, subject: 'maths' },
      language: 'hi',
      currentLevel: 1,
    });
    expect(state.competencyHealth.accuracy).toEqual({ ema: 0.5, n: 0 });
    expect(weakestCompetency(state)).toBe('accuracy');
  });

  it('applies an attempt: counts, passes and seeds the EMA', () => {
    const scenario = scenarioWith(1, ['accuracy', 'clarity']);
    const state = emptyTeacherState({
      id: 't_test_00000000000000000000000000000001',
      createdAt: '2026-11-01T00:00:00.000Z',
      curriculum: { class: 3, subject: 'maths' },
      language: 'hi',
      currentLevel: 1,
    });
    const next = passRecord(state, scenario);
    expect(next.progress[1]!.attempts).toBe(1);
    expect(next.progress[1]!.passesByScenario[scenario.id]).toBe(1);
    // First evidence replaces the neutral 0.5 prior; later attempts move it.
    expect(next.competencyHealth.accuracy).toMatchObject({ ema: 0.9, n: 1 });

    const lower = attemptRecord(scenario);
    lower.score.competencyScores[0]!.score = 0.4;
    lower.score.competencyScores[1]!.score = 0.4;
    const moved = applyAttempt(next, lower, scenario.level, '2026-11-02T00:00:00.000Z');
    expect(moved.competencyHealth.accuracy.ema).toBeCloseTo(0.9 + 0.35 * (0.4 - 0.9), 5);
  });

  it('counts a retry as practice but never as a pass', () => {
    const scenario = scenarioWith(1, ['accuracy', 'clarity']);
    const state = emptyTeacherState({
      id: 't_test_00000000000000000000000000000001',
      createdAt: '2026-11-01T00:00:00.000Z',
      curriculum: { class: 3, subject: 'maths' },
      language: 'hi',
      currentLevel: 1,
    });
    const next = passRecord(state, scenario, 'retry');
    expect(next.progress[1]!.attempts).toBe(1);
    expect(next.progress[1]!.passesByScenario).toEqual({});
    expect(next.competencyHealth.accuracy.ema).toBe(0.9);

    // An unverified attempt never moves mastery or passes.
    const unverified = attemptRecord(scenario);
    unverified.verified = false;
    const ignored = applyAttempt(state, unverified, scenario.level, '2026-11-02T00:00:00.000Z');
    expect(ignored.competencyHealth.accuracy).toEqual({ ema: 0.5, n: 0 });
    expect(ignored.progress[1]!.passesByScenario).toEqual({});
  });

  it('levels up only after enough passes across distinct scenarios', () => {
    const a = scenarioWith(1, ['accuracy', 'clarity']);
    const b = pack.scenarios.find(
      (s) => s.level === 1 && s.curriculum.class === a.curriculum.class &&
        s.curriculum.subject === a.curriculum.subject && s.id !== a.id,
    )!;
    let state = emptyTeacherState({
      id: 't_test_00000000000000000000000000000001',
      createdAt: '2026-11-01T00:00:00.000Z',
      curriculum: { class: 3, subject: 'maths' },
      language: 'hi',
      currentLevel: 1,
    });
    state = passRecord(state, a);
    expect(checkLevelUp(state, 1, 2, 2).eligible).toBe(false);
    state = passRecord(state, a);
    expect(checkLevelUp(state, 1, 2, 2).eligible).toBe(false);
    state = passRecord(state, b);
    expect(checkLevelUp(state, 1, 2, 2).eligible).toBe(true);

    const move = applyLevelUp(state, 1, rubric.decision, '2026-11-02T00:00:00.000Z');
    expect(move.leveledUp).toBe(true);
    expect(move.to).toBe(2);
    expect(state.profile.currentLevel).toBe(2);
    expect(state.levelHistory[2]).toBeDefined();
  });

  it('never levels past the available content', () => {
    const state = emptyTeacherState({
      id: 't_test_00000000000000000000000000000001',
      createdAt: '2026-11-01T00:00:00.000Z',
      curriculum: { class: 3, subject: 'maths' },
      language: 'hi',
      currentLevel: 5,
    });
    const move = applyLevelUp(state, 5, rubric.decision);
    expect(move.leveledUp).toBe(false);
    expect(state.profile.currentLevel).toBe(5);
  });

  it('reports ladder progress against policy', () => {
    const state = emptyTeacherState({
      id: 't_test_00000000000000000000000000000001',
      createdAt: '2026-11-01T00:00:00.000Z',
      curriculum: { class: 3, subject: 'maths' },
      language: 'hi',
      currentLevel: 1,
    });
    const progress = levelProgress(state, 1, rubric.decision);
    expect(progress.passesRequired).toBe(rubric.decision.levelUp.passesRequired);
    expect(progress.eligible).toBe(false);
  });
});

describe('scenario selection', () => {
  const state = emptyTeacherState({
    id: 't_test_00000000000000000000000000000001',
    createdAt: '2026-11-01T00:00:00.000Z',
    curriculum: { class: 3, subject: 'maths' },
    language: 'hi',
    currentLevel: 1,
  });

  it('stays inside the teacher class and subject', () => {
    for (const scenario of scenariosForProfile(pack.scenarios, state)) {
      expect(scenario.curriculum.class).toBe(3);
      expect(scenario.curriculum.subject).toBe('maths');
    }
  });

  it('excludes holdout scenarios from rotation', () => {
    const chosen = selectNextScenario(pack.scenarios, state, 1)!;
    expect(chosen.holdout).toBeFalsy();
  });

  it('targets the weakest competency deterministically', () => {
    const tuned: TeacherState = {
      ...state,
      competencyHealth: {
        accuracy: { ema: 0.9, n: 4 },
        clarity: { ema: 0.8, n: 4 },
        misconceptions: { ema: 0.2, n: 4 },
        questioning: { ema: 0.7, n: 4 },
      },
    };
    const chosen = selectNextScenario(pack.scenarios, tuned, 3)!;
    expect(chosen.level).toBe(3);
    expect(chosen.competencies).toContain('misconceptions');
    expect(selectNextScenario(pack.scenarios, tuned, 3)).toBe(chosen);
  });

  it('retries a sibling scenario from the same family', () => {
    const current = selectNextScenario(pack.scenarios, state, 1)!;
    const retry = selectRetryScenario(pack.scenarios, current.id, 1, state);
    expect(retry).not.toBeNull();
    expect(retry!.id).not.toBe(current.id);
    expect(retry!.level).toBe(current.level);
  });

  it('catalogs only levels that have content', () => {
    const catalog = levelCatalog(pack.scenarios, state);
    expect(catalog.map((c) => c.level)).toEqual([1, 2, 3, 4, 5]);
    expect(catalog.every((c) => c.total > 0)).toBe(true);
  });
});

describe('rubric pinning', () => {
  it('pins a stable sha-256 and pack version', async () => {
    expect(rubric.hash).toMatch(/^[0-9a-f]{64}$/);
    expect(pack.packVersion).toBe(`${rubric.id}@${rubric.version}+${rubric.hash!.slice(0, 8)}`);
  });

  it('uses only competencies and weights the rubric defines', () => {
    const ids = new Set(rubric.competencies.map((c) => c.id));
    for (const scenario of pack.scenarios) {
      for (const competency of scenario.competencies) {
        expect(ids.has(competency)).toBe(true);
        expect(rubric.weightsByLevel[scenario.level]?.[competency]).toBeGreaterThan(0);
      }
    }
  });

  it('keeps level weights summing to one', () => {
    for (const weights of Object.values(rubric.weightsByLevel)) {
      const sum = Object.values(weights).reduce((a, b) => a + (b ?? 0), 0);
      expect(sum).toBeCloseTo(1, 5);
    }
  });
});
