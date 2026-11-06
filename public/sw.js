/* Abhyas service worker — shell + content cache, offline-first.
 *
 * Strategy:
 *  - App shell (HTML/JS/CSS/fonts): stale-while-revalidate so a weak network
 *    still opens the app instantly.
 *  - /api/content and /api/health: network-first with cache fallback.
 *  - Everything else under /api/ (personal data): never cached.
 *  - Navigator requests fall back to the shell so hash routes work offline.
 */

const VERSION = 'abhyas-v3';
const SHELL_CACHE = `${VERSION}-shell`;
const CONTENT_CACHE = `${VERSION}-content`;

const SHELL_ASSETS = ['/', '/index.html', '/manifest.webmanifest'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL_ASSETS).catch(() => undefined))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((key) => !key.startsWith(VERSION)).map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

function isCacheableContent(url) {
  return url.pathname === '/api/content' || url.pathname === '/api/health';
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Personal data must never touch the cache.
  if (url.pathname.startsWith('/api/') && !isCacheableContent(url)) return;

  if (isCacheableContent(url)) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            void caches.open(CONTENT_CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => caches.match(request).then((hit) => hit ?? Response.error())),
    );
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          void caches.open(SHELL_CACHE).then((cache) => cache.put('/index.html', copy));
          return response;
        })
        .catch(() => caches.match('/index.html').then((hit) => hit ?? Response.error())),
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((hit) => {
      const network = fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            void caches.open(SHELL_CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => hit ?? Response.error());
      return hit ?? network;
    }),
  );
});
