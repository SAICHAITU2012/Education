import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import cors from 'cors';
import express, { type Express } from 'express';
import type { CohortResponse, ContentPayload, HealthPayload } from '../shared/api.js';
import { buildCohort } from './privacy.js';
import {
  asyncHandler,
  attemptIdSchema,
  errorHandler,
  HttpError,
  notFound,
  profileSchema,
  rateLimit,
  requestLogger,
  scoreRequestSchema,
  startSessionSchema,
  syncRequestSchema,
  teacherIdSchema,
  turnRequestSchema,
} from './http.js';
import { Orchestrator } from './orchestrator.js';
import type { Store } from './store.js';
import type { LoadedPack } from '../content/schema.js';
import type { LlmRuntime } from '../llm/index.js';

export interface AppDeps {
  store: Store;
  content: LoadedPack;
  llm: LlmRuntime;
  now?: () => Date;
}

/**
 * Express app factory. Exported separately from the listener so tests can
 * start it on an ephemeral port without touching the real data file.
 */
export function createApp(deps: AppDeps): Express {
  const { store, content, llm } = deps;
  const orchestrator = new Orchestrator(store, content, llm, deps.now);
  const app = express();

  app.disable('x-powered-by');
  app.use((req, res, next) => {
    const id = randomUUID();
    res.locals.requestId = id;
    res.setHeader('x-request-id', id);
    next();
  });
  app.use(cors({ origin: true, methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'] }));
  app.use(express.json({ limit: '512kb' }));
  app.use(requestLogger);
  app.use('/api', rateLimit({ windowMs: 60_000, max: 180, name: 'API' }));
  const mlLimiter = rateLimit({ windowMs: 60_000, max: 40, name: 'rehearsal' });

  app.get('/api/health', (_req, res) => {
    const body: HealthPayload = {
      ok: true,
      service: 'abhyas',
      version: process.env.npm_package_version ?? '0.1.0',
      engine: llm.engine,
      mode: llm.mode,
      contentHash: content.rubric.hash ?? '',
      rubricVersion: content.rubric.version,
      scenarios: content.scenarios.length,
      now: (deps.now?.() ?? new Date()).toISOString(),
    };
    res.json(body);
  });

  app.get('/api/content', (_req, res) => {
    const body: ContentPayload = {
      rubric: content.rubric,
      scenarios: content.scenarios,
      packVersion: content.packVersion,
    };
    res.json(body);
  });

  app.get('/api/scenarios/:scenarioId', (req, res) => {
    const scenario = content.scenarios.find((s) => s.id === req.params.scenarioId);
    if (!scenario) throw new HttpError(404, 'scenario_not_found', 'No such scenario.');
    res.json(scenario);
  });

  /* ------------------------------------------------------------------ */
  /* Teacher profile & state                                            */
  /* ------------------------------------------------------------------ */

  app.put(
    '/api/teachers/:teacherId',
    asyncHandler(async (req, res) => {
      const teacherId = teacherIdSchema.parse(req.params.teacherId);
      const body = profileSchema.parse(req.body);
      const state = orchestrator.upsertProfile(teacherId, body);
      res.json({ state });
    }),
  );

  app.get(
    '/api/teachers/:teacherId/state',
    asyncHandler(async (req, res) => {
      const teacherId = teacherIdSchema.parse(req.params.teacherId);
      res.json(orchestrator.state(teacherId));
    }),
  );

  app.get(
    '/api/teachers/:teacherId/export',
    asyncHandler(async (req, res) => {
      const teacherId = teacherIdSchema.parse(req.params.teacherId);
      const state = orchestrator.requireTeacher(teacherId);
      res.json({
        exportedAt: (deps.now?.() ?? new Date()).toISOString(),
        profile: state.profile,
        state,
        attempts: store.listRecords(teacherId),
      });
    }),
  );

  app.get(
    '/api/teachers/:teacherId/attempts/:attemptId',
    asyncHandler(async (req, res) => {
      const teacherId = teacherIdSchema.parse(req.params.teacherId);
      const attemptId = attemptIdSchema.parse(req.params.attemptId);
      const record = store.getRecord(attemptId);
      if (!record || record.attempt.teacherId !== teacherId) {
        throw new HttpError(404, 'attempt_not_found', 'No such attempt for this device.');
      }
      res.json(record);
    }),
  );

  app.delete(
    '/api/teachers/:teacherId',
    asyncHandler(async (req, res) => {
      const teacherId = teacherIdSchema.parse(req.params.teacherId);
      const removed = orchestrator.deleteTeacher(teacherId);
      res.json({ deleted: true, ...removed });
    }),
  );

  /* ------------------------------------------------------------------ */
  /* Rehearsal                                                          */
  /* ------------------------------------------------------------------ */

  app.post(
    '/api/sessions',
    mlLimiter,
    asyncHandler(async (req, res) => {
      const teacherId = readTeacherHeader(req.header('x-teacher-id'));
      const body = startSessionSchema.parse(req.body ?? {});
      res.status(201).json(orchestrator.startSession(teacherId, body));
    }),
  );

  app.post(
    '/api/sessions/:sessionId/turns',
    mlLimiter,
    asyncHandler(async (req, res) => {
      const teacherId = readTeacherHeader(req.header('x-teacher-id'));
      const sessionId = String(req.params.sessionId);
      if (!/^s_[A-Za-z0-9-]{8,80}$/.test(sessionId)) {
        throw new HttpError(400, 'invalid_session', 'Invalid session id.');
      }
      const body = turnRequestSchema.parse(req.body);
      const result = await orchestrator.submitTurn(
        sessionId,
        teacherId,
        body.text,
        body.transport ?? 'voice',
      );
      res.json(result);
    }),
  );

  app.post(
    '/api/sessions/:sessionId/score',
    mlLimiter,
    asyncHandler(async (req, res) => {
      const teacherId = readTeacherHeader(req.header('x-teacher-id'));
      const sessionId = String(req.params.sessionId);
      if (!/^s_[A-Za-z0-9-]{8,80}$/.test(sessionId)) {
        throw new HttpError(400, 'invalid_session', 'Invalid session id.');
      }
      const body = scoreRequestSchema.parse(req.body);
      res.json(await orchestrator.scoreSession(sessionId, teacherId, body));
    }),
  );

  app.post(
    '/api/sync',
    mlLimiter,
    asyncHandler(async (req, res) => {
      const teacherId = readTeacherHeader(req.header('x-teacher-id'));
      const body = syncRequestSchema.parse(req.body);
      res.json(await orchestrator.sync(teacherId, body.attempts));
    }),
  );

  /* ------------------------------------------------------------------ */
  /* Privacy-preserving cohort analytics                                */
  /* ------------------------------------------------------------------ */

  app.get(
    '/api/cohort',
    asyncHandler(async (req, res) => {
      const k = clampInt(req.query.k, 2, 50, 5);
      const weeks = clampInt(req.query.weeks, 1, 52, 8);
      const dashboard = buildCohort(store.allRecords(), {
        k,
        weeks,
        minTeachers: Math.max(2, Math.min(5, Math.ceil(k / 2) + 1)),
        now: deps.now?.() ?? new Date(),
      });
      const body: CohortResponse = {
        ...dashboard,
        label: {
          en: 'Anonymised cohort trends',
          hi: 'अनाम समूह रुझान',
        },
      };
      res.json(body);
    }),
  );

  /* ------------------------------------------------------------------ */
  /* Static web build (production)                                      */
  /* ------------------------------------------------------------------ */

  const distDir = fileURLToPath(new URL('../../dist', import.meta.url));
  if (existsSync(distDir)) {
    app.use(express.static(distDir, { maxAge: '1h', index: false }));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api/')) return next();
      res.sendFile(`${distDir}/index.html`);
    });
  }

  app.use(notFound);
  app.use(errorHandler);
  return app;
}

function readTeacherHeader(value: string | undefined): string {
  if (!value) {
    throw new HttpError(401, 'missing_teacher', 'Missing x-teacher-id header.');
  }
  return teacherIdSchema.parse(value);
}

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const n = typeof value === 'string' ? Number.parseInt(value, 10) : Number.NaN;
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}
