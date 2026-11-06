import type {
  Attempt,
  AttemptRecord,
  AttemptSummary,
  CohortDashboard,
  Decision,
  Lang,
  LocalizedText,
  Rubric,
  Scenario,
  ScorerEngine,
  Session,
  TeacherState,
  Turn,
} from '../core/types.js';

/**
 * The HTTP contract shared by the server and the web client.
 * Keep this file dependency-free so both bundles can import it.
 */

export interface ContentPayload {
  rubric: Rubric;
  scenarios: Scenario[];
  packVersion: string;
}

export interface HealthPayload {
  ok: true;
  service: 'abhyas';
  version: string;
  engine: ScorerEngine;
  mode: 'mock' | 'cloud';
  contentHash: string;
  rubricVersion: string;
  scenarios: number;
  now: string;
}

export interface ProfileRequest {
  curriculum: { class: 1 | 2 | 3; subject: 'maths' | 'hindi' };
  language: Lang;
}

export interface StartSessionRequest {
  scenarioId?: string;
  mode?: 'online' | 'offline';
}

export interface StartSessionResponse {
  session: Session;
  scenario: Scenario;
  opening: Turn | null;
  nextScenario: Scenario | null;
}

export interface TurnRequest {
  text: string;
  transport?: 'voice' | 'text';
}

export interface TurnResponse {
  session: Session;
  studentTurn: Turn | null;
  done: boolean;
  engine: ScorerEngine;
}

export interface ScoreRequest {
  /** Teacher confirmed the transcript matches what they said. Required false. */
  heardCorrectly: boolean;
  /** Reviewed (possibly edited) transcript. Teacher turns are authoritative. */
  turns?: Turn[];
  /** Optional self-reported audio quality, used only for the feedback note. */
  audioQuality?: 'clear' | 'unclear';
}

export interface LevelUpPayload {
  leveledUp: boolean;
  from: number;
  to: number;
  passes: number;
  distinct: number;
}

export interface ScoreResponse {
  record: AttemptRecord;
  decision: Decision;
  state: TeacherState;
  levelUp: LevelUpPayload;
  nextScenario: Scenario | null;
  verified: boolean;
  engine: ScorerEngine;
}

export interface SyncRequest {
  attempts: Attempt[];
}

export interface SyncRejection {
  id: string;
  reason: 'invalid' | 'duplicate' | 'foreign-teacher' | 'too-large';
}

export interface SyncResponse {
  accepted: AttemptRecord[];
  duplicates: string[];
  rejected: SyncRejection[];
  state: TeacherState;
  nextScenario: Scenario | null;
}

export interface StateResponse {
  state: TeacherState;
  attempts: AttemptSummary[];
  nextScenario: Scenario | null;
}

export interface UpdateProfileResponse {
  state: TeacherState;
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    requestId?: string;
    details?: unknown;
  };
}

export interface CohortResponse extends CohortDashboard {
  /** Present for the client to explain the k-anonymity rule in-language. */
  label: LocalizedText;
}
