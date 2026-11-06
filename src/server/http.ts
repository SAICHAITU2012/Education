import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { z } from 'zod';
import type { ApiErrorBody } from '../shared/api.js';

export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
): RequestHandler {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
}

/** Tiny in-memory rate limiter — enough for a single-node V0 deployment. */
export function rateLimit(options: { windowMs: number; max: number; name: string }): RequestHandler {
  const hits = new Map<string, { count: number; resetAt: number }>();
  return (req, _res, next) => {
    const key = req.ip ?? 'unknown';
    const now = Date.now();
    const entry = hits.get(key);
    if (!entry || entry.resetAt <= now) {
      hits.set(key, { count: 1, resetAt: now + options.windowMs });
      next();
      return;
    }
    entry.count++;
    if (entry.count > options.max) {
      next(new HttpError(429, 'rate_limited', `Too many ${options.name} requests. Please wait a moment.`));
      return;
    }
    next();
  };
}

/** Request logger that never logs teacher text or personal data. */
export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();
  res.on('finish', () => {
    const ms = Date.now() - start;
    const path = req.path.replace(/\/t_[A-Za-z0-9_-]+/g, '/:teacher');
    console.log(`${req.method} ${path} ${res.statusCode} ${ms}ms`);
  });
  next();
}

export function notFound(_req: Request, res: Response): void {
  const body: ApiErrorBody = {
    error: { code: 'not_found', message: 'No such endpoint.' },
  };
  res.status(404).json(body);
}

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const requestId = String(res.locals.requestId ?? '');
  if (err instanceof z.ZodError) {
    const body: ApiErrorBody = {
      error: {
        code: 'invalid_request',
        message: 'The request did not match the API contract.',
        requestId,
        details: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      },
    };
    res.status(400).json(body);
    return;
  }
  if (err instanceof HttpError) {
    const body: ApiErrorBody = {
      error: { code: err.code, message: err.message, requestId, details: err.details },
    };
    res.status(err.status).json(body);
    return;
  }
  console.error(`[abhyas] ${req.method} ${req.path} failed:`, err);
  const body: ApiErrorBody = {
    error: { code: 'internal_error', message: 'Something went wrong. No attempt was graded.', requestId },
  };
  res.status(500).json(body);
}

/* ------------------------------------------------------------------ */
/* Request schemas                                                     */
/* ------------------------------------------------------------------ */

const teacherId = z.string().regex(/^[A-Za-z0-9_-]{8,64}$/, 'invalid teacher id');
const attemptId = z.string().regex(/^[A-Za-z0-9_-]{8,80}$/, 'invalid attempt id');
const isoDate = z.string().refine((s) => !Number.isNaN(Date.parse(s)), 'invalid ISO date');

export const turnSchema = z.object({
  role: z.enum(['student', 'teacher', 'system']),
  text: z.string().min(1).max(4000),
  ts: z.number().finite(),
  transport: z.enum(['voice', 'text']).optional(),
});

export const profileSchema = z.object({
  curriculum: z.object({
    class: z.union([z.literal(1), z.literal(2), z.literal(3)]),
    subject: z.enum(['maths', 'hindi']),
  }),
  language: z.enum(['hi', 'en', 'kn', 'ta', 'te', 'ml']),
});

export const startSessionSchema = z.object({
  scenarioId: z.string().min(3).max(120).optional(),
  mode: z.enum(['online', 'offline']).optional(),
});

export const turnRequestSchema = z.object({
  text: z.string().min(1).max(4000),
  transport: z.enum(['voice', 'text']).optional(),
});

export const scoreRequestSchema = z.object({
  heardCorrectly: z.boolean(),
  turns: z.array(turnSchema).min(1).max(40).optional(),
  audioQuality: z.enum(['clear', 'unclear']).optional(),
});

export const attemptSchema = z.object({
  id: attemptId,
  teacherId,
  scenarioId: z.string().min(3).max(120),
  scenarioVersion: z.string().min(3).max(40),
  rubricId: z.string().min(3).max(80),
  rubricVersion: z.string().min(3).max(40),
  turns: z.array(turnSchema).min(1).max(40),
  mode: z.enum(['online', 'offline']),
  clientCreatedAt: isoDate,
  heardCorrectly: z.boolean().optional(),
});

export const syncRequestSchema = z.object({
  attempts: z.array(attemptSchema).min(1).max(50),
});

export const teacherIdSchema = teacherId;
export const attemptIdSchema = attemptId;
