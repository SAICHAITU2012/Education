import type {
  AttemptRecord,
  CompetencyHealth,
  CompetencyId,
  DecisionPolicy,
  LevelProgress,
  TeacherState,
} from './types.js';
import { COMPETENCY_IDS } from './types.js';

/**
 * Progression — how a teacher's practice history becomes mastery.
 * Deterministic, server- or client-computable, reviewable.
 */

export const EMA_ALPHA = 0.35;
export const MAX_LEVEL = 5;

export function emptyProgress(level: number): LevelProgress {
  return { level, passesByScenario: {}, attempts: 0 };
}

export function emptyTeacherState(profile: TeacherState['profile']): TeacherState {
  const health = {} as Record<CompetencyId, CompetencyHealth>;
  for (const id of COMPETENCY_IDS) health[id] = { ema: 0.5, n: 0 };
  return { profile, progress: {}, competencyHealth: health, levelHistory: {} };
}

/**
 * Fold one attempt record into the teacher state.
 * `level` is the scenario's mastery level (the orchestrator knows it; we do not
 * re-derive it from the id). Only verified, non-provisional decisions move mastery.
 */
export function applyAttempt(
  state: TeacherState,
  record: AttemptRecord,
  level: number,
  now: string = new Date().toISOString(),
): TeacherState {
  const { attempt, score, decision } = record;
  const next: TeacherState = structuredClone(state);

  const prog = next.progress[level] ?? emptyProgress(level);
  prog.attempts += 1;
  prog.lastAttemptAt = attempt.clientCreatedAt;

  if (record.verified && decision.status === 'pass') {
    prog.passesByScenario[attempt.scenarioId] =
      (prog.passesByScenario[attempt.scenarioId] ?? 0) + 1;
  }

  if (record.verified && decision.status !== 'provisional') {
    for (const cs of score.competencyScores) {
      if (cs.abstained) continue;
      const h = next.competencyHealth[cs.competency] ?? { ema: 0.5, n: 0 };
      h.ema = h.n === 0 ? cs.score : h.ema + EMA_ALPHA * (cs.score - h.ema);
      h.n += 1;
      h.updatedAt = now;
      next.competencyHealth[cs.competency] = h;
    }
  }

  next.progress[level] = prog;
  return next;
}

/**
 * Level-up check — rubric-policy-driven, deterministic.
 * Called by the orchestrator after storing a verified pass.
 *
 * `availableScenarios` is how many non-holdout scenarios actually exist at
 * this level for the teacher's class/subject. If the content pack is thinner
 * than the rubric's breadth requirement, the requirement is capped at what can
 * be practised — otherwise a teacher could be trapped on a one-scenario level.
 */
export function checkLevelUp(
  state: TeacherState,
  level: number,
  passesRequired: number,
  distinctRequired: number,
  availableScenarios: number = Number.POSITIVE_INFINITY,
): { eligible: boolean; passes: number; distinct: number } {
  const prog = state.progress[level];
  if (!prog) return { eligible: false, passes: 0, distinct: 0 };
  const passes = Object.values(prog.passesByScenario).reduce((a, b) => a + b, 0);
  const distinct = Object.keys(prog.passesByScenario).length;
  const effectiveDistinct = Math.max(1, Math.min(distinctRequired, availableScenarios));
  return {
    eligible: passes >= passesRequired && distinct >= effectiveDistinct,
    passes,
    distinct,
  };
}

export function effectiveDistinctRequired(
  distinctRequired: number,
  availableScenarios: number = Number.POSITIVE_INFINITY,
): number {
  return Math.max(1, Math.min(distinctRequired, availableScenarios));
}

export interface LevelUpResult {
  leveledUp: boolean;
  from: number;
  to: number;
  passes: number;
  distinct: number;
}

/**
 * Apply a level-up if the teacher has met the policy at their current level.
 * Mutates `state.profile.currentLevel` / `levelHistory` and returns the move.
 * The final level is capped at 5 (Integrated).
 */
export function applyLevelUp(
  state: TeacherState,
  level: number,
  policy: DecisionPolicy,
  now: string = new Date().toISOString(),
  availableScenarios: number = Number.POSITIVE_INFINITY,
): LevelUpResult {
  const check = checkLevelUp(
    state,
    level,
    policy.levelUp.passesRequired,
    policy.levelUp.distinctScenariosRequired,
    availableScenarios,
  );
  const current = state.profile.currentLevel;
  if (!check.eligible || current !== level || level >= MAX_LEVEL) {
    return { leveledUp: false, from: current, to: current, passes: check.passes, distinct: check.distinct };
  }
  const to = level + 1;
  state.profile.currentLevel = to;
  state.levelHistory[to] = now;
  return { leveledUp: true, from: level, to, passes: check.passes, distinct: check.distinct };
}

/** Weakest competency by EMA (ties broken by canonical order for determinism). */
export function weakestCompetency(state: TeacherState): CompetencyId {
  let weakest: CompetencyId = COMPETENCY_IDS[0]!;
  let min = Infinity;
  for (const id of COMPETENCY_IDS) {
    const h = state.competencyHealth[id];
    const n = h?.n ?? 0;
    const ema = n > 0 ? h!.ema : 0.5;
    if (ema < min) {
      min = ema;
      weakest = id;
    }
  }
  return weakest;
}

/** Progress toward the next level, for the UI ladder. */
export function levelProgress(
  state: TeacherState,
  level: number,
  policy: DecisionPolicy,
  availableScenarios: number = Number.POSITIVE_INFINITY,
): { passes: number; distinct: number; passesRequired: number; distinctRequired: number; eligible: boolean } {
  const check = checkLevelUp(
    state,
    level,
    policy.levelUp.passesRequired,
    policy.levelUp.distinctScenariosRequired,
    availableScenarios,
  );
  return {
    ...check,
    passesRequired: policy.levelUp.passesRequired,
    distinctRequired: effectiveDistinctRequired(
      policy.levelUp.distinctScenariosRequired,
      availableScenarios,
    ),
  };
}
