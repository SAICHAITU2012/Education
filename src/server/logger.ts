/**
 * Minimal structured logger — one JSON object per line on stdout, parseable
 * by any log drain. House style: no runtime dependency. Personal data never
 * passes through here: callers log events and ids, never bodies or teacher
 * text. LOG_LEVEL=debug|info|warn|error (default info).
 */

type Level = 'debug' | 'info' | 'warn' | 'error';

const LEVELS: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };

function minLevel(): number {
  const raw = process.env.LOG_LEVEL as Level | undefined;
  return (raw && LEVELS[raw]) || LEVELS.info;
}

function emit(level: Level, event: string, fields: Record<string, unknown> = {}): void {
  if (LEVELS[level] < minLevel()) return;
  const line = JSON.stringify({ time: new Date().toISOString(), level, event, ...fields });
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

export const log = {
  debug: (event: string, fields?: Record<string, unknown>) => emit('debug', event, fields),
  info: (event: string, fields?: Record<string, unknown>) => emit('info', event, fields),
  warn: (event: string, fields?: Record<string, unknown>) => emit('warn', event, fields),
  error: (event: string, fields?: Record<string, unknown>) => emit('error', event, fields),
};

/** Request paths are scrubbed of teacher ids before logging. */
export function scrubPath(path: string): string {
  return path.replace(/\/t_[A-Za-z0-9_-]+/g, '/:teacher');
}
