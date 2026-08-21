// Offline-first service worker with eager updates (the PWA update kit).
// VERSION must match APP_VERSION in src/lib/constants.js — scripts/check-version.mjs
// fails the build on drift. Bump BOTH every release: the browser only installs a
// new worker when this file's bytes change, so a stale VERSION here silently
// disables updates for every phone.
const VERSION = '3.36.75';
const CACHE = `partvault-app-${VERSION}`;
// '/' is the app shell. Never list '/index.html' — hosts 307 it to '/', and iOS
// refuses a redirect-tainted cached response for a navigation.
const ASSETS = [
  '/',
  '/manifest.webmanifest',
  '/icon.svg',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/apple-touch-icon.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await Promise.all(ASSETS.map(async (url) => {
      const res = await fetch(url, { cache: 'no-cache' });
      if (!res.ok) throw new Error(`precache failed: ${url}`);
      // Re-wrap anything that arrived via a redirect so the stored copy is a
      // plain 200 — a redirected response is unusable for navigations.
      const clean = res.redirected
        ? new Response(await res.blob(), { status: 200, statusText: 'OK', headers: res.headers })
        : res;
      await cache.put(url, clean);
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// The app can ask the worker which version it's running — a loud mismatch
// beats a silent one (a forgotten bump disables updates invisibly).
self.addEventListener('message', (e) => {
  if (e.data === 'version') e.source?.postMessage({ type: 'sw-version', version: VERSION });
});

// Cache-first with background refresh. Navigations get the cached shell
// immediately (works with no signal in the yard); Vite's hashed /assets/* are
// immutable so cache-first is always right for them. Supabase/eBay calls are
// cross-origin and never touched.
self.addEventListener('fetch', (e) => {
  const { request } = e;
  if (request.method !== 'GET' || !request.url.startsWith(self.location.origin)) return;

  // Navigations get the cached shell — EXCEPT real standalone pages (anything
  // with a file extension, e.g. /privacy.html), which must load themselves.
  const path = new URL(request.url).pathname;
  const isShellNav = request.mode === 'navigate' && !/\.[a-z0-9]+$/i.test(path);
  const cacheKey = isShellNav ? '/' : request;
  e.respondWith(
    caches.match(cacheKey).then((cached) => {
      const refresh = fetch(request)
        .then((res) => {
          if (res.ok && !res.redirected) {
            caches.open(CACHE).then((c) => c.put(cacheKey, res.clone()));
          }
          return res;
        })
        .catch(() => cached);
      return cached || refresh;
    }),
  );
});
