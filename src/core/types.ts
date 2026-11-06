/**
 * Abhyas core contracts.
 *
 * Design principles (from the SFIC submission, hardened by research):
 *  1. Humans set the standard  — rubrics are expert-owned, versioned, hash-pinned files.
 *     The LLM can never invent criteria; it may only score against what is here.
 *  2. Persona isolation        — the student who challenges you is never the one who
 *     grades you. Student context and scorer context are built by separate functions
 *     and enforced by tests to never share hidden state.
 *  3. Evidence-cited scoring   — every competency score must cite verbatim quotes
 *     from the teacher's own transcript. Core re-verifies every quote (anti-
 *     hallucination); unverified evidence lowers confidence and can force abstention.
 *  4. Code decides             — weighted scoring, floors, thresholds and level-ups
 *     are pure deterministic functions over the score + versioned weights. Same
 *     attempt, same result — online or offline, cloud or on-device.
 */

export type Lang = 'hi' | 'en' | 'kn' | 'ta' | 'te' | 'ml';

/** Languages the V0 content packs can actually roleplay (en + hi localizations). */
export const PRACTICE_LANGS: Lang[] = ['hi', 'en'];

export type ScorerEngine = 'mock' | 'openai-compat' | 'anthropic';

export type CompetencyId = 'accuracy' | 'clarity' | 'misconceptions' | 'questioning';

export const COMPETENCY_IDS: CompetencyId[] = [
  'accuracy',
  'clarity',
  'misconceptions',
  'questioning',
];

export type LocalizedText = { en: string; hi: string };

export type Band = 'met' | 'partial' | 'missing';

/** One competency in the expert rubric. Aligns to NPST (NCTE 2023) and World Bank TEACH. */
export interface Competency {
  id: CompetencyId;
  name: LocalizedText;
  description: LocalizedText;
  /** Observable indicators the scorer looks for (not invented by the model). */
  indicators: LocalizedText[];
  /** Reference into the standards framework, e.g. "NPST 3.2 (Professional Practice)". */
  npstRef: string;
  teachRef: string;
  /** Critical competencies carry a floor: you cannot pass an attempt if one is below floor. */
  critical: boolean;
}

export type LevelWeights = Partial<Record<CompetencyId, number>>;

export interface DecisionPolicy {
  /** Weighted score at or above this passes the attempt. */
  passThreshold: number;
  /** Weighted score at or above this (but below pass) → retry same scenario family. */
  retryThreshold: number;
  /** Critical competencies must individually clear this floor to pass. */
  competencyFloor: number;
  /** Below retryThreshold → redo with a hint (not counted as a pass attempt). */
  levelUp: {
    /** Passes required at the current level before levelling up. */
    passesRequired: number;
    /** Those passes must span at least this many distinct scenarios. */
    distinctScenariosRequired: number;
  };
  /** Overall scorer confidence below this → attempt is provisional (no level movement). */
  minConfidence: number;
  /** If fewer than this fraction of relevant competencies have evidence → provisional. */
  minEvidenceCoverage: number;
}

/** The expert-owned, versioned rubric. Hash-pinned on load. */
export interface Rubric {
  id: string;
  /** Semver of the rubric content itself. */
  version: string;
  competencies: Competency[];
  /** Weights per mastery level. Weights at a level must sum to ~1. */
  weightsByLevel: Record<number, LevelWeights>;
  decision: DecisionPolicy;
  /** SHA-256 over canonical JSON, computed on load. Displayed with every attempt. */
  hash?: string;
}

export interface ScenarioBounds {
  /** Student pushes back at most this many times before the scenario wraps. */
  maxStudentTurns: number;
  allowedTopics: string[];
  /** The student must never say these things (e.g. never reveals the correct answer). */
  mustNotReveal: string[];
  /** When the student concedes or the roleplay ends. */
  exitCondition: string;
}

export interface MisconceptionSpec {
  id: string;
  /** The child's stated belief, e.g. "a − b = b − a". */
  belief: LocalizedText;
  /** Escalating pushback lines when the teacher does not handle the belief. */
  resistance: LocalizedText[];
  /** Partial concession when the teacher handles it well. */
  concession: LocalizedText;
}

export interface Scenario {
  id: string;
  version: string;
  pack: string;
  level: 1 | 2 | 3 | 4 | 5;
  language: Lang;
  curriculum: {
    class: 1 | 2 | 3;
    subject: 'maths' | 'hindi';
    topic: string;
    ncertRef?: string;
  };
  /** Which competencies this scenario is designed to exercise. */
  competencies: CompetencyId[];
  title: LocalizedText;
  studentPersona: {
    name: string;
    age: number;
    traits: string[];
    opening: LocalizedText;
    misconception?: MisconceptionSpec;
    bounds: ScenarioBounds;
  };
  /**
   * Deterministic detection hints for the on-device/mock engine (and for golden
   * calibration). The cloud scorer reads the rubric, not these.
   */
  detection: {
    /** Sentences containing any of these → teacher asked an open question. */
    questionMarkers: string[];
    /** Phrases indicating the teacher surfaced the child's belief first. */
    surfaceMarkers: string[];
    /** Phrases indicating the teacher addressed/corrected the belief. */
    correctMarkers: string[];
    /** Concrete, child-friendly example words that count as clarity anchors. */
    exampleWords: string[];
    /** Age-inappropriate jargon that hurts clarity for this class level. */
    jargonBlacklist: string[];
    /** Substrings that would constitute a factual error in this scenario. */
    wrongFactMarkers: string[];
    /** Substrings that confirm the correct fact. */
    correctFactMarkers: string[];
  };
  expectedBehaviors: { competency: CompetencyId; behavior: LocalizedText }[];
  /** Transfer-test scenario: excluded from normal rotation, used for expert-blinded tests. */
  holdout?: boolean;
}

// ---------------------------------------------------------------------------
// Conversation + attempts
// ---------------------------------------------------------------------------

export type Role = 'student' | 'teacher' | 'system';

export interface Turn {
  role: Role;
  text: string;
  ts: number;
  /** Present on teacher turns confirmed via the transcript-review gate. */
  transport?: 'voice' | 'text';
}

/** Client-generated attempt — the unit of practice. Idempotent under sync. */
export interface Attempt {
  /** UUID generated on the device; server upserts by id (offline sync safe). */
  id: string;
  /** Pseudonymous teacher id, device-generated. Never a name or employee id. */
  teacherId: string;
  scenarioId: string;
  scenarioVersion: string;
  rubricId: string;
  rubricVersion: string;
  turns: Turn[];
  mode: 'online' | 'offline';
  clientCreatedAt: string;
  /** Teacher confirmed the transcript reflects what they said ("heard me correctly"). */
  heardCorrectly?: boolean;
}

export interface Evidence {
  quote: string;
  turnIndex: number;
  /** True when the quote was found verbatim (normalized) in the transcript by core. */
  verified: boolean;
  note?: LocalizedText;
}

export interface CompetencyScore {
  competency: CompetencyId;
  /** 0..1, scored in bands of 0.2 by the scorer contract. */
  score: number;
  /** 0..1 scorer confidence for this competency. */
  confidence: number;
  evidence: Evidence[];
  abstained: boolean;
  reason?: LocalizedText;
}

export interface ScorerOutput {
  attemptId: string;
  competencyScores: CompetencyScore[];
  summary: LocalizedText;
  suggestion: LocalizedText;
  overallConfidence: number;
  engine: ScorerEngine;
  rubricVersion: string;
  scoredAt: string;
}

export type DecisionStatus = 'pass' | 'retry' | 'redo' | 'provisional';

export interface Decision {
  status: DecisionStatus;
  /** Weighted score over non-abstained competencies. */
  weighted: number;
  level: number;
  rationale: LocalizedText;
  rubricVersion: string;
  weightsHash: string;
  computedAt: string;
}

/** A full record as stored server-side (and synced). */
export interface AttemptRecord {
  attempt: Attempt;
  score: ScorerOutput;
  decision: Decision;
  /** false for offline/local-LLM scores until re-verified by the cloud engine. */
  verified: boolean;
  syncedAt?: string;
}

// ---------------------------------------------------------------------------
// Teacher profile + progression (pseudonymous)
// ---------------------------------------------------------------------------

export interface LevelProgress {
  level: number;
  /** scenarioId → number of passes. */
  passesByScenario: Record<string, number>;
  attempts: number;
  lastAttemptAt?: string;
}

export interface CompetencyHealth {
  /** Exponential moving average of scores for this competency. */
  ema: number;
  n: number;
  updatedAt?: string;
}

export interface TeacherProfile {
  id: string;
  createdAt: string;
  curriculum: { class: 1 | 2 | 3; subject: 'maths' | 'hindi' };
  language: Lang;
  currentLevel: number;
}

export interface TeacherState {
  profile: TeacherProfile;
  progress: Record<number, LevelProgress>;
  competencyHealth: Record<CompetencyId, CompetencyHealth>;
  /** level → date the teacher reached it. */
  levelHistory: Record<number, string>;
}

// ---------------------------------------------------------------------------
// Cohort analytics (privacy: k-anonymised, never individual)
// ---------------------------------------------------------------------------

export interface CohortCell {
  week: string; // ISO week label, e.g. "2026-W44"
  competency: CompetencyId;
  n: number;
  meanScore: number;
  /** Distinct pseudonymous teachers in the cell (never exposed below k). */
  teachers: number;
}

export interface CohortDashboard {
  cells: CohortCell[];
  /** k-anonymity threshold used for suppression. */
  k: number;
  minTeachers: number;
  totalAttempts: number;
  /** Attempts included in at least one published cell. */
  includedAttempts: number;
  /** Cells withheld because they were too small to anonymise. */
  suppressedCells: number;
  contributingTeachers: number | null;
  weeks: string[];
  generatedAt: string;
  note: LocalizedText;
}

// ---------------------------------------------------------------------------
// Sessions (server-side rehearsal state)
// ---------------------------------------------------------------------------

export type SessionStatus = 'active' | 'review' | 'scored';
export type PracticeMode = 'online' | 'offline';

/**
 * A live rehearsal. Sessions are short-lived server state; the durable unit is
 * the AttemptRecord. Every student turn stays inside the scenario's bounds.
 */
export interface Session {
  id: string;
  teacherId: string;
  scenarioId: string;
  scenarioVersion: string;
  level: number;
  mode: PracticeMode;
  status: SessionStatus;
  turns: Turn[];
  createdAt: string;
  updatedAt: string;
  /** True when the student has wrapped the roleplay or the turn budget is spent. */
  done: boolean;
  lastEngine: ScorerEngine;
  /** Set once the session has been scored (idempotent retries). */
  attemptId?: string;
}

/** A compact attempt row for history lists (no full transcript). */
export interface AttemptSummary {
  id: string;
  scenarioId: string;
  scenarioTitle: LocalizedText;
  level: number;
  status: DecisionStatus;
  weighted: number;
  createdAt: string;
  verified: boolean;
  engine: ScorerEngine;
}

/** Full export for a teacher — their data, their right. */
export interface TeacherExport {
  exportedAt: string;
  profile: TeacherProfile;
  state: TeacherState;
  attempts: AttemptRecord[];
}

