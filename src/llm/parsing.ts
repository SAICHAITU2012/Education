import { z } from 'zod';
import type { CompetencyId, Lang, ScorerOutput } from '../core/types.js';
import { COMPETENCY_IDS } from '../core/types.js';
import type { ScorerInput } from './types.js';
import type { ScorerEngine } from '../core/types.js';

/**
 * Model output is untrusted input. Everything is parsed, validated and clamped
 * before it can influence a score. A malformed response never becomes a grade;
 * the orchestrator falls back to the deterministic mock engine instead.
 */

/** Pull the first balanced-looking JSON object out of a model reply. */
export function extractJsonObject(text: string): unknown {
  let s = text.trim();
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence?.[1]) s = fence[1].trim();

  const start = s.indexOf('{');
  const end = s.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) {
    throw new Error('Model response did not contain a JSON object');
  }
  return JSON.parse(s.slice(start, end + 1));
}

const localizedSchema = z
  .object({ en: z.string(), hi: z.string().optional() })
  .transform((v) => ({ en: v.en, hi: v.hi && v.hi.trim() ? v.hi : v.en }));

const evidenceSchema = z.object({
  quote: z.string(),
  turnIndex: z.number().int().optional().default(-1),
  note: localizedSchema.optional(),
});

const competencyScoreSchema = z.object({
  competency: z.string(),
  score: z.number().finite(),
  confidence: z.number().finite().optional().default(0.5),
  abstained: z.boolean().optional().default(false),
  reason: localizedSchema.optional(),
  evidence: z.array(evidenceSchema).optional().default([]),
});

const scorerResponseSchema = z.object({
  competencyScores: z.array(competencyScoreSchema).min(1),
  summary: localizedSchema.optional(),
  suggestion: localizedSchema.optional(),
  overallConfidence: z.number().finite().optional().default(0),
});

const studentResponseSchema = z.object({
  text: z.string().min(1),
  done: z.boolean().optional().default(false),
});

export interface ParsedStudentTurn {
  text: string;
  done: boolean;
}

export function parseStudentTurn(text: string): ParsedStudentTurn {
  try {
    const parsed = studentResponseSchema.parse(extractJsonObject(text));
    return { text: parsed.text.trim(), done: parsed.done };
  } catch {
    // Some OpenAI-compatible endpoints ignore JSON mode. A short plain reply is
    // still usable as a student turn; never let it end the roleplay by accident.
    const cleaned = text
      .replace(/```[\s\S]*?```/g, ' ')
      .replace(/^\s*(student|assistant)\s*:\s*/i, '')
      .replace(/^["'“”]|["'“”]$/g, '')
      .trim();
    if (cleaned.length === 0) throw new Error('Empty student reply');
    return { text: cleaned.slice(0, 400), done: false };
  }
}

export interface ParsedScorerResponse {
  competencyScores: {
    competency: CompetencyId;
    score: number;
    confidence: number;
    abstained: boolean;
    reason?: { en: string; hi: string };
    evidence: { quote: string; turnIndex: number; note?: { en: string; hi: string } }[];
  }[];
  summary: { en: string; hi: string };
  suggestion: { en: string; hi: string };
  overallConfidence: number;
}

export function parseScorerResponse(text: string, allowed: CompetencyId[]): ParsedScorerResponse {
  const parsed = scorerResponseSchema.parse(extractJsonObject(text));
  const allowedSet = new Set<CompetencyId>(allowed.length > 0 ? allowed : COMPETENCY_IDS);

  const seen = new Set<CompetencyId>();
  const competencyScores: ParsedScorerResponse['competencyScores'] = [];
  for (const cs of parsed.competencyScores) {
    const id = cs.competency as CompetencyId;
    if (!allowedSet.has(id) || seen.has(id)) continue;
    seen.add(id);
    competencyScores.push({
      competency: id,
      score: cs.score,
      confidence: cs.confidence,
      abstained: cs.abstained,
      ...(cs.reason ? { reason: cs.reason } : {}),
      evidence: cs.evidence.map((e) => ({
        quote: e.quote,
        turnIndex: e.turnIndex,
        ...(e.note ? { note: e.note } : {}),
      })),
    });
  }
  if (competencyScores.length === 0) {
    throw new Error('Scorer returned no valid competencies');
  }

  const fallbackSummary = {
    en: 'Feedback is based only on the words in your transcript.',
    hi: 'प्रतिक्रिया केवल आपके ट्रांसक्रिप्ट के शब्दों पर आधारित है।',
  };
  const fallbackSuggestion = {
    en: 'Try one concrete example, then ask the child to explain her thinking.',
    hi: 'एक ठोस उदाहरण दें, फिर बच्चे से उसकी सोच समझाने को कहें।',
  };

  return {
    competencyScores,
    summary: parsed.summary ?? fallbackSummary,
    suggestion: parsed.suggestion ?? fallbackSuggestion,
    overallConfidence: parsed.overallConfidence,
  };
}

/** Build the final ScorerOutput with server-owned metadata. */
export function toScorerOutput(
  parsed: ParsedScorerResponse,
  input: ScorerInput,
  engine: ScorerEngine,
  now: string = new Date().toISOString(),
): ScorerOutput {
  const scores = [...parsed.competencyScores].sort(
    (a, b) => COMPETENCY_IDS.indexOf(a.competency) - COMPETENCY_IDS.indexOf(b.competency),
  );
  const avg =
    scores.length > 0 ? scores.reduce((a, s) => a + (Number.isFinite(s.confidence) ? s.confidence : 0), 0) / scores.length : 0;
  return {
    attemptId: input.attempt.id,
    competencyScores: scores.map((s) => ({
      competency: s.competency,
      score: clamp(s.score),
      confidence: clamp(s.confidence),
      evidence: s.evidence.map((e) => ({ ...e, verified: false })),
      abstained: s.abstained,
      ...(s.reason ? { reason: s.reason } : {}),
    })),
    summary: parsed.summary,
    suggestion: parsed.suggestion,
    overallConfidence: clamp(Number.isFinite(parsed.overallConfidence) ? parsed.overallConfidence : avg),
    engine,
    rubricVersion: input.rubric.version,
    scoredAt: now,
  };
}

function clamp(n: number): number {
  return Math.max(0, Math.min(1, n));
}

/** Localized copy for a language, falling back to English. */
export function textFor(text: { en: string; hi?: string }, lang: Lang): string {
  return lang === 'hi' && text.hi ? text.hi : text.en;
}
