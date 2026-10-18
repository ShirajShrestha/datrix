/* Datrix service worker. Hand-written; committed as-is (not generated).
 * Sections: 1) config  2) helpers  3) lifecycle  4) fetch routing  5) push (Task 18 adds here)
 */

// ---- 1. Config -------------------------------------------------------------
const VERSION = 'v1';
const STATIC_CACHE = `datrix-static-${VERSION}`;
const SHELL_CACHE = `datrix-shell-${VERSION}`;
const IMAGE_CACHE = `datrix-images-${VERSION}`;
const ARTICLES_CACHE = 'datrix-articles'; // fixed name; content is expired by age/size
const ALL_CACHES = [STATIC_CACHE, SHELL_CACHE, IMAGE_CACHE, ARTICLES_CACHE];

const ARTICLES_MAX_ENTRIES = 24;
const ARTICLES_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const IMAGES_MAX_ENTRIES = 60;
const SHELL_URLS = ['/', '/offline.html', '/manifest.json', '/icon-192.png'];
const DATE_HEADER = 'x-sw-cached-at';

// ---- 2. Helpers ------------------------------------------------------------
async function trim(cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - maxEntries; i++) await cache.delete(keys[i]);
}

// Store a copy stamped with the time it was cached (for max-age checks).
async function putStamped(cache, request, response) {
  const headers = new Headers(response.headers);
  headers.set(DATE_HEADER, String(Date.now()));
  const body = await response.blob();
  await cache.put(request, new Response(body, { status: response.status, statusText: response.statusText, headers }));
}

function isFresh(response, maxAgeMs) {
  const at = Number(response.headers.get(DATE_HEADER));
  return at && Date.now() - at < maxAgeMs;
}

async function cacheFirst(request, cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request);
  if (hit) return hit;
  const res = await fetch(request);
  if (res.ok && res.type === 'basic') {
    await cache.put(request, res.clone());
    if (maxEntries) trim(cacheName, maxEntries);
  }
  return res;
}

async function staleWhileRevalidateArticles(event) {
  const request = event.request;
  const cache = await caches.open(ARTICLES_CACHE);
  const cached = await cache.match(request);
  const usable = cached && isFresh(cached, ARTICLES_MAX_AGE_MS) ? cached : null;
  if (cached && !usable) await cache.delete(request);

  const network = fetch(request)
    .then(async (res) => {
      if (res.ok) {
        await putStamped(cache, request, res.clone());
        await trim(ARTICLES_CACHE, ARTICLES_MAX_ENTRIES);
      }
      return res;
    })
    .catch(() => null);

  if (usable) {
    event.waitUntil(network);
    return usable;
  }
  const res = await network;
  return res || new Response(JSON.stringify({ error: 'offline' }), { status: 503, headers: { 'Content-Type': 'application/json' } });
}

async function navigationHandler(request) {
  try {
    const res = await fetch(request);
    if (res.ok && new URL(request.url).pathname === '/') {
      const cache = await caches.open(SHELL_CACHE);
      cache.put('/', res.clone());
    }
    return res;
  } catch {
    const cache = await caches.open(SHELL_CACHE);
    return (await cache.match(request)) || (await cache.match('/')) || (await cache.match('/offline.html')) || Response.error();
  }
}

// ---- 3. Lifecycle ----------------------------------------------------------
// A new worker waits until the page asks it to take over (see ServiceWorkerRegister),
// so an open tab is never swapped mid-session unexpectedly.
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) =>
      Promise.all(SHELL_URLS.map((u) => cache.add(new Request(u, { cache: 'reload' })).catch(() => {})))
    )
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(names.filter((n) => n.startsWith('datrix-') && !ALL_CACHES.includes(n)).map((n) => caches.delete(n)));
      await self.clients.claim();
    })()
  );
});

// ---- 4. Fetch routing ------------------------------------------------------
self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // never touch cross-origin (incl. remote images)

  const path = url.pathname;
  if (path.startsWith('/api/cron/') || path.startsWith('/api/push/')) return;

  if (path === '/api/articles' || path.startsWith('/api/articles/')) {
    event.respondWith(staleWhileRevalidateArticles(event));
    return;
  }
  if (path.startsWith('/api/')) return;

  if (path.startsWith('/_next/static/')) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }
  if (request.destination === 'image' || /\.(png|jpe?g|svg|webp|avif|gif|ico)$/.test(path)) {
    event.respondWith(cacheFirst(request, IMAGE_CACHE, IMAGES_MAX_ENTRIES));
    return;
  }
  if (request.mode === 'navigate') {
    event.respondWith(navigationHandler(request));
  }
});

// ---- 5. Push (Task 18 adds 'push' and 'notificationclick' handlers here) ---
