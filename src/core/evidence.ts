import type { Evidence, Turn } from './types.js';

/**
 * Evidence verification — the anti-hallucination gate.
 *
 * Research finding baked in here: LLM judges routinely fabricate "quotes".
 * Every piece of evidence a scorer returns is checked against the teacher's
 * actual transcript. Unverified evidence does not silently pass: it is marked,
 * it lowers competency confidence, and enough of it forces abstention.
 */

/** Normalize for matching: unicode NFC, collapse whitespace, strip punctuation variants. */
export function normalizeForMatch(text: string): string {
  return text
    .normalize('NFC')
    .replace(/[\u200b-\u200d\uFEFF]/g, '')
    .replace(/[“”„«»"'']/g, '"')
    .replace(/[—–]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/**
 * Devanagari consonant skeleton: strip vowel signs (matras), nukta, anusvara
 * and candrabindu so inflected forms share their citation form's skeleton —
 * "बत्तियों" carries "बत्त". Used ONLY as a fallback for longer markers;
 * short skeletons (क्या → कय, किया → कय) collide and must not match loosely.
 */
function stripDevanagariMatras(text: string): string {
  return text.replace(/[\u0900-\u0903\u093A-\u094F\u0962\u0963]/g, '');
}

/**
 * Marker detection for the scripted engine — strict first, morphology-tolerant
 * second. Quote verification never uses this; it stays on normalizeForMatch.
 *
 * - 1-char markers must be punctuation ("?" = any question sentence).
 * - ≤2-char markers must match as standalone tokens ("कम" must not ride
 *   inside "कमल").
 * - Longer markers: strict containment, then consonant-skeleton containment
 *   when the skeleton is unambiguous (≥3 chars), so "गोलियों" finds "गोलियाँ".
 */
export function textHasMarkers(text: string, markers: string[]): boolean {
  const nt = normalizeForMatch(text);
  if (nt.length === 0) return false;
  const nts = stripDevanagariMatras(nt);
  return markers.some((m) => {
    const nm = normalizeForMatch(m);
    if (nm.length === 0) return false;
    if (nm.length === 1) {
      return /^[\p{P}\p{S}]$/u.test(nm) && nt.includes(nm);
    }
    if (nm.length <= 2) {
      const bounded = new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRegExp(nm)}($|[^\\p{L}\\p{N}])`, 'u');
      return bounded.test(nt);
    }
    if (nt.includes(nm)) return true;
    const skeleton = stripDevanagariMatras(nm);
    return skeleton.length >= 3 && nts.includes(skeleton);
  });
}

/** All teacher turns with their index in the full transcript. */
export function teacherTurnTexts(turns: Turn[]): { index: number; text: string }[] {
  return turns
    .map((turn, index) => ({ index, text: turn.text, role: turn.role }))
    .filter((turn) => turn.role === 'teacher')
    .map(({ index, text }) => ({ index, text }));
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * True when `quote` appears in the teacher's words.
 *
 * Long quotes use normalized containment. Short quotes (e.g. "73", "क ख") must
 * match as a whole token so a two-character number cannot be "found" inside an
 * unrelated word. One-character quotes are never evidence.
 */
export function quoteInTranscript(quote: string, turns: Turn[]): boolean {
  const nq = normalizeForMatch(quote);
  if (nq.length < 2) return false;

  const teachers = turns.filter((t) => t.role === 'teacher');
  if (teachers.length === 0) return false;

  if (nq.length >= 4) {
    return teachers.some((t) => normalizeForMatch(t.text).includes(nq));
  }

  // Short evidence must be a standalone token (numbers, letters, matras).
  const bounded = new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRegExp(nq)}($|[^\\p{L}\\p{N}])`, 'u');
  return teachers.some((t) => bounded.test(normalizeForMatch(t.text)));
}

/** Split a teacher turn into candidate sentences (Devanagari danda + latin stops). */
export function sentences(text: string): string[] {
  return text
    .split(/(?<=[।?!\.])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/**
 * Re-verify every evidence item against the transcript.
 * Mutates `verified` in place and returns the fraction that actually matched:
 * verifiedFactor = verified / totalEvidence.
 *
 * No half-credit: a quote is either in the teacher's words or it is not. This
 * matters at the trust boundary — all-fabricated evidence must yield 0, never
 * 0.5, so the abstention gate can reject it.
 */
export function verifyEvidence(
  evidence: Evidence[],
  turns: Turn[],
): { verifiedFactor: number; verifiedCount: number } {
  if (evidence.length === 0) return { verifiedFactor: 0, verifiedCount: 0 };
  let verified = 0;
  for (const e of evidence) {
    e.verified = quoteInTranscript(e.quote, turns);
    if (e.verified) verified++;
  }
  const factor = verified / evidence.length;
  return { verifiedFactor: factor, verifiedCount: verified };
}

/** Find the first teacher sentence containing any marker (detection normalizer). */
export function firstSentenceWith(
  turns: Turn[],
  markers: string[],
): { quote: string; turnIndex: number } | null {
  for (let i = 0; i < turns.length; i++) {
    const t = turns[i]!;
    if (t.role !== 'teacher') continue;
    for (const s of sentences(t.text)) {
      if (textHasMarkers(s, markers)) {
        return { quote: s, turnIndex: i };
      }
    }
  }
  return null;
}

export function allSentencesWith(
  turns: Turn[],
  markers: string[],
): { quote: string; turnIndex: number }[] {
  const hits: { quote: string; turnIndex: number }[] = [];
  for (let i = 0; i < turns.length; i++) {
    const t = turns[i]!;
    if (t.role !== 'teacher') continue;
    for (const s of sentences(t.text)) {
      if (textHasMarkers(s, markers)) {
        hits.push({ quote: s, turnIndex: i });
      }
    }
  }
  return hits;
}

/** Teacher turns in order — the only material a scorer may quote. */
export function teacherTranscript(turns: Turn[]): { index: number; text: string }[] {
  return teacherTurnTexts(turns);
}
