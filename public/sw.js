/**
 * Conservative service worker for markmint (offline / installable).
 *
 * Strategy, chosen to never serve a stale app:
 *   • content-hashed build assets (…/_astro/…) → cache-first (immutable)
 *   • everything else (HTML, the wasm, etc.)    → network-first, fall back to
 *     cache only when offline
 * Old caches are purged on activate. Bump CACHE_VERSION to force a refresh.
 */
const CACHE_VERSION = 'markmint-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  const immutable = url.pathname.includes('/_astro/');

  if (immutable) {
    event.respondWith(
      caches.open(CACHE_VERSION).then(async (cache) => {
        const hit = await cache.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok) cache.put(req, res.clone());
        return res;
      }),
    );
    return;
  }

  event.respondWith(
    (async () => {
      try {
        const res = await fetch(req);
        if (res.ok) {
          const cache = await caches.open(CACHE_VERSION);
          cache.put(req, res.clone());
        }
        return res;
      } catch {
        const cached = await caches.match(req);
        if (cached) return cached;
        throw new Error('offline and not cached');
      }
    })(),
  );
});
