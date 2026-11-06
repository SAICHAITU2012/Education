import type { CorsOptions, CorsOptionsDelegate } from 'cors';
import type { RequestHandler } from 'express';

/**
 * Security headers for the API and the served PWA shell. Deliberately
 * dependency-free (house style) — these cover the secure-header baseline for
 * this app; a fuller policy review belongs to the production-spine milestone.
 */
export function securityHeaders(): RequestHandler {
  return (_req, res, next) => {
    res.setHeader('x-content-type-options', 'nosniff');
    res.setHeader('x-frame-options', 'deny');
    res.setHeader('referrer-policy', 'no-referrer');
    res.setHeader('cross-origin-opener-policy', 'same-origin');
    // Microphone stays same-origin (the rehearsal player); camera and
    // geolocation are never needed.
    res.setHeader('permissions-policy', 'camera=(), geolocation=(), microphone=(self)');
    // The rehearsal player needs the microphone (same-origin only) and the
    // shell loads Google Fonts; everything else stays closed.
    res.setHeader(
      'content-security-policy',
      [
        "default-src 'self'",
        "script-src 'self'",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "font-src 'self' data: https://fonts.gstatic.com",
        "img-src 'self' data: blob:",
        "connect-src 'self'",
        "media-src 'self' blob:",
        "object-src 'none'",
        "base-uri 'self'",
        "frame-ancestors 'none'",
      ].join('; '),
    );
    next();
  };
}

/**
 * CORS allowlist (TD-05). Cross-origin browser access is granted only to
 * origins in the allowlist or to the server's own origin — in production the
 * PWA is served by the API process itself, and a same-origin POST still
 * carries an Origin header. Non-browser clients send no Origin header and are
 * unaffected. A disallowed origin simply receives no CORS headers, which is
 * what makes the browser refuse the response.
 */
export function corsDelegate(allowedOrigins: readonly string[]): CorsOptionsDelegate {
  return (req, callback) => {
    const origin = req.headers.origin;
    const host = req.headers.host;
    const hasOrigin = typeof origin === 'string' && origin.length > 0;
    const sameOrigin =
      hasOrigin && typeof host === 'string' && origin.endsWith(`//${host}`);
    const allowed = hasOrigin && (sameOrigin || allowedOrigins.includes(origin));
    const options: CorsOptions = {
      origin: allowed ? origin : false,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      maxAge: 600,
      exposedHeaders: ['x-request-id'],
    };
    callback(null, options);
  };
}

/**
 * ALLOWED_ORIGINS parsing: comma-separated, trimmed; empty/missing → defaults.
 */
export function allowedOriginsFromEnv(defaults: readonly string[]): string[] {
  const raw = process.env.ALLOWED_ORIGINS;
  if (!raw || !raw.trim()) return [...defaults];
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * TRUST_PROXY wiring (TD-09): behind a reverse proxy all clients otherwise
 * share one IP bucket. Accepts "true"/"false", a hop count ("1"), or a
 * comma-separated IP/subnet list — Express's own trust-proxy grammar.
 */
export function applyTrustProxy(app: { set(name: 'trust proxy', value: boolean | number | string): void }): void {
  const raw = process.env.TRUST_PROXY;
  if (!raw || raw === 'false') return;
  if (raw === 'true') {
    app.set('trust proxy', true);
    return;
  }
  const hops = Number(raw);
  app.set('trust proxy', Number.isInteger(hops) && hops > 0 ? hops : raw);
}
