import type {
  Attempt,
  AttemptRecord,
  Decision,
  PracticeMode,
  Scenario,
  TeacherState,
  Turn,
} from '../core/types.js';
import { evaluateAttempt, normalizeScorerOutput } from '../core/scoring.js';
import { selectNextScenario } from '../core/selection.js';
import { mockScore } from '../llm/mock/scorer.js';
import type { ScoreResponse } from '../shared/api.js';
import { newId, syncAttempts } from './api.js';

/**
 * Offline rehearsal support.
 *
 * The client can score a reviewed transcript on-device with the same
 * deterministic engine the server falls back to. Offline scores are shown but
 * marked unverified and never move mastery; on reconnect the attempt is sent to
 * the server, re-scored and verified, and authoritative state replaces local.
 */

const QUEUE_KEY = 'abhyas:pending-attempts';

export function readPending(): Attempt[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(QUEUE_KEY) ?? '[]') as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (a): a is Attempt =>
        Boolean(a) &&
        typeof a === 'object' &&
        typeof (a as Attempt).id === 'string' &&
        Array.isArray((a as Attempt).turns),
    );
  } catch {
    return [];
  }
}

function writePending(attempts: Attempt[]): void {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(attempts.slice(-50)));
}

export function pendingCount(): number {
  return readPending().length;
}

export function enqueueAttempt(attempt: Attempt): void {
  const queue = readPending().filter((a) => a.id !== attempt.id);
  queue.push(attempt);
  writePending(queue);
}

export function clearPending(): void {
  localStorage.removeItem(QUEUE_KEY);
}

export function buildAttempt(input: {
  teacherId: string;
  scenario: Scenario;
  rubricId: string;
  rubricVersion: string;
  turns: Turn[];
  mode: PracticeMode;
}): Attempt {
  return {
    id: newId('a'),
    teacherId: input.teacherId,
    scenarioId: input.scenario.id,
    scenarioVersion: input.scenario.version,
    rubricId: input.rubricId,
    rubricVersion: input.rubricVersion,
    turns: input.turns,
    mode: input.mode,
    clientCreatedAt: new Date().toISOString(),
    heardCorrectly: true,
  };
}

export interface LocalScore {
  response: ScoreResponse;
}

export async function scoreLocally(input: {
  attempt: Attempt;
  scenario: Scenario;
  rubric: import('../core/types.js').Rubric;
  scenarios: Scenario[];
  state: TeacherState;
}): Promise<LocalScore> {
  const { attempt, scenario, rubric, scenarios, state } = input;
  const raw = await mockScore({ scenario, attempt, rubric });
  const score = normalizeScorerOutput(raw, scenario.competencies);
  const decision = evaluateAttempt({
    score,
    attempt,
    rubric,
    level: scenario.level,
    requiredCompetencies: scenario.competencies,
    computedAt: new Date().toISOString(),
  });
  const record: AttemptRecord = {
    attempt,
    score,
    decision,
    verified: false,
  };
  enqueueAttempt(attempt);
  const response: ScoreResponse = {
    record,
    decision,
    state,
    levelUp: { leveledUp: false, from: state.profile.currentLevel, to: state.profile.currentLevel, passes: 0, distinct: 0 },
    nextScenario: selectNextScenario(scenarios, state, state.profile.currentLevel),
    verified: false,
    engine: 'mock',
  };
  return { response };
}

export async function syncPending(teacherId: string): Promise<{
  verified: number;
  response: Awaited<ReturnType<typeof syncAttempts>> | null;
}> {
  const pending = readPending();
  if (pending.length === 0) return { verified: 0, response: null };
  const response = await syncAttempts(teacherId, pending);
  const remove = new Set<string>();
  for (const record of response.accepted) remove.add(record.attempt.id);
  for (const id of response.duplicates) remove.add(id);
  for (const rejection of response.rejected) remove.add(rejection.id);
  writePending(readPending().filter((a) => !remove.has(a.id)));
  return { verified: response.accepted.length, response };
}

export function localDecisionBand(decision: Decision): string {
  return decision.status;
}
