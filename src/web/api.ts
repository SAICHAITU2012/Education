import type {
  Attempt,
  AttemptRecord,
  CohortDashboard,
  Lang,
  Session,
  TeacherState,
  Turn,
} from '../core/types.js';
import type {
  ApiErrorBody,
  CohortResponse,
  ContentPayload,
  HealthPayload,
  ProfileRequest,
  ScoreRequest,
  ScoreResponse,
  StartSessionResponse,
  StateResponse,
  SyncResponse,
  TurnResponse,
} from '../shared/api.js';

const BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? '';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function newId(prefix: 't' | 'a'): string {
  const raw = crypto.randomUUID().replace(/-/g, '');
  return `${prefix}_${raw}`;
}

export function getTeacherId(): string {
  const key = 'abhyas:teacher-id';
  let id = localStorage.getItem(key);
  if (!id || !/^[A-Za-z0-9_-]{8,64}$/.test(id)) {
    id = newId('t');
    localStorage.setItem(key, id);
  }
  return id;
}

async function request<T>(
  path: string,
  init: RequestInit = {},
  options: { teacherId?: string; timeoutMs?: number } = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has('content-type')) headers.set('content-type', 'application/json');
  if (options.teacherId) headers.set('x-teacher-id', options.teacherId);
  let response: Response;
  try {
    response = await fetch(`${BASE}${path}`, {
      ...init,
      headers,
      signal: AbortSignal.timeout(options.timeoutMs ?? 20_000),
    });
  } catch (err) {
    throw new ApiError(0, 'network', err instanceof Error ? err.message : 'Network unavailable');
  }
  const text = await response.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { error: { code: 'bad_response', message: text.slice(0, 200) } };
  }
  if (!response.ok) {
    const error = (body as ApiErrorBody | null)?.error;
    throw new ApiError(
      response.status,
      error?.code ?? 'http_error',
      error?.message ?? `Request failed (${response.status})`,
      error?.details,
    );
  }
  return body as T;
}

export function health(): Promise<HealthPayload> {
  return request<HealthPayload>('/api/health');
}

export function content(): Promise<ContentPayload> {
  return request<ContentPayload>('/api/content', {}, { timeoutMs: 30_000 });
}

export function saveProfile(teacherId: string, profile: ProfileRequest): Promise<{ state: TeacherState }> {
  return request<{ state: TeacherState }>(`/api/teachers/${teacherId}`, {
    method: 'PUT',
    body: JSON.stringify(profile),
  });
}

export function fetchState(teacherId: string): Promise<StateResponse> {
  return request<StateResponse>(`/api/teachers/${teacherId}/state`, {}, { teacherId });
}

export function startSession(
  teacherId: string,
  body: { scenarioId?: string; mode?: 'online' | 'offline' },
): Promise<StartSessionResponse> {
  return request<StartSessionResponse>(
    '/api/sessions',
    { method: 'POST', body: JSON.stringify(body) },
    { teacherId, timeoutMs: 20_000 },
  );
}

export function sendTurn(
  teacherId: string,
  sessionId: string,
  text: string,
  transport: 'voice' | 'text',
): Promise<TurnResponse> {
  return request<TurnResponse>(
    `/api/sessions/${sessionId}/turns`,
    { method: 'POST', body: JSON.stringify({ text, transport }) },
    { teacherId, timeoutMs: 60_000 },
  );
}

export function scoreSession(
  teacherId: string,
  sessionId: string,
  body: ScoreRequest,
): Promise<ScoreResponse> {
  return request<ScoreResponse>(
    `/api/sessions/${sessionId}/score`,
    { method: 'POST', body: JSON.stringify(body) },
    { teacherId, timeoutMs: 90_000 },
  );
}

export function syncAttempts(teacherId: string, attempts: Attempt[]): Promise<SyncResponse> {
  return request<SyncResponse>(
    '/api/sync',
    { method: 'POST', body: JSON.stringify({ attempts }) },
    { teacherId, timeoutMs: 120_000 },
  );
}

export function fetchCohort(weeks = 8, k = 5): Promise<CohortResponse> {
  return request<CohortResponse>(`/api/cohort?weeks=${weeks}&k=${k}`, {}, { timeoutMs: 20_000 });
}

export function fetchAttempt(teacherId: string, attemptId: string): Promise<AttemptRecord> {
  return request<AttemptRecord>(`/api/teachers/${teacherId}/attempts/${attemptId}`, {}, { teacherId });
}

export function exportData(teacherId: string): Promise<unknown> {
  return request<unknown>(`/api/teachers/${teacherId}/export`, {}, { teacherId });
}

export function deleteTeacher(teacherId: string): Promise<{ deleted: boolean; removedAttempts: number }> {
  return request<{ deleted: boolean; removedAttempts: number }>(
    `/api/teachers/${teacherId}`,
    { method: 'DELETE' },
    { teacherId },
  );
}

export function isOfflineError(err: unknown): boolean {
  return err instanceof ApiError && (err.code === 'network' || err.status === 0);
}

/** Localized helper for the roleplay language. */
export function roleplayText(text: { en: string; hi: string }, lang: Lang): string {
  return lang === 'hi' ? text.hi : text.en;
}

export type { Session, Turn };
