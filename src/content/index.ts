import rubricJson from './rubric.npst-fln-core.json';
import mathsScenarios from './packs/maths-class3.json';
import mathsClass2Scenarios from './packs/maths-class2.json';
import mathsClass1Scenarios from './packs/maths-class1.json';
import hindiScenarios from './packs/hindi-class2.json';
import hindiClass3Scenarios from './packs/hindi-class3.json';
import hindiClass1Scenarios from './packs/hindi-class1.json';
import { loadPack } from './schema.js';
import type { LoadedPack } from './schema.js';

/**
 * Content packs are versioned, expert-owned files — the "skill files" of the
 * SFIC submission. Everything the LLM may use lives here; nothing is invented
 * at prompt time. The rubric hash is stamped onto every attempt for audit.
 */

let cached: LoadedPack | null = null;

export async function getContentPack(): Promise<LoadedPack> {
  if (cached) return cached;
  cached = await loadPack(rubricJson, [
    ...(mathsClass1Scenarios as object[]),
    ...(mathsClass2Scenarios as object[]),
    ...(mathsScenarios as object[]),
    ...(hindiClass1Scenarios as object[]),
    ...(hindiScenarios as object[]),
    ...(hindiClass3Scenarios as object[]),
  ]);
  return cached;
}

/** Test helper — forget the pinned pack so it can be reloaded. */
export function resetContentCache(): void {
  cached = null;
}

export function getScenario(scenarios: LoadedPack['scenarios'], id: string) {
  return scenarios.find((s) => s.id === id) ?? null;
}
