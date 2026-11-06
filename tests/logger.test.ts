import { afterEach, describe, expect, it, vi } from 'vitest';
import { log, scrubPath } from '../src/server/logger.js';

const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

afterEach(() => {
  vi.clearAllMocks();
  delete process.env.LOG_LEVEL;
});

describe('structured logger', () => {
  it('emits one parseable JSON line per event', () => {
    log.info('http_request', { method: 'GET', path: '/api/health', ms: 3 });
    const line = consoleLog.mock.calls[0]?.[0] as string;
    const parsed = JSON.parse(line) as Record<string, unknown>;
    expect(parsed.level).toBe('info');
    expect(parsed.event).toBe('http_request');
    expect(parsed.method).toBe('GET');
    expect(typeof parsed.time).toBe('string');
  });

  it('respects LOG_LEVEL filtering', () => {
    process.env.LOG_LEVEL = 'error';
    log.info('quiet_event');
    expect(consoleLog).not.toHaveBeenCalled();
    log.error('loud_event', { code: 'x' });
    expect(consoleError).toHaveBeenCalledTimes(1);
    const parsed = JSON.parse(consoleError.mock.calls[0]?.[0] as string) as Record<string, unknown>;
    expect(parsed.event).toBe('loud_event');
  });

  it('scrubs teacher ids from request paths', () => {
    expect(scrubPath('/api/teachers/t_abc123def456/state')).toBe('/api/teachers/:teacher/state');
    expect(scrubPath('/api/health')).toBe('/api/health');
  });
});
