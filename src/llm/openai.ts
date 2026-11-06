import type { ScorerOutput } from '../core/types.js';
import { parseScorerResponse, parseStudentTurn, toScorerOutput } from './parsing.js';
import { buildScorerPrompt, buildStudentPrompt } from './prompts.js';
import type {
  CompletionRequest,
  LlmClient,
  ScorerInput,
  StudentTurnInput,
  StudentTurnOutput,
} from './types.js';
import { LlmError } from './types.js';

export interface OpenAICompatConfig {
  apiKey: string;
  baseUrl?: string;
  model?: string;
  timeoutMs?: number;
  /** Some OpenAI-compatible servers reject response_format; disable if needed. */
  jsonMode?: boolean;
}

/**
 * Any OpenAI-compatible chat-completions endpoint: OpenAI, Together, Groq,
 * vLLM, Ollama, GLM, etc. Same rubric-scoped prompts, same parsing, same
 * deterministic decision layer downstream.
 */
export class OpenAICompatClient implements LlmClient {
  readonly name = 'openai-compat' as const;
  private readonly baseUrl: string;
  private readonly model: string;
  private readonly timeoutMs: number;
  private readonly jsonMode: boolean;

  constructor(private readonly config: OpenAICompatConfig) {
    this.baseUrl = (config.baseUrl ?? 'https://api.openai.com/v1').replace(/\/+$/, '');
    this.model = config.model ?? 'gpt-4o-mini';
    this.timeoutMs = config.timeoutMs ?? 30_000;
    this.jsonMode = config.jsonMode ?? true;
  }

  async studentTurn(input: StudentTurnInput): Promise<StudentTurnOutput> {
    const raw = await this.complete(buildStudentPrompt(input));
    return parseStudentTurn(raw);
  }

  async scoreAttempt(input: ScorerInput): Promise<ScorerOutput> {
    const raw = await this.complete(buildScorerPrompt(input));
    const parsed = parseScorerResponse(raw, input.scenario.competencies);
    return toScorerOutput(parsed, input, this.name);
  }

  private async complete(request: CompletionRequest): Promise<string> {
    let lastError: unknown;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        return await this.request(request, this.jsonMode);
      } catch (err) {
        lastError = err;
        const status = err instanceof LlmError ? err.status : undefined;
        const retryable = status === 429 || (status !== undefined && status >= 500);
        if (!retryable) break;
        await sleep(350 * (attempt + 1));
      }
    }
    throw lastError instanceof Error ? lastError : new LlmError('OpenAI-compatible request failed', this.name);
  }

  private async request(request: CompletionRequest, jsonMode: boolean): Promise<string> {
    const body: Record<string, unknown> = {
      model: this.model,
      messages: [{ role: 'system', content: request.system }, ...request.messages],
      temperature: request.temperature,
      max_tokens: request.maxTokens,
    };
    if (jsonMode && request.json) body.response_format = { type: 'json_object' };

    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (err) {
      throw new LlmError(
        `OpenAI-compatible network error: ${err instanceof Error ? err.message : String(err)}`,
        this.name,
      );
    }

    if (!response.ok) {
      const text = (await response.text()).slice(0, 800);
      // A few compatible servers advertise chat completions but not JSON mode.
      if (response.status === 400 && jsonMode && /response_format|json_object/i.test(text)) {
        return this.request(request, false);
      }
      throw new LlmError(
        `OpenAI-compatible HTTP ${response.status}: ${text}`,
        this.name,
        response.status,
      );
    }

    const json = (await response.json()) as {
      choices?: { message?: { content?: string | null } }[];
    };
    const content = json.choices?.[0]?.message?.content;
    if (!content || !content.trim()) {
      throw new LlmError('OpenAI-compatible returned empty content', this.name);
    }
    return content;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
