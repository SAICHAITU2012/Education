import type { ScorerEngine } from '../core/types.js';
import { AnthropicClient } from './anthropic.js';
import { MockClient } from './mock/index.js';
import { OpenAICompatClient } from './openai.js';
import type { LlmClient, LlmEnv, ScorerInput, StudentTurnInput } from './types.js';
import { LlmError } from './types.js';

/**
 * Provider selection. `auto` uses the best configured cloud provider and falls
 * back to the deterministic engine if a call fails, so a network hiccup never
 * loses a rehearsal. The chosen engine is recorded on every score.
 */
export function readLlmEnv(env: NodeJS.ProcessEnv = process.env): LlmEnv {
  const raw = (env.LLM_PROVIDER ?? 'auto').toLowerCase();
  const provider: LlmEnv['provider'] =
    raw === 'mock' || raw === 'openai' || raw === 'openai-compat' || raw === 'anthropic' || raw === 'auto'
      ? raw === 'openai-compat'
        ? 'openai'
        : raw
      : 'auto';
  return {
    provider,
    openaiApiKey: env.OPENAI_API_KEY?.trim() || undefined,
    openaiBaseUrl: env.OPENAI_BASE_URL?.trim() || undefined,
    openaiModel: env.OPENAI_MODEL?.trim() || undefined,
    anthropicApiKey: env.ANTHROPIC_API_KEY?.trim() || undefined,
    anthropicModel: env.ANTHROPIC_MODEL?.trim() || undefined,
    timeoutMs: Number.parseInt(env.LLM_TIMEOUT_MS ?? '30000', 10) || 30_000,
    fallbackToMock: env.LLM_FALLBACK_TO_MOCK !== 'false',
  };
}

export interface LlmRuntime {
  client: LlmClient;
  engine: ScorerEngine;
  mode: 'mock' | 'cloud';
  /** True when calls falling back to mock is allowed. */
  fallback: boolean;
}

export function createLlmClient(env: LlmEnv = readLlmEnv()): LlmRuntime {
  let primary: LlmClient | null = null;

  if (env.provider === 'openai' && env.openaiApiKey) {
    primary = new OpenAICompatClient({
      apiKey: env.openaiApiKey,
      baseUrl: env.openaiBaseUrl,
      model: env.openaiModel,
      timeoutMs: env.timeoutMs,
      jsonMode: process.env.OPENAI_JSON_MODE !== 'false',
    });
  } else if (env.provider === 'anthropic' && env.anthropicApiKey) {
    primary = new AnthropicClient({
      apiKey: env.anthropicApiKey,
      model: env.anthropicModel,
      timeoutMs: env.timeoutMs,
    });
  } else if (env.provider === 'auto') {
    if (env.anthropicApiKey) {
      primary = new AnthropicClient({
        apiKey: env.anthropicApiKey,
        model: env.anthropicModel,
        timeoutMs: env.timeoutMs,
      });
    } else if (env.openaiApiKey) {
      primary = new OpenAICompatClient({
        apiKey: env.openaiApiKey,
        baseUrl: env.openaiBaseUrl,
        model: env.openaiModel,
        timeoutMs: env.timeoutMs,
        jsonMode: process.env.OPENAI_JSON_MODE !== 'false',
      });
    }
  }

  const mock = new MockClient();
  if (!primary) {
    return { client: mock, engine: 'mock', mode: 'mock', fallback: true };
  }

  return {
    client: env.fallbackToMock ? new ResilientClient(primary, mock) : primary,
    engine: primary.name,
    mode: 'cloud',
    fallback: env.fallbackToMock,
  };
}

/**
 * Try the cloud provider; on any failure, use the deterministic engine and log
 * one line. The score's `engine` field tells the truth about what scored it.
 */
class ResilientClient implements LlmClient {
  constructor(
    private readonly primary: LlmClient,
    private readonly fallback: LlmClient,
  ) {}

  get name(): ScorerEngine {
    return this.primary.name;
  }

  async studentTurn(input: StudentTurnInput) {
    try {
      return await this.primary.studentTurn(input);
    } catch (err) {
      this.warn('student', err);
      return this.fallback.studentTurn(input);
    }
  }

  async scoreAttempt(input: ScorerInput) {
    try {
      return await this.primary.scoreAttempt(input);
    } catch (err) {
      this.warn('scorer', err);
      return this.fallback.scoreAttempt(input);
    }
  }

  private warn(stage: 'student' | 'scorer', err: unknown): void {
    const message = err instanceof LlmError ? `${err.provider} ${err.status ?? ''} ${err.message}` : String(err);
    console.warn(`[abhyas] ${stage} fell back to mock: ${message.slice(0, 240)}`);
  }
}
