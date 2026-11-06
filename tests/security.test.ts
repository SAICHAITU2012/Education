import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getContentPack } from '../src/content/index.js';
import { MockClient } from '../src/llm/mock/index.js';
import { createApp } from '../src/server/app.js';
import { Store } from '../src/server/store.js';

const pack = await getContentPack();

function appWith(allowedOrigins: string[]) {
  return createApp({
    store: new Store(),
    content: pack,
    llm: { client: new MockClient(), engine: 'mock', mode: 'mock', fallback: true },
    allowedOrigins,
  });
}

async function listen(app: ReturnType<typeof appWith>): Promise<{ server: Server; base: string }> {
  let server!: Server;
  await new Promise<void>((resolve) => {
    server = app.listen(0, '127.0.0.1', () => resolve());
  });
  const { port } = server.address() as AddressInfo;
  return { server, base: `http://127.0.0.1:${port}` };
}

describe('security headers', () => {
  it('sets the baseline headers on every response', async () => {
    const { server, base } = await listen(appWith([]));
    try {
      const res = await fetch(`${base}/api/health`);
      expect(res.status).toBe(200);
      expect(res.headers.get('x-content-type-options')).toBe('nosniff');
      expect(res.headers.get('x-frame-options')).toBe('deny');
      expect(res.headers.get('referrer-policy')).toBe('no-referrer');
      expect(res.headers.get('cross-origin-opener-policy')).toBe('same-origin');
      const csp = res.headers.get('content-security-policy') ?? '';
      expect(csp).toContain("default-src 'self'");
      expect(csp).toContain("frame-ancestors 'none'");
      // The rehearsal player records voice in the browser — policy must keep
      // the same-origin microphone usable.
      expect(res.headers.get('permissions-policy')).toBe('camera=(), geolocation=(), microphone=(self)');
      expect(res.headers.get('x-powered-by')).toBeNull();
    } finally {
      server.close();
    }
  });
});

describe('CORS allowlist', () => {
  it('echoes an allowed origin and withholds headers for a foreign one', async () => {
    const { server, base } = await listen(appWith(['https://abhyas.example']));
    try {
      const allowed = await fetch(`${base}/api/health`, {
        headers: { origin: 'https://abhyas.example' },
      });
      expect(allowed.headers.get('access-control-allow-origin')).toBe('https://abhyas.example');

      const foreign = await fetch(`${base}/api/health`, {
        headers: { origin: 'https://evil.example' },
      });
      expect(foreign.headers.get('access-control-allow-origin')).toBeNull();
    } finally {
      server.close();
    }
  });

  it('always allows the server’s own origin (the served PWA posts same-origin)', async () => {
    const { server, base } = await listen(appWith([]));
    try {
      const res = await fetch(`${base}/api/health`, { headers: { origin: base } });
      expect(res.headers.get('access-control-allow-origin')).toBe(base);
    } finally {
      server.close();
    }
  });

  it('answers an allowed preflight and grants the request methods', async () => {
    const { server, base } = await listen(appWith(['https://abhyas.example']));
    try {
      const preflight = await fetch(`${base}/api/sessions`, {
        method: 'OPTIONS',
        headers: {
          origin: 'https://abhyas.example',
          'access-control-request-method': 'POST',
        },
      });
      expect(preflight.status).toBe(204);
      expect(preflight.headers.get('access-control-allow-origin')).toBe('https://abhyas.example');
      expect(preflight.headers.get('access-control-allow-methods')).toContain('POST');
    } finally {
      server.close();
    }
  });

  it('leaves non-browser clients (no Origin header) untouched', async () => {
    const { server, base } = await listen(appWith([]));
    try {
      const res = await fetch(`${base}/api/health`);
      expect(res.status).toBe(200);
      expect(res.headers.get('access-control-allow-origin')).toBeNull();
    } finally {
      server.close();
    }
  });
});
