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

export interface AnthropicConfig {
  apiKey: string;
  baseUrl?: string;
  model?: string;
  timeoutMs?: number;
}

/**
 * Anthropic Messages API adapter — the deck's reference evaluator.
 * The student and scorer calls are separate HTTP requests with separate system
 * prompts; there is no shared conversation or hidden state between them.
 */
export class AnthropicClient implements LlmClient {
  readonly name = 'anthropic' as const;
  private readonly baseUrl: string;
  private readonly model: string;
  private readonly timeoutMs: number;

  constructor(private readonly config: AnthropicConfig) {
    this.baseUrl = (config.baseUrl ?? 'https://api.anthropic.com').replace(/\/+$/, '');
    this.model = config.model ?? 'claude-sonnet-4-5';
    this.timeoutMs = config.timeoutMs ?? 30_000;
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
        return await this.request(request);
      } catch (err) {
        lastError = err;
        const status = err instanceof LlmError ? err.status : undefined;
        const retryable = status === 429 || (status !== undefined && status >= 500);
        if (!retryable) break;
        await sleep(350 * (attempt + 1));
      }
    }
    throw lastError instanceof Error ? lastError : new LlmError('Anthropic request failed', this.name);
  }

  private async request(request: CompletionRequest): Promise<string> {
    const messages = request.messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({ role: m.role, content: m.content }));
    if (messages.length === 0) messages.push({ role: 'user', content: 'Continue.' });

    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}/v1/messages`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': this.config.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: this.model,
          max_tokens: request.maxTokens,
          temperature: request.temperature,
          system: request.system,
          messages,
        }),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (err) {
      throw new LlmError(
        `Anthropic network error: ${err instanceof Error ? err.message : String(err)}`,
        this.name,
      );
    }

    if (!response.ok) {
      const text = (await response.text()).slice(0, 800);
      throw new LlmError(`Anthropic HTTP ${response.status}: ${text}`, this.name, response.status);
    }

    const json = (await response.json()) as {
      content?: { type?: string; text?: string }[];
    };
    const text = (json.content ?? [])
      .filter((b) => b.type === 'text' && typeof b.text === 'string')
      .map((b) => b.text)
      .join('\n')
      .trim();
    if (!text) throw new LlmError('Anthropic returned empty content', this.name);
    return text;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
