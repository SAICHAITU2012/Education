import { randomUUID } from 'node:crypto';
import type {
  Attempt,
  AttemptRecord,
  AttemptSummary,
  CompetencyScore,
  Lang,
  PracticeMode,
  Rubric,
  Scenario,
  ScorerEngine,
  Session,
  TeacherState,
  Turn,
} from '../core/types.js';
import { evaluateAttempt, normalizeScorerOutput } from '../core/scoring.js';
import { applyAttempt, applyLevelUp, emptyTeacherState, type LevelUpResult } from '../core/progression.js';
import { availableAtLevel, entryLevel, reconcileLevel, selectNextScenario, scenariosForProfile } from '../core/selection.js';
import { mockStudentTurn } from '../llm/mock/student.js';
import { MockClient } from '../llm/mock/index.js';
import type { LoadedPack } from '../content/schema.js';
import type { LlmRuntime } from '../llm/index.js';
import type {
  ProfileRequest,
  ScoreRequest,
  ScoreResponse,
  StartSessionRequest,
  StartSessionResponse,
  StateResponse,
  SyncResponse,
  TurnResponse,
} from '../shared/api.js';
import { HttpError } from './http.js';
import type { Store } from './store.js';

const SESSION_TTL_MS = 2 * 60 * 60 * 1000;
const NO_LEVEL_UP: LevelUpResult = { leveledUp: false, from: 0, to: 0, passes: 0, distinct: 0 };

/**
 * The rehearsal orchestrator: simulate → score → verify → decide → progress.
 *
 * It is deliberately the only place that knows about sessions. The decision
 * layer remains pure; this class supplies level, content and persistence.
 */
export class Orchestrator {
  private readonly sessions = new Map<string, Session>();
  private readonly mock = new MockClient();

  constructor(
    private readonly store: Store,
    private readonly content: LoadedPack,
    private readonly llm: LlmRuntime,
    private readonly now: () => Date = () => new Date(),
  ) {}

  get contentPack(): LoadedPack {
    return this.content;
  }

  /* ------------------------------------------------------------------ */
  /* Teachers & profiles                                                */
  /* ------------------------------------------------------------------ */

  requireTeacher(teacherId: string): TeacherState {
    const state = this.store.getTeacher(teacherId);
    if (!state) {
      throw new HttpError(404, 'teacher_not_found', 'No practice profile exists for this device yet.');
    }
    return state;
  }

  upsertProfile(teacherId: string, body: ProfileRequest): TeacherState {
    const existing = this.store.getTeacher(teacherId);
    if (existing) {
      existing.profile.curriculum = body.curriculum;
      existing.profile.language = body.language;
      const reconciled = reconcileLevel(this.content.scenarios, existing);
      if (reconciled !== existing.profile.currentLevel) {
        existing.profile.currentLevel = reconciled;
        existing.levelHistory[reconciled] = this.now().toISOString();
      }
      this.store.upsertTeacher(existing);
      return existing;
    }
    const startLevel = entryLevel(this.content.scenarios, body.curriculum);
    const state = emptyTeacherState({
      id: teacherId,
      createdAt: this.now().toISOString(),
      curriculum: body.curriculum,
      language: body.language,
      currentLevel: startLevel,
    });
    state.levelHistory[startLevel] = this.now().toISOString();
    this.store.upsertTeacher(state);
    return state;
  }

  deleteTeacher(teacherId: string): { removedAttempts: number } {
    this.requireTeacher(teacherId);
    for (const [id, session] of this.sessions) {
      if (session.teacherId === teacherId) this.sessions.delete(id);
    }
    return this.store.deleteTeacher(teacherId);
  }

  state(teacherId: string): StateResponse {
    const state = this.requireTeacher(teacherId);
    const attempts = this.store
      .listRecords(teacherId)
      .slice(0, 25)
      .map((record) => this.summarize(record));
    return {
      state,
      attempts,
      nextScenario: selectNextScenario(this.content.scenarios, state, state.profile.currentLevel),
    };
  }

  /* ------------------------------------------------------------------ */
  /* Rehearsal sessions                                                 */
  /* ------------------------------------------------------------------ */

  startSession(teacherId: string, body: StartSessionRequest): StartSessionResponse {
    const state = this.requireTeacher(teacherId);
    this.pruneSessions();

    let scenario: Scenario | null = null;
    if (body.scenarioId) {
      scenario = this.content.scenarios.find((s) => s.id === body.scenarioId) ?? null;
      if (!scenario) throw new HttpError(404, 'scenario_not_found', 'That scenario is not in this content pack.');
    } else {
      scenario = selectNextScenario(this.content.scenarios, state, state.profile.currentLevel);
    }
    if (!scenario) {
      throw new HttpError(409, 'no_content', 'No scenario is available for this class and subject yet.');
    }

    const mode: PracticeMode = body.mode ?? 'online';
    const opening: Turn = {
      role: 'student',
      text: pickLocalized(scenario.studentPersona.opening, state.profile.language),
      ts: this.now().getTime(),
    };
    const session: Session = {
      id: `s_${randomUUID()}`,
      teacherId,
      scenarioId: scenario.id,
      scenarioVersion: scenario.version,
      level: scenario.level,
      mode,
      status: 'active',
      turns: [opening],
      createdAt: this.now().toISOString(),
      updatedAt: this.now().toISOString(),
      done: false,
      lastEngine: this.llm.engine,
    };
    this.sessions.set(session.id, session);

    return {
      session: clone(session),
      scenario,
      opening: clone(opening),
      nextScenario: selectNextScenario(this.content.scenarios, state, state.profile.currentLevel),
    };
  }

  async submitTurn(
    sessionId: string,
    teacherId: string,
    text: string,
    transport: 'voice' | 'text' = 'voice',
  ): Promise<TurnResponse> {
    const session = this.requireSession(sessionId, teacherId);
    if (session.status !== 'active' || session.done) {
      throw new HttpError(409, 'session_closed', 'This rehearsal has already ended. Review the transcript to score it.');
    }
    const scenario = this.scenarioFor(session);
    const teacherTurn: Turn = { role: 'teacher', text: text.trim(), ts: this.now().getTime(), transport };
    session.turns.push(teacherTurn);

    let reply: { text: string; done: boolean };
    let engine: ScorerEngine = 'mock';
    try {
      if (session.mode === 'offline') {
        reply = mockStudentTurn(scenario, session.turns, toRoleplayLang(this.teacherLanguage(teacherId)));
        engine = 'mock';
      } else {
        reply = await this.llm.client.studentTurn({
          scenario,
          turns: session.turns,
          lang: this.teacherLanguage(teacherId),
        });
        engine = this.llm.engine;
      }
    } catch (err) {
      // The turn is not lost: roll the transcript back to its pre-teacher state.
      session.turns.pop();
      throw new HttpError(
        502,
        'student_unavailable',
        'The simulated student could not respond. Your words are safe — please try again.',
        { cause: err instanceof Error ? err.message.slice(0, 200) : 'unknown' },
      );
    }

    const clean = reply.text.trim().slice(0, 600);
    let studentTurn: Turn | null = null;
    if (clean) {
      studentTurn = { role: 'student', text: clean, ts: this.now().getTime() };
      session.turns.push(studentTurn);
    }

    const studentCount = session.turns.filter((t) => t.role === 'student').length;
    session.done = Boolean(reply.done) || studentCount >= scenario.studentPersona.bounds.maxStudentTurns;
    session.status = session.done ? 'review' : 'active';
    session.updatedAt = this.now().toISOString();
    session.lastEngine = engine;

    return {
      session: clone(session),
      studentTurn: studentTurn ? clone(studentTurn) : null,
      done: session.done,
      engine,
    };
  }

  async scoreSession(
    sessionId: string,
    teacherId: string,
    body: ScoreRequest,
  ): Promise<ScoreResponse> {
    const session = this.requireSession(sessionId, teacherId);
    if (!body.heardCorrectly) {
      throw new HttpError(
        400,
        'transcript_not_confirmed',
        'Confirm that the transcript reflects what you said before scoring.',
      );
    }
    if (session.status === 'scored') {
      const existing = this.store.getRecord(this.findRecordIdForSession(session));
      if (existing) return this.existingScoreResponse(existing, teacherId);
    }

    const scenario = this.scenarioFor(session);
    const turns = body.turns ? sanitizeTurns(body.turns) : session.turns;
    if (!turns.some((t) => t.role === 'teacher')) {
      throw new HttpError(400, 'no_teacher_turns', 'There is nothing to score — no teacher turns yet.');
    }

    const attempt: Attempt = {
      id: `a_${randomUUID()}`,
      teacherId,
      scenarioId: scenario.id,
      scenarioVersion: scenario.version,
      rubricId: this.content.rubric.id,
      rubricVersion: this.content.rubric.version,
      turns,
      mode: session.mode,
      clientCreatedAt: this.now().toISOString(),
      heardCorrectly: true,
    };

    const record = await this.scoreAndStore(attempt, scenario);
    session.status = 'scored';
    session.turns = turns;
    session.updatedAt = this.now().toISOString();
    session.attemptId = record.attempt.id;

    const state = this.store.getTeacher(teacherId)!;
    return {
      record,
      decision: record.decision,
      state,
      levelUp: this.lastLevelUp,
      nextScenario: selectNextScenario(this.content.scenarios, state, state.profile.currentLevel),
      verified: record.verified,
      engine: record.score.engine,
    };
  }

  /* ------------------------------------------------------------------ */
  /* Offline sync                                                       */
  /* ------------------------------------------------------------------ */

  async sync(teacherId: string, attempts: Attempt[]): Promise<SyncResponse> {
    const state = this.requireTeacher(teacherId);
    const accepted: AttemptRecord[] = [];
    const duplicates: string[] = [];
    const rejected: SyncResponse['rejected'] = [];
    const seen = new Set<string>();

    for (const incoming of attempts) {
      if (seen.has(incoming.id)) {
        rejected.push({ id: incoming.id, reason: 'duplicate' });
        continue;
      }
      seen.add(incoming.id);

      if (incoming.teacherId !== teacherId) {
        rejected.push({ id: incoming.id, reason: 'foreign-teacher' });
        continue;
      }
      if (incoming.heardCorrectly === false) {
        rejected.push({ id: incoming.id, reason: 'invalid' });
        continue;
      }

      const existing = this.store.getRecord(incoming.id);
      if (existing) {
        if (existing.attempt.teacherId === teacherId) duplicates.push(incoming.id);
        else rejected.push({ id: incoming.id, reason: 'foreign-teacher' });
        continue;
      }

      const scenario = this.content.scenarios.find((s) => s.id === incoming.scenarioId);
      if (
        !scenario ||
        scenario.version !== incoming.scenarioVersion ||
        incoming.rubricId !== this.content.rubric.id ||
        incoming.rubricVersion !== this.content.rubric.version
      ) {
        rejected.push({ id: incoming.id, reason: 'invalid' });
        continue;
      }

      try {
        const record = await this.scoreAndStore(
          {
            ...incoming,
            id: incoming.id,
            teacherId,
            turns: sanitizeTurns(incoming.turns),
            heardCorrectly: true,
            mode: incoming.mode ?? 'offline',
          },
          scenario,
        );
        accepted.push(record);
      } catch (err) {
        console.error('[abhyas] sync attempt failed:', incoming.id, err);
        rejected.push({ id: incoming.id, reason: 'invalid' });
      }
    }

    const fresh = this.store.getTeacher(teacherId) ?? state;
    return {
      accepted,
      duplicates,
      rejected,
      state: fresh,
      nextScenario: selectNextScenario(this.content.scenarios, fresh, fresh.profile.currentLevel),
    };
  }

  /* ------------------------------------------------------------------ */
  /* Scoring                                                            */
  /* ------------------------------------------------------------------ */

  private lastLevelUp: LevelUpResult = NO_LEVEL_UP;

  private async scoreAndStore(attempt: Attempt, scenario: Scenario): Promise<AttemptRecord> {
    this.lastLevelUp = NO_LEVEL_UP;
    const rubric = this.content.rubric;
    let score;
    try {
      const raw = await this.llm.client.scoreAttempt({ scenario, attempt, rubric });
      score = normalizeScorerOutput(raw, scenario.competencies);
    } catch (err) {
      // A cloud outage must never lose a rehearsal or block a sync. The mock
      // engine is the same contract and its output is still evidence-verified.
      console.warn('[abhyas] scorer unavailable, using deterministic engine:', String(err).slice(0, 200));
      const raw = await this.mock.scoreAttempt({ scenario, attempt, rubric });
      score = normalizeScorerOutput(raw, scenario.competencies);
    }

    const decision = evaluateAttempt({
      score,
      attempt,
      rubric,
      level: scenario.level,
      requiredCompetencies: scenario.competencies,
      computedAt: this.now().toISOString(),
    });

    const record: AttemptRecord = {
      attempt: { ...attempt, heardCorrectly: true },
      score,
      decision,
      verified: true,
      syncedAt: this.now().toISOString(),
    };

    this.store.addRecord(record);

    const before = this.store.getTeacher(attempt.teacherId);
    if (!before) throw new HttpError(404, 'teacher_not_found', 'Teacher disappeared while scoring.');
    const next = applyAttempt(before, record, scenario.level, this.now().toISOString());

    if (record.decision.status === 'pass') {
      const hasNextLevel = scenariosForProfile(this.content.scenarios, next).some(
        (s) => s.level === scenario.level + 1 && !s.holdout,
      );
      if (hasNextLevel) {
        this.lastLevelUp = applyLevelUp(
          next,
          scenario.level,
          rubric.decision,
          this.now().toISOString(),
          availableAtLevel(this.content.scenarios, next, scenario.level),
        );
      }
    }
    this.store.upsertTeacher(next);
    return record;
  }

  /* ------------------------------------------------------------------ */
  /* Helpers                                                            */
  /* ------------------------------------------------------------------ */

  private scenarioFor(session: Session): Scenario {
    const scenario = this.content.scenarios.find((s) => s.id === session.scenarioId);
    if (!scenario) throw new HttpError(409, 'scenario_missing', 'This scenario is no longer in the content pack.');
    return scenario;
  }

  private requireSession(sessionId: string, teacherId: string): Session {
    const session = this.sessions.get(sessionId);
    if (!session) throw new HttpError(404, 'session_not_found', 'This rehearsal session has expired. Start a new one.');
    if (session.teacherId !== teacherId) {
      throw new HttpError(403, 'session_forbidden', 'This session belongs to another device.');
    }
    return session;
  }

  private teacherLanguage(teacherId: string): Lang {
    return this.store.getTeacher(teacherId)?.profile.language ?? 'hi';
  }

  private summarize(record: AttemptRecord): AttemptSummary {
    const scenario = this.content.scenarios.find((s) => s.id === record.attempt.scenarioId);
    return {
      id: record.attempt.id,
      scenarioId: record.attempt.scenarioId,
      scenarioTitle: scenario?.title ?? { en: record.attempt.scenarioId, hi: record.attempt.scenarioId },
      level: scenario?.level ?? record.decision.level,
      status: record.decision.status,
      weighted: record.decision.weighted,
      createdAt: record.attempt.clientCreatedAt,
      verified: record.verified,
      engine: record.score.engine,
    };
  }

  private findRecordIdForSession(session: Session): string {
    return session.attemptId ?? '';
  }

  private existingScoreResponse(record: AttemptRecord, teacherId: string): ScoreResponse {
    const state = this.requireTeacher(teacherId);
    return {
      record,
      decision: record.decision,
      state,
      levelUp: NO_LEVEL_UP,
      nextScenario: selectNextScenario(this.content.scenarios, state, state.profile.currentLevel),
      verified: record.verified,
      engine: record.score.engine,
    };
  }

  private pruneSessions(): void {
    const cutoff = this.now().getTime() - SESSION_TTL_MS;
    for (const [id, session] of this.sessions) {
      if (session.status === 'scored' || new Date(session.updatedAt).getTime() < cutoff) {
        this.sessions.delete(id);
      }
    }
  }
}

function pickLocalized(text: { en: string; hi: string }, lang: Lang): string {
  return lang === 'hi' ? text.hi : text.en;
}

function toRoleplayLang(lang: Lang): 'hi' | 'en' {
  return lang === 'hi' ? 'hi' : 'en';
}

function sanitizeTurns(turns: Turn[]): Turn[] {
  return turns.map((t) => ({
    role: t.role,
    text: String(t.text ?? '').slice(0, 4000),
    ts: Number.isFinite(t.ts) ? t.ts : Date.now(),
    ...(t.transport ? { transport: t.transport } : {}),
  }));
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

/** Exported for seed/calibration scripts that need the same normalization. */
export function normalizeEvidenceQuotes(scores: CompetencyScore[]): CompetencyScore[] {
  return scores.map((s) => ({ ...s, evidence: s.evidence.map((e) => ({ ...e })) }));
}

export type { Rubric };
