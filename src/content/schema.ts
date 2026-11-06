import { z } from 'zod';
import type { Rubric, Scenario } from '../core/types.js';
import { contentHash } from '../core/hash.js';

const localized = z.object({ en: z.string(), hi: z.string() });

const competencyId = z.enum(['accuracy', 'clarity', 'misconceptions', 'questioning']);

export const competencySchema = z.object({
  id: competencyId,
  name: localized,
  description: localized,
  indicators: z.array(localized).min(1),
  npstRef: z.string(),
  teachRef: z.string(),
  critical: z.boolean(),
});

export const rubricSchema = z.object({
  id: z.string(),
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  competencies: z.array(competencySchema).min(4),
  weightsByLevel: z.record(z.string(), z.record(competencyId, z.number().positive())),
  decision: z.object({
    passThreshold: z.number().min(0).max(1),
    retryThreshold: z.number().min(0).max(1),
    competencyFloor: z.number().min(0).max(1),
    levelUp: z.object({
      passesRequired: z.number().int().positive(),
      distinctScenariosRequired: z.number().int().positive(),
    }),
    minConfidence: z.number().min(0).max(1),
    minEvidenceCoverage: z.number().min(0).max(1),
  }),
  hash: z.string().optional(),
});

export const scenarioSchema = z.object({
  id: z.string(),
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  pack: z.string(),
  level: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]),
  language: z.enum(['hi', 'en', 'kn', 'ta', 'te', 'ml']),
  curriculum: z.object({
    class: z.union([z.literal(1), z.literal(2), z.literal(3)]),
    subject: z.enum(['maths', 'hindi']),
    topic: z.string(),
    ncertRef: z.string().optional(),
  }),
  competencies: z.array(competencyId).min(1),
  title: localized,
  studentPersona: z.object({
    name: z.string(),
    age: z.number().int().min(5).max(10),
    traits: z.array(z.string()),
    opening: localized,
    misconception: z
      .object({
        id: z.string(),
        belief: localized,
        resistance: z.array(localized).min(1),
        concession: localized,
      })
      .optional(),
    bounds: z.object({
      maxStudentTurns: z.number().int().min(2).max(6),
      allowedTopics: z.array(z.string()),
      mustNotReveal: z.array(z.string()),
      exitCondition: z.string(),
    }),
  }),
  detection: z.object({
    questionMarkers: z.array(z.string()),
    surfaceMarkers: z.array(z.string()),
    correctMarkers: z.array(z.string()),
    exampleWords: z.array(z.string()),
    jargonBlacklist: z.array(z.string()),
    wrongFactMarkers: z.array(z.string()),
    correctFactMarkers: z.array(z.string()),
  }),
  expectedBehaviors: z.array(z.object({ competency: competencyId, behavior: localized })),
  holdout: z.boolean().optional(),
});

export interface LoadedPack {
  rubric: Rubric;
  scenarios: Scenario[];
  packVersion: string;
}

/**
 * Validate + hash-pin a pack. The hash is computed over canonical JSON of the
 * rubric content and stamped onto every attempt that uses it — auditability.
 */
export async function loadPack(
  rubricJson: unknown,
  scenarioJsons: unknown[],
): Promise<LoadedPack> {
  const rubric = rubricSchema.parse(rubricJson) as Rubric;
  const scenarios = scenarioJsons.map((s) => scenarioSchema.parse(s) as Scenario);
  const ids = new Set<string>();
  const competencyIds = new Set(rubric.competencies.map((c) => c.id));
  if (competencyIds.size !== rubric.competencies.length) {
    throw new Error(`Rubric ${rubric.id} has duplicate competency ids`);
  }
  for (const [level, weights] of Object.entries(rubric.weightsByLevel)) {
    const sum = Object.values(weights).reduce((a, b) => a + b, 0);
    if (Math.abs(sum - 1) > 0.02) {
      throw new Error(`Rubric weights for level ${level} must sum to ~1 (got ${sum.toFixed(3)})`);
    }
  }
  for (const s of scenarios) {
    if (ids.has(s.id)) throw new Error(`Duplicate scenario id: ${s.id}`);
    ids.add(s.id);
    for (const c of s.competencies) {
      if (!competencyIds.has(c)) {
        throw new Error(`Scenario ${s.id} uses competency ${c} not present in rubric ${rubric.id}`);
      }
    }
    for (const [level, expected] of Object.entries(rubric.weightsByLevel)) {
      const missing = s.competencies.filter((c) => !(c in expected));
      if (missing.length > 0 && Number(level) === s.level) {
        throw new Error(
          `Scenario ${s.id} targets ${missing.join(', ')} but level ${level} has no weight for it`,
        );
      }
    }
  }
  rubric.hash = await contentHash(rubric);
  const packVersion = `${rubric.id}@${rubric.version}+${rubric.hash.slice(0, 8)}`;
  return { rubric, scenarios, packVersion };
}
