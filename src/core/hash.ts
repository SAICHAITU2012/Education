import type { Rubric, Scenario } from './types.js';

/**
 * Canonical JSON string (stable key order) for hashing.
 * Mirrors RFC 8785's intent closely enough for content pinning: sorted object
 * keys, no whitespace, stable array order.
 */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(',')}}`;
}

/** SHA-256 hex digest over the canonical form of a rubric or scenario. */
export async function contentHash(value: Rubric | Scenario): Promise<string> {
  const rest = { ...(value as unknown as Record<string, unknown>) };
  delete rest.hash;
  const data = new TextEncoder().encode(canonicalJson(rest));
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** Deterministic 32-bit string hash (FNV-1a) for tie-breaks. */
export function fnv1a(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Short, human-checkable digest label for UI (first 12 hex chars). */
export function shortHash(hash: string | undefined): string {
  return (hash ?? '').slice(0, 12);
}
