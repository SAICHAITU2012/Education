import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getContentPack } from '../src/content/index.js';
import type { Attempt, Turn } from '../src/core/types.js';
import { MockClient } from '../src/llm/mock/index.js';
import { makeTranscript, mulberry32 } from '../src/server/seed.js';
import { createApp } from '../src/server/app.js';
import { Store } from '../src/server/store.js';
import type { ScoreResponse, StartSessionResponse, SyncResponse } from '../src/shared/api.js';

const pack = await getContentPack();
const store = new Store();
const app = createApp({
  store,
  content: pack,
  llm: { client: new MockClient(), engine: 'mock', mode: 'mock', fallback: true },
  // Fixed clock keeps ISO-week analytics deterministic.
  now: () => new Date('2026-11-02T09:00:00.000Z'),
});

let server: Server;
let base: string;
const teacherId = 't_server_00000000000000000000000000001';
const otherTeacher = 't_server_00000000000000000000000000002';

beforeAll(async () => {
  await new Promise<void>((resolve) => {
    server = app.listen(0, '127.0.0.1', () => resolve());
  });
  const address = server.address() as AddressInfo;
  base = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await store.flush();
});

async function httpCall<T>(
  baseUrl: string,
  path: string,
  init: RequestInit & { teacher?: string } = {},
): Promise<{ status: number; body: T }> {
  const headers = new Headers(init.headers);
  if (init.body) headers.set('content-type', 'application/json');
  if (init.teacher) headers.set('x-teacher-id', init.teacher);
  const response = await fetch(`${baseUrl}${path}`, { ...init, headers });
  const text = await response.text();
  return { status: response.status, body: (text ? JSON.parse(text) : null) as T };
}

async function call<T>(
  path: string,
  init: RequestInit & { teacher?: string } = {},
): Promise<{ status: number; body: T }> {
  return httpCall(base, path, init);
}

const goodTurn =
  'पहले बताओ तुमने कैसे सोचा? जैसे गोली से एक-एक करके दिखाऊँ, फिर मिलकर देखें।';

describe('HTTP API', () => {
  it('reports health and pinned content', async () => {
    const health = await call<{ ok: boolean; contentHash: string; scenarios: number }>('/api/health');
    expect(health.status).toBe(200);
    expect(health.body.ok).toBe(true);
    expect(health.body.contentHash).toBe(pack.rubric.hash);
    expect(health.body.scenarios).toBe(pack.scenarios.length);

    const content = await call<{ rubric: { id: string }; packVersion: string }>('/api/content');
    expect(content.status).toBe(200);
    expect(content.body.rubric.id).toBe(pack.rubric.id);
    expect(content.body.packVersion).toBe(pack.packVersion);
  });

  it('creates a pseudonymous profile without personal data', async () => {
    const response = await call<{ state: { profile: { id: string; currentLevel: number } } }>(
      `/api/teachers/${teacherId}`,
      {
        method: 'PUT',
        body: JSON.stringify({ curriculum: { class: 3, subject: 'maths' }, language: 'hi' }),
      },
    );
    expect(response.status).toBe(200);
    expect(response.body.state.profile.id).toBe(teacherId);
    expect(response.body.state.profile.currentLevel).toBe(1);

    const state = await call<{ state: unknown; attempts: unknown[]; nextScenario: { id: string } }>(
      `/api/teachers/${teacherId}/state`,
      { teacher: teacherId },
    );
    expect(state.status).toBe(200);
    expect(state.body.attempts).toEqual([]);
    expect(state.body.nextScenario.id).toMatch(/^maths-c3-l1-/);
  });

  it('rejects missing teacher headers and invalid profiles', async () => {
    const missing = await call<{ error: { code: string } }>('/api/sessions', {
      method: 'POST',
      body: JSON.stringify({}),
    });
    expect(missing.status).toBe(401);
    expect(missing.body.error.code).toBe('missing_teacher');

    const invalid = await call<{ error: { code: string; details: unknown[] } }>(
      `/api/teachers/${teacherId}`,
      {
        method: 'PUT',
        body: JSON.stringify({ curriculum: { class: 9, subject: 'science' }, language: 'hi' }),
      },
    );
    expect(invalid.status).toBe(400);
    expect(invalid.body.error.code).toBe('invalid_request');
    expect(invalid.body.error.details.length).toBeGreaterThan(0);
  });

  it('runs a full rehearsal: session → turn → score', async () => {
    const started = await call<StartSessionResponse>('/api/sessions', {
      method: 'POST',
      teacher: teacherId,
      body: JSON.stringify({ mode: 'online' }),
    });
    expect(started.status).toBe(201);
    expect(started.body.opening?.role).toBe('student');
    expect(started.body.session.turns).toHaveLength(1);

    const sessionId = started.body.session.id;
    const turn = await call<{ studentTurn: Turn | null; done: boolean }>(
      `/api/sessions/${sessionId}/turns`,
      { method: 'POST', teacher: teacherId, body: JSON.stringify({ text: goodTurn, transport: 'voice' }) },
    );
    expect(turn.status).toBe(200);
    expect(turn.body.studentTurn?.role).toBe('student');

    // The teacher must confirm what was heard before scoring.
    const unconfirmed = await call<{ error: { code: string } }>(
      `/api/sessions/${sessionId}/score`,
      { method: 'POST', teacher: teacherId, body: JSON.stringify({ heardCorrectly: false }) },
    );
    expect(unconfirmed.status).toBe(400);
    expect(unconfirmed.body.error.code).toBe('transcript_not_confirmed');

    const scored = await call<ScoreResponse>(`/api/sessions/${sessionId}/score`, {
      method: 'POST',
      teacher: teacherId,
      body: JSON.stringify({ heardCorrectly: true }),
    });
    expect(scored.status).toBe(200);
    expect(['pass', 'retry', 'redo', 'provisional']).toContain(scored.body.decision.status);
    expect(scored.body.record.verified).toBe(true);
    expect(scored.body.record.attempt.id).toMatch(/^a_/);
    expect(scored.body.record.score.competencyScores.length).toBeGreaterThan(0);
    for (const cs of scored.body.record.score.competencyScores) {
      for (const evidence of cs.evidence) expect(evidence.verified).toBe(true);
    }

    // Retrying the score endpoint is idempotent (same attempt id, no double count).
    const again = await call<ScoreResponse>(`/api/sessions/${sessionId}/score`, {
      method: 'POST',
      teacher: teacherId,
      body: JSON.stringify({ heardCorrectly: true }),
    });
    expect(again.body.record.attempt.id).toBe(scored.body.record.attempt.id);

    const detail = await call<{ attempt: { id: string } }>(
      `/api/teachers/${teacherId}/attempts/${scored.body.record.attempt.id}`,
      { teacher: teacherId },
    );
    expect(detail.status).toBe(200);
    expect(detail.body.attempt.id).toBe(scored.body.record.attempt.id);

    // Another device must never read this attempt.
    const foreign = await call<{ error: { code: string } }>(
      `/api/teachers/${otherTeacher}/attempts/${scored.body.record.attempt.id}`,
      { teacher: otherTeacher },
    );
    expect(foreign.status).toBe(404);
  });

  it('refuses to score a session belonging to another device', async () => {
    await call(`/api/teachers/${otherTeacher}`, {
      method: 'PUT',
      body: JSON.stringify({ curriculum: { class: 1, subject: 'hindi' }, language: 'hi' }),
    });
    const started = await call<StartSessionResponse>('/api/sessions', {
      method: 'POST',
      teacher: teacherId,
      body: JSON.stringify({ mode: 'online' }),
    });
    const response = await call<{ error: { code: string } }>(
      `/api/sessions/${started.body.session.id}/score`,
      { method: 'POST', teacher: otherTeacher, body: JSON.stringify({ heardCorrectly: true }) },
    );
    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('session_forbidden');
  });

  it('syncs offline attempts idempotently and verifies them', async () => {
    const scenario = pack.scenarios.find(
      (s) => s.curriculum.class === 3 && s.curriculum.subject === 'maths' && s.level === 1,
    )!;
    const attempt: Attempt = {
      id: 'a_offline_0000000000000000000000000001',
      teacherId,
      scenarioId: scenario.id,
      scenarioVersion: scenario.version,
      rubricId: pack.rubric.id,
      rubricVersion: pack.rubric.version,
      turns: [
        { role: 'student', text: scenario.studentPersona.opening.hi, ts: 0 },
        { role: 'teacher', text: goodTurn, ts: 1, transport: 'voice' },
      ],
      mode: 'offline',
      clientCreatedAt: '2026-11-01T10:00:00.000Z',
      heardCorrectly: true,
    };

    const first = await call<SyncResponse>('/api/sync', {
      method: 'POST',
      teacher: teacherId,
      body: JSON.stringify({ attempts: [attempt] }),
    });
    expect(first.status).toBe(200);
    expect(first.body.accepted.map((r) => r.attempt.id)).toEqual([attempt.id]);
    expect(first.body.accepted[0]!.verified).toBe(true);

    const second = await call<SyncResponse>('/api/sync', {
      method: 'POST',
      teacher: teacherId,
      body: JSON.stringify({ attempts: [attempt] }),
    });
    expect(second.body.accepted).toEqual([]);
    expect(second.body.duplicates).toEqual([attempt.id]);

    // A teacher can never sync another teacher's attempt.
    const foreign = await call<SyncResponse>('/api/sync', {
      method: 'POST',
      teacher: otherTeacher,
      body: JSON.stringify({ attempts: [{ ...attempt, id: 'a_offline_0000000000000000000000000002' }] }),
    });
    expect(foreign.body.rejected[0]?.reason).toBe('foreign-teacher');

    // Stale rubric versions are refused, not silently re-scored.
    const stale = await call<SyncResponse>('/api/sync', {
      method: 'POST',
      teacher: teacherId,
      body: JSON.stringify({
        attempts: [{ ...attempt, id: 'a_offline_0000000000000000000000000003', rubricVersion: '0.0.1' }],
      }),
    });
    expect(stale.body.rejected[0]?.reason).toBe('invalid');
  });

  it('exports and deletes all of a teacher’s data', async () => {
    const exported = await call<{ profile: { id: string }; attempts: unknown[] }>(
      `/api/teachers/${teacherId}/export`,
      { teacher: teacherId },
    );
    expect(exported.status).toBe(200);
    expect(exported.body.profile.id).toBe(teacherId);
    expect(exported.body.attempts.length).toBeGreaterThan(0);

    const removed = await call<{ deleted: boolean; removedAttempts: number }>(
      `/api/teachers/${teacherId}`,
      { method: 'DELETE', teacher: teacherId },
    );
    expect(removed.status).toBe(200);
    expect(removed.body.deleted).toBe(true);
    expect(removed.body.removedAttempts).toBeGreaterThan(0);

    const gone = await call<{ error: { code: string } }>(`/api/teachers/${teacherId}/state`, {
      teacher: teacherId,
    });
    expect(gone.status).toBe(404);
    expect(gone.body.error.code).toBe('teacher_not_found');
  });

  it('serves a k-anonymised cohort with no identifiers', async () => {
    const cohort = await call<Record<string, unknown>>('/api/cohort?weeks=52&k=5');
    expect(cohort.status).toBe(200);
    const serialized = JSON.stringify(cohort.body);
    expect(serialized).not.toMatch(/t_server_|teacher_/);
    expect(serialized).not.toContain('turns');
    expect(cohort.body.k).toBe(5);
    expect(cohort.body.minTeachers).toBeGreaterThanOrEqual(3);
    expect(Array.isArray(cohort.body.cells)).toBe(true);
  });
});

describe('concurrent scoring isolation (TD-02 regression)', () => {
  // A second app instance whose scorer can be parked mid-flight, so two
  // teachers' scorings interleave in a fixed order instead of relying on timing.
  const raceStore = new Store();
  let armed = false;
  const parked: Array<() => void> = [];
  const inner = new MockClient();
  const gated = {
    name: 'mock' as const,
    studentTurn: (input: Parameters<typeof inner.studentTurn>[0]) => inner.studentTurn(input),
    async scoreAttempt(input: Parameters<typeof inner.scoreAttempt>[0]) {
      if (armed) await new Promise<void>((resolve) => parked.push(resolve));
      return inner.scoreAttempt(input);
    },
  };
  const raceApp = createApp({
    store: raceStore,
    content: pack,
    llm: { client: gated, engine: 'mock', mode: 'mock', fallback: true },
    now: () => new Date('2026-11-02T09:00:00.000Z'),
  });

  let raceServer: Server;
  let raceBase: string;
  const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 5));

  beforeAll(async () => {
    await new Promise<void>((resolve) => {
      raceServer = raceApp.listen(0, '127.0.0.1', () => resolve());
    });
    raceBase = `http://127.0.0.1:${(raceServer.address() as AddressInfo).port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => raceServer.close(() => resolve()));
    await raceStore.flush();
  });

  it('returns each teacher their own levelUp when two scorings overlap', async () => {
    const teacherA = 't_race_a_0000000000000000000000000001';
    const teacherB = 't_race_b_0000000000000000000000000002';
    for (const id of [teacherA, teacherB]) {
      const profile = await httpCall(raceBase, `/api/teachers/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ curriculum: { class: 3, subject: 'maths' }, language: 'hi' }),
      });
      expect(profile.status).toBe(200);
    }

    // Teacher A earns one prior pass on an L1 scenario, so the concurrent pass
    // below is their second distinct-scenario pass — a genuine level-up.
    const prior = pack.scenarios.find(
      (s) => s.curriculum.class === 3 && s.curriculum.subject === 'maths' && s.level === 1,
    )!;
    const priorAttempt: Attempt = {
      id: 'a_race_prior00000000000000000000000001',
      teacherId: teacherA,
      scenarioId: prior.id,
      scenarioVersion: prior.version,
      rubricId: pack.rubric.id,
      rubricVersion: pack.rubric.version,
      turns: makeTranscript(prior, 0.9, mulberry32(11)),
      mode: 'offline',
      clientCreatedAt: '2026-11-01T10:00:00.000Z',
      heardCorrectly: true,
    };
    const synced = await httpCall<SyncResponse>(raceBase, '/api/sync', {
      method: 'POST',
      teacher: teacherA,
      body: JSON.stringify({ attempts: [priorAttempt] }),
    });
    expect(synced.status).toBe(200);
    expect(synced.body.accepted[0]?.decision.status).toBe('pass');

    // Both start sessions; the session response names the scenario it chose.
    const startA = await httpCall<StartSessionResponse>(raceBase, '/api/sessions', {
      method: 'POST',
      teacher: teacherA,
      body: JSON.stringify({ mode: 'online' }),
    });
    const startB = await httpCall<StartSessionResponse>(raceBase, '/api/sessions', {
      method: 'POST',
      teacher: teacherB,
      body: JSON.stringify({ mode: 'online' }),
    });
    expect(startA.status).toBe(201);
    expect(startB.status).toBe(201);
    const scenarioA = startA.body.scenario;
    const scenarioB = startB.body.scenario;
    expect(scenarioA.id).not.toBe(prior.id); // level-up needs two distinct scenarios

    // Arm the gate, park A inside its scorer, then let B join it there.
    armed = true;
    const pendingA = httpCall<ScoreResponse>(raceBase, `/api/sessions/${startA.body.session.id}/score`, {
      method: 'POST',
      teacher: teacherA,
      body: JSON.stringify({
        heardCorrectly: true,
        turns: makeTranscript(scenarioA, 0.9, mulberry32(13)),
      }),
    });
    while (parked.length < 1) await tick();
    const pendingB = httpCall<ScoreResponse>(raceBase, `/api/sessions/${startB.body.session.id}/score`, {
      method: 'POST',
      teacher: teacherB,
      body: JSON.stringify({
        heardCorrectly: true,
        turns: makeTranscript(scenarioB, 0.1, mulberry32(17)),
      }),
    });
    while (parked.length < 2) await tick();

    // Release both in one synchronous burst: A finishes scoring and stores its
    // level-up, B finishes right behind it, and only then does A's response get
    // built. With the old shared lastLevelUp field, A read B's NO_LEVEL_UP.
    for (const release of parked.splice(0)) release();
    armed = false;

    const [resA, resB] = await Promise.all([pendingA, pendingB]);
    expect(resA.status).toBe(200);
    expect(resB.status).toBe(200);
    expect(resA.body.decision.status).toBe('pass');
    expect(resB.body.decision.status).not.toBe('pass');
    expect(resA.body.levelUp.leveledUp).toBe(true);
    expect(resB.body.levelUp.leveledUp).toBe(false);
  });
});
