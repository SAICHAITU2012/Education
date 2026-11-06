import type { ScorerOutput } from '../../core/types.js';
import type { LlmClient, ScorerInput, StudentTurnInput, StudentTurnOutput } from '../types.js';
import { mockScore } from './scorer.js';
import { mockStudentTurn } from './student.js';

/**
 * Deterministic on-device engine. It implements exactly the same LlmClient
 * contract as the cloud adapters, so the rest of the system never branches on
 * provider. This is also the offline fallback and the calibration baseline.
 */
export class MockClient implements LlmClient {
  readonly name = 'mock' as const;

  async studentTurn(input: StudentTurnInput): Promise<StudentTurnOutput> {
    return mockStudentTurn(input.scenario, input.turns, input.lang === 'hi' ? 'hi' : 'en');
  }

  async scoreAttempt(input: ScorerInput): Promise<ScorerOutput> {
    return mockScore(input);
  }
}

export { mockScore, mockStudentTurn };
