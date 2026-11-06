import type {
  Attempt,
  CompetencyId,
  CompetencyScore,
  Decision,
  DecisionStatus,
  Rubric,
  ScorerOutput,
} from './types.js';
import { verifyEvidence } from './evidence.js';

/**
 * The deterministic decision engine ("Code decides").
 *
 * Pure function over (ScorerOutput, Attempt, Rubric). No model, no randomness
 * in the computation path — the same attempt and rubric always yield the same
 * decision, online or offline, cloud or on-device. `computedAt` is metadata,
 * not part of the decision.
 */

export interface ScoredAttemptInput {
  score: ScorerOutput;
  attempt: Attempt;
  rubric: Rubric;
  level: number;
  /** Scenario competencies — guarantees the coverage denominator is honest. */
  requiredCompetencies?: CompetencyId[];
  /** Injectable clock for deterministic tests/replays. */
  computedAt?: string;
}

export interface ScoreVerification {
  status: DecisionStatus | 'ok';
  reason?: string;
}

/** Bands used by the UI, calibration tooling and tests. */
export type ScoreBand = 'met' | 'partial' | 'missing';

export function scoreBand(score: number): ScoreBand {
  if (score >= 0.7) return 'met';
  if (score >= 0.4) return 'partial';
  return 'missing';
}

const ABSTAIN_REASON = {
  en: 'Cited evidence did not match your actual words. Nothing was scored on a guess.',
  hi: 'उद्धरण आपके असली शब्दों से नहीं मिले। अंदाज़े पर कोई अंक नहीं दिए गए।',
};

const MISSING_REASON = {
  en: 'The scorer returned no judgement for this skill, so it was not counted.',
  hi: 'इस कौशल पर स्कोरर ने कोई निर्णय नहीं दिया, इसलिए इसे नहीं गिना गया।',
};

/**
 * Make a scorer response safe to score:
 *  - clamp scores/confidence into [0,1]
 *  - de-duplicate competencies
 *  - ensure every required competency is present (missing → abstained)
 *  - ensure evidence shapes are usable
 */
export function normalizeScorerOutput(
  score: ScorerOutput,
  required: CompetencyId[] = [],
): ScorerOutput {
  const byId = new Map<CompetencyId, CompetencyScore>();
  for (const cs of score.competencyScores ?? []) {
    if (!cs || typeof cs.competency !== 'string') continue;
    const evidence = Array.isArray(cs.evidence)
      ? cs.evidence
          .filter((e) => e && typeof e.quote === 'string')
          .map((e) => ({
            quote: e.quote,
            turnIndex: Number.isFinite(e.turnIndex) ? e.turnIndex : -1,
            verified: false,
            ...(e.note ? { note: e.note } : {}),
          }))
      : [];
    byId.set(cs.competency, {
      competency: cs.competency,
      score: clamp01(Number.isFinite(cs.score) ? cs.score : 0),
      confidence: clamp01(Number.isFinite(cs.confidence) ? cs.confidence : 0),
      evidence,
      abstained: Boolean(cs.abstained),
      ...(cs.reason ? { reason: cs.reason } : {}),
    });
  }

  const ordered: CompetencyScore[] = [];
  for (const id of required) {
    const found = byId.get(id);
    if (found) {
      ordered.push(found);
      byId.delete(id);
    } else {
      ordered.push({
        competency: id,
        score: 0,
        confidence: 0,
        evidence: [],
        abstained: true,
        reason: MISSING_REASON,
      });
    }
  }
  // Keep any extra competencies the scorer volunteered (some rubrics add one).
  for (const cs of byId.values()) ordered.push(cs);

  return {
    ...score,
    competencyScores: ordered,
    overallConfidence: clamp01(Number.isFinite(score.overallConfidence) ? score.overallConfidence : 0),
  };
}

/**
 * Re-verify evidence quotes, adjust per-competency confidence, then compute
 * the weighted score and the decision.
 *
 * Verification is the trust boundary: a fabricated quote can never increase a
 * score. If most of a competency's evidence is fabricated, the competency is
 * marked abstained and reported to the teacher as such.
 */
export function evaluateAttempt(input: ScoredAttemptInput): Decision {
  const { score, attempt, rubric, level, requiredCompetencies } = input;
  const policy = rubric.decision;
  const computedAt = input.computedAt ?? new Date().toISOString();
  const normalized = normalizeScorerOutput(score, requiredCompetencies);
  score.competencyScores = normalized.competencyScores;

  // 1. Anti-hallucination: verify every quoted piece of evidence.
  let totalConfidence = 0;
  const relevant = score.competencyScores;
  for (const cs of relevant) {
    if (cs.abstained) continue;
    const { verifiedFactor } = verifyEvidence(cs.evidence, attempt.turns);
    // Unverified evidence drags confidence down; below half-verified → abstain.
    if (cs.evidence.length > 0 && verifiedFactor < 0.5) {
      cs.abstained = true;
      cs.reason = ABSTAIN_REASON;
      continue;
    }
    // A score with no evidence at all is a guess. Cap confidence hard.
    if (cs.evidence.length === 0) {
      cs.confidence = Math.min(cs.confidence, 0.35);
    } else {
      cs.confidence = clamp01(cs.confidence * (0.6 + 0.4 * verifiedFactor));
    }
    totalConfidence += cs.confidence;
  }

  const active = relevant.filter((c) => !c.abstained);
  // Coverage means *evidenced* coverage: a competency only counts when at
  // least one of its quotes was found in the teacher's transcript. A score
  // with no quotable support is a guess, even if the scorer returned one.
  const evidenced = active.filter((c) => c.evidence.some((e) => e.verified));
  const coverage = relevant.length > 0 ? evidenced.length / relevant.length : 0;
  const overallConfidence = active.length > 0 ? totalConfidence / active.length : 0;
  score.overallConfidence = overallConfidence;

  // 2. Abstention gates — thin evidence or low confidence → provisional.
  if (active.length === 0) {
    return decideProvisional(rubric, level, computedAt, {
      en: 'Not enough reliable evidence in this attempt. Nothing was scored.',
      hi: 'इस कोशिश में भरोसेमंद सबूत कम थे। कोई अंक नहीं लगाए गए।',
    });
  }
  if (coverage < policy.minEvidenceCoverage) {
    return decideProvisional(rubric, level, computedAt, {
      en: `Evidence covered only ${Math.round(coverage * 100)}% of the skills — too thin to score.`,
      hi: `सबूत केवल ${Math.round(coverage * 100)}% कौशल तक ही पहुँचे — अंक देना ठीक नहीं।`,
    });
  }
  if (overallConfidence < policy.minConfidence) {
    return decideProvisional(rubric, level, computedAt, {
      en: 'Scorer confidence was too low. Retry — clearer audio or a longer answer helps.',
      hi: 'स्कोरर का भरोसा कम था। दोबारा बोलें — साफ़ आवाज़ और थोड़ा लंबा उत्तर मदद करता है।',
    });
  }

  // 3. Weighted score over active competencies using level weights.
  const weights = rubric.weightsByLevel[level] ?? {};
  let weightedSum = 0;
  let weightTotal = 0;
  for (const cs of active) {
    const w = weights[cs.competency] ?? 0;
    if (w <= 0) continue;
    weightedSum += w * cs.score;
    weightTotal += w;
  }
  const weighted = weightTotal > 0 ? weightedSum / weightTotal : 0;

  // 4. Critical-competency floors.
  const criticalById = new Map(rubric.competencies.map((c) => [c.id, c] as const));
  const floorViolations: CompetencyId[] = [];
  for (const cs of active) {
    const comp = criticalById.get(cs.competency);
    if (comp?.critical && cs.score < policy.competencyFloor) {
      floorViolations.push(cs.competency);
    }
  }

  // 5. Decision.
  let status: DecisionStatus;
  let rationale: { en: string; hi: string };
  if (weighted >= policy.passThreshold && floorViolations.length === 0) {
    status = 'pass';
    rationale = {
      en: `Weighted score ${weighted.toFixed(2)} cleared the pass bar with no critical gaps.`,
      hi: `भारित अंक ${weighted.toFixed(2)} ने पास स्तर पार किया — कोई गंभीर कमी नहीं।`,
    };
  } else if (floorViolations.length > 0 && weighted >= policy.retryThreshold) {
    status = 'retry';
    rationale = {
      en: `Good overall, but ${floorViolations.join(', ')} fell below the critical floor.`,
      hi: `कुल मिलाकर अच्छा, पर ${floorViolations.join(', ')} न्यूनतम स्तर से नीचे रहा।`,
    };
  } else if (weighted >= policy.retryThreshold) {
    status = 'retry';
    rationale = {
      en: `Weighted score ${weighted.toFixed(2)} is close — one more focused attempt.`,
      hi: `भारित अंक ${weighted.toFixed(2)} पास के करीब है — एक और केंद्रित कोशिश।`,
    };
  } else {
    status = 'redo';
    rationale = {
      en: 'This scenario needs a different start. A hint is ready below.',
      hi: 'इस स्थिति को नए सिरे से शुरू करें। नीचे एक संकेत तैयार है।',
    };
  }

  return {
    status,
    weighted: round2(weighted),
    level,
    rationale,
    rubricVersion: rubric.version,
    weightsHash: rubric.hash ?? '',
    computedAt,
  };
}

function decideProvisional(
  rubric: Rubric,
  level: number,
  computedAt: string,
  reason: { en: string; hi: string },
): Decision {
  return {
    status: 'provisional',
    weighted: 0,
    level,
    rationale: reason,
    rubricVersion: rubric.version,
    weightsHash: rubric.hash ?? '',
    computedAt,
  };
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}
