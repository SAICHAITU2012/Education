import type { CompetencyId, Scenario, TeacherState } from './types.js';
import { weakestCompetency } from './progression.js';

/**
 * Next-scenario selection — "the next scenario targets the measured gap".
 *
 * Deterministic: given the same teacher state and pack, the same scenario is
 * always selected. Order of rules matters:
 *   1. Scenarios at the teacher's current level, in the teacher's class/subject.
 *   2. Exclude holdout (transfer-test) scenarios from normal rotation.
 *   3. Prefer scenarios not yet passed (or passed fewest times).
 *   4. Among those, prefer scenarios exercising the weakest competency.
 *   5. Tie-break by id (stable, reviewable).
 */
export function scenariosForProfile(
  scenarios: Scenario[],
  state: TeacherState,
): Scenario[] {
  const { class: klass, subject } = state.profile.curriculum;
  return scenarios.filter(
    (s) => s.curriculum.class === klass && s.curriculum.subject === subject,
  );
}

/** Non-holdout levels with content for a class/subject, ascending. */
export function levelsFor(
  scenarios: Scenario[],
  curriculum: TeacherState['profile']['curriculum'],
): number[] {
  return [
    ...new Set(
      scenarios
        .filter(
          (s) =>
            !s.holdout &&
            s.curriculum.class === curriculum.class &&
            s.curriculum.subject === curriculum.subject,
        )
        .map((s) => s.level as number),
    ),
  ].sort((a, b) => a - b);
}

/** The first level a teacher can practise for this class/subject. */
export function entryLevel(
  scenarios: Scenario[],
  curriculum: TeacherState['profile']['curriculum'],
): number {
  return levelsFor(scenarios, curriculum)[0] ?? 1;
}

/**
 * Keep `profile.currentLevel` pointing at a level that has content.
 * Avoids the trap where a class/subject starts above level 1 (Hindi 2–3) or a
 * curriculum switch leaves the teacher on a level with no scenarios.
 */
export function reconcileLevel(scenarios: Scenario[], state: TeacherState): number {
  const levels = levelsFor(scenarios, state.profile.curriculum);
  const current = state.profile.currentLevel;
  if (levels.length === 0) return current;
  if (levels.includes(current)) return current;
  const below = levels.filter((level) => level <= current);
  return below.length > 0 ? below[below.length - 1]! : levels[0]!;
}

/** How many non-holdout scenarios exist at a level for this teacher. */
export function availableAtLevel(
  scenarios: Scenario[],
  state: TeacherState,
  level: number,
): number {
  return scenariosForProfile(scenarios, state).filter((s) => s.level === level && !s.holdout).length;
}

export function selectNextScenario(
  scenarios: Scenario[],
  state: TeacherState,
  currentLevel: number,
): Scenario | null {
  const inProfile = scenariosForProfile(scenarios, state).filter((s) => !s.holdout);
  // If the level has no content, drop to the highest level that does.
  const availableLevels = [...new Set(inProfile.map((s) => s.level))].sort((a, b) => a - b);
  if (availableLevels.length === 0) return null;
  const level: Scenario['level'] = availableLevels.includes(currentLevel as Scenario['level'])
    ? (currentLevel as Scenario['level'])
    : (availableLevels.filter((l) => l <= currentLevel).pop() ?? availableLevels[0]!);

  const candidates = inProfile.filter((s) => s.level === level);
  if (candidates.length === 0) return null;

  const weakest: CompetencyId = weakestCompetency(state);
  const passCount = (id: string): number => {
    const prog = state.progress[level];
    return prog?.passesByScenario[id] ?? 0;
  };
  const minPasses = Math.min(...candidates.map((s) => passCount(s.id)));
  const leastPassed = candidates.filter((s) => passCount(s.id) === minPasses);
  const targetingWeak = leastPassed.filter((s) => s.competencies.includes(weakest));
  const pool = targetingWeak.length > 0 ? targetingWeak : leastPassed;
  pool.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return pool[0]!;
}

/**
 * Retry selection: same scenario family, different variant — the same
 * misconception in a fresh skin, so the retry is not rote memorisation.
 */
export function selectRetryScenario(
  scenarios: Scenario[],
  currentScenarioId: string,
  currentLevel: number,
  state?: TeacherState,
): Scenario | null {
  const poolBase = state ? scenariosForProfile(scenarios, state) : scenarios;
  const current = poolBase.find((s) => s.id === currentScenarioId);
  const sameLevel = poolBase.filter(
    (s) => s.level === currentLevel && !s.holdout && s.id !== currentScenarioId,
  );
  if (!current || sameLevel.length === 0) return current ?? null;
  const sameWeakness = sameLevel.filter(
    (s) =>
      s.studentPersona.misconception?.id === current.studentPersona.misconception?.id ||
      (s.curriculum.topic === current.curriculum.topic && s.curriculum.topic !== ''),
  );
  const pool = sameWeakness.length > 0 ? sameWeakness : sameLevel;
  pool.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return pool[0]!;
}

/** Levels that have content for this teacher's class/subject, with counts. */
export function levelCatalog(
  scenarios: Scenario[],
  state: TeacherState,
): { level: number; total: number; passed: number; distinctPasses: number }[] {
  const inProfile = scenariosForProfile(scenarios, state).filter((s) => !s.holdout);
  const levels = [...new Set(inProfile.map((s) => s.level))].sort((a, b) => a - b);
  return levels.map((level) => {
    const list = inProfile.filter((s) => s.level === level);
    const progress = state.progress[level];
    const passed = Object.values(progress?.passesByScenario ?? {}).reduce((a, b) => a + b, 0);
    return {
      level,
      total: list.length,
      passed,
      distinctPasses: Object.keys(progress?.passesByScenario ?? {}).length,
    };
  });
}
