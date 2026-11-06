import type {
  AttemptRecord,
  CohortCell,
  CohortDashboard,
  CompetencyId,
} from '../core/types.js';
import { COMPETENCY_IDS } from '../core/types.js';

/**
 * k-anonymised cohort analytics.
 *
 * Only verified, non-provisional scores count. A cell is published only when it
 * contains at least `k` observations from at least `minTeachers` distinct
 * pseudonymous teachers. Individual attempts, transcripts, teacher ids and
 * timestamps never leave this function.
 */

export const DEFAULT_K = 5;
export const DEFAULT_MIN_TEACHERS = 3;

export function isoWeek(date: Date): string {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

export interface CohortOptions {
  k?: number;
  minTeachers?: number;
  weeks?: number;
  now?: Date;
}

export function buildCohort(records: AttemptRecord[], options: CohortOptions = {}): CohortDashboard {
  const k = Math.max(2, options.k ?? DEFAULT_K);
  const minTeachers = Math.max(2, options.minTeachers ?? DEFAULT_MIN_TEACHERS);
  const weeks = Math.max(1, Math.min(52, options.weeks ?? 8));
  const now = options.now ?? new Date();
  const cutoff = now.getTime() - weeks * 7 * 86_400_000;

  type Acc = { scores: number[]; teachers: Set<string>; attempts: Set<string> };
  const buckets = new Map<string, Acc>();
  const contributingAttempts = new Set<string>();
  const contributingTeachers = new Set<string>();

  let totalAttempts = 0;
  for (const record of records) {
    if (!record.verified) continue;
    if (record.decision.status === 'provisional') continue;
    const created = new Date(record.attempt.clientCreatedAt);
    if (Number.isNaN(created.getTime()) || created.getTime() < cutoff || created.getTime() > now.getTime() + 86_400_000) {
      continue;
    }
    totalAttempts++;
    const week = isoWeek(created);
    for (const cs of record.score.competencyScores) {
      if (cs.abstained) continue;
      const key = `${week}|${cs.competency}`;
      const acc = buckets.get(key) ?? { scores: [], teachers: new Set<string>(), attempts: new Set<string>() };
      acc.scores.push(cs.score);
      acc.teachers.add(record.attempt.teacherId);
      acc.attempts.add(record.attempt.id);
      buckets.set(key, acc);
    }
  }

  const cells: CohortCell[] = [];
  let suppressedCells = 0;
  const publishedWeeks = new Set<string>();
  for (const [key, acc] of buckets) {
    const [week, competency] = key.split('|') as [string, CompetencyId];
    if (!COMPETENCY_IDS.includes(competency)) continue;
    if (acc.scores.length < k || acc.teachers.size < minTeachers) {
      suppressedCells++;
      continue;
    }
    const mean = acc.scores.reduce((a, b) => a + b, 0) / acc.scores.length;
    cells.push({
      week,
      competency,
      n: acc.scores.length,
      meanScore: Math.round(mean * 100) / 100,
      teachers: acc.teachers.size,
    });
    publishedWeeks.add(week);
    for (const teacher of acc.teachers) contributingTeachers.add(teacher);
    for (const attemptId of acc.attempts) contributingAttempts.add(attemptId);
  }

  cells.sort((a, b) => {
    if (a.week !== b.week) return a.week < b.week ? -1 : 1;
    return COMPETENCY_IDS.indexOf(a.competency) - COMPETENCY_IDS.indexOf(b.competency);
  });

  return {
    cells,
    k,
    minTeachers,
    totalAttempts,
    includedAttempts: contributingAttempts.size,
    suppressedCells,
    contributingTeachers:
      contributingTeachers.size >= minTeachers ? contributingTeachers.size : null,
    weeks: [...publishedWeeks].sort(),
    generatedAt: now.toISOString(),
    note: {
      en: `Only groups with at least ${k} observations from ${minTeachers}+ teachers are shown. Individual attempts are never visible.`,
      hi: `केवल ${k}+ अवलोकन और ${minTeachers}+ शिक्षकों वाले समूह दिखाए जाते हैं। किसी की व्यक्तिगत कोशिश कभी नहीं दिखती।`,
    },
  };
}
