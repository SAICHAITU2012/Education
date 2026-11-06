import type {
  Attempt,
  Lang,
  Rubric,
  Scenario,
  ScorerEngine,
  ScorerOutput,
  Turn,
} from '../core/types.js';

/**
 * The swappable model interface — "Model-agnostic by design".
 * Speech, the student simulator and the scorer all sit behind this boundary;
 * cloud or on-device, the contracts and the deterministic decision layer are identical.
 */

export interface StudentTurnInput {
  scenario: Scenario;
  turns: Turn[];
  lang: Lang;
}

export interface StudentTurnOutput {
  text: string;
  /** true when the roleplay is wrapped (student conceded / turn budget spent). */
  done: boolean;
}

export interface ScorerInput {
  scenario: Scenario;
  attempt: Attempt;
  rubric: Rubric;
}

export interface LlmClient {
  readonly name: ScorerEngine;
  studentTurn(input: StudentTurnInput): Promise<StudentTurnOutput>;
  scoreAttempt(input: ScorerInput): Promise<ScorerOutput>;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface CompletionRequest {
  system: string;
  messages: ChatMessage[];
  temperature: number;
  maxTokens: number;
  /** Ask providers that support it for a JSON object response. */
  json?: boolean;
}

/** Small provider abstraction used by both adapters and their tests. */
export interface CompletionClient {
  complete(request: CompletionRequest): Promise<string>;
}

export interface LlmEnv {
  provider: 'auto' | 'mock' | 'openai' | 'anthropic';
  openaiApiKey?: string;
  openaiBaseUrl?: string;
  openaiModel?: string;
  anthropicApiKey?: string;
  anthropicModel?: string;
  timeoutMs: number;
  fallbackToMock: boolean;
}

export class LlmError extends Error {
  constructor(
    message: string,
    readonly provider: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'LlmError';
  }
}
