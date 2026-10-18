/* Datrix service worker. Hand-written; committed as-is (not generated).
 * Sections: 1) config  2) pure helpers  3) cache handlers  4) lifecycle  5) fetch routing  6) push
 */

// ---- 1. Config -------------------------------------------------------------
const VERSION = 'v3';
const STATIC_CACHE = `datrix-static-${VERSION}`;
const SHELL_CACHE = `datrix-shell-${VERSION}`;
const IMAGE_CACHE = `datrix-images-${VERSION}`;
const ARTICLES_CACHE = `datrix-articles-${VERSION}`; // versioned so a bump purges old entries
const ALL_CACHES = [STATIC_CACHE, SHELL_CACHE, IMAGE_CACHE, ARTICLES_CACHE];

const ARTICLES_MAX_ENTRIES = 24;
const ARTICLES_MAX_AGE_MS = 6 * 60 * 60 * 1000; // cached list is only a offline/slow-network fallback
const ARTICLES_NETWORK_TIMEOUT_MS = 3000;
const IMAGES_MAX_ENTRIES = 60;
const STATIC_MAX_ENTRIES = 120;
const DATE_HEADER = 'x-sw-cached-at';

// Caches left behind by the previous next-pwa/Workbox worker served from this same /sw.js URL.
const LEGACY_CACHE_NAMES = [
  'start-url', 'pages', 'others', 'pages-rsc', 'pages-rsc-prefetch', 'next-static-js-assets',
  'static-js-assets', 'static-style-assets', 'static-image-assets', 'static-font-assets',
  'static-audio-assets', 'static-video-assets', 'next-image', 'apis', 'cross-origin',
  'google-fonts-webfonts', 'google-fonts-stylesheets', 'static-data-assets', 'next-data',
];

// ---- 2. Pure helpers (unit-tested via self.__datrixSw) -----------------------
// Returns 'articles' | 'static' | 'image' | 'navigate' | null (null = do not handle).
function routeFor(request, origin) {
  if (request.method !== 'GET') return null;
  if (request.headers && request.headers.has('range')) return null;
  const url = new URL(request.url);
  if (url.origin !== origin) return null; // never touch cross-origin (incl. remote images)
  const path = url.pathname;
  if (path.startsWith('/api/cron/') || path.startsWith('/api/push/')) return null;
  if (path === '/api/articles' || path.startsWith('/api/articles/')) return 'articles';
  if (path.startsWith('/api/')) return null;
  if (path.startsWith('/_next/static/')) return 'static';
  if (request.destination === 'image' || /\.(png|jpe?g|svg|webp|avif|gif|ico)$/.test(path)) return 'image';
  if (request.mode === 'navigate') return 'navigate';
  return null;
}

function isCacheable(res) {
  if (!res || res.status !== 200 || res.type !== 'basic') return false;
  const cc = (res.headers.get('Cache-Control') || '').toLowerCase();
  if (cc.includes('no-store') || cc.includes('private')) return false;
  if ((res.headers.get('Vary') || '').trim() === '*') return false;
  return true;
}

function isLegacyCacheName(name) {
  if (name.startsWith('datrix-')) return false;
  return name.startsWith('workbox-') || LEGACY_CACHE_NAMES.includes(name);
}

function isFresh(response, maxAgeMs) {
  const at = Number(response.headers.get(DATE_HEADER));
  return !!at && Date.now() - at < maxAgeMs;
}

// ---- 3. Cache handlers -----------------------------------------------------
async function trim(cacheName, maxEntries) {
  try {
    const cache = await caches.open(cacheName);
    const keys = await cache.keys();
    for (let i = 0; i < keys.length - maxEntries; i++) await cache.delete(keys[i]);
  } catch {}
}

// Never throws: a cache failure must not break a good network response.
async function safePut(cache, request, response, stamp) {
  try {
    if (!stamp) return await cache.put(request, response);
    const headers = new Headers(response.headers);
    headers.set(DATE_HEADER, String(Date.now()));
    const body = await response.blob();
    await cache.put(request, new Response(body, { status: response.status, statusText: response.statusText, headers }));
  } catch {}
}

async function cacheFirst(event, cacheName, maxEntries) {
  const request = event.request;
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request);
  if (hit) return hit;
  const res = await fetch(request);
  if (isCacheable(res)) {
    const copy = res.clone();
    event.waitUntil(safePut(cache, request, copy).then(() => trim(cacheName, maxEntries)));
  }
  return res;
}

const offlineJson = () =>
  new Response(JSON.stringify({ success: false, error: 'offline' }), { status: 503, headers: { 'Content-Type': 'application/json' } });

// Network-first with a 3 s timeout. The cache is only a fallback (network error, 5xx or timeout) and
// only if the entry is younger than ARTICLES_MAX_AGE_MS. A successful 200 refreshes the cache.
// If the network is merely slow and nothing usable is cached, we keep waiting for it (a 503 would be worse).
async function networkFirstArticles(event) {
  const request = event.request;
  const cache = await caches.open(ARTICLES_CACHE);
  const network = fetch(request).then(
    (res) => {
      if (isCacheable(res)) {
        const copy = res.clone();
        event.waitUntil(safePut(cache, request, copy, true).then(() => trim(ARTICLES_CACHE, ARTICLES_MAX_ENTRIES)));
      }
      return res;
    },
    () => null
  );
  const TIMED_OUT = Symbol('timeout');
  let timer;
  const timeout = new Promise((resolve) => { timer = setTimeout(() => resolve(TIMED_OUT), ARTICLES_NETWORK_TIMEOUT_MS); });
  const first = await Promise.race([network, timeout]);
  clearTimeout(timer);
  if (first !== TIMED_OUT && first && first.status < 500) return first;

  let usable = null;
  try {
    const cached = await cache.match(request);
    if (cached && isFresh(cached, ARTICLES_MAX_AGE_MS)) usable = cached;
    else if (cached) await cache.delete(request);
  } catch {}
  if (usable) {
    if (first === TIMED_OUT) event.waitUntil(network); // let the slow request still refresh the cache
    return usable;
  }
  if (first === TIMED_OUT) {
    const late = await network;
    if (late) return late;
  } else if (first) {
    return first; // 5xx and nothing to fall back to
  }
  return offlineJson();
}

// Network-first. Offline: exact cached hit -> cached '/' only for '/' itself -> /offline.html.
// Never serves one route's HTML for another route.
async function navigationHandler(event) {
  const request = event.request;
  const isHome = new URL(request.url).pathname === '/';
  try {
    const res = await fetch(request);
    if (isHome && !res.redirected && isCacheable(res)) {
      const copy = res.clone();
      event.waitUntil(caches.open(SHELL_CACHE).then((c) => safePut(c, '/', copy)));
    }
    return res;
  } catch {
    const cache = await caches.open(SHELL_CACHE);
    return (
      (await cache.match(request)) ||
      (isHome ? await cache.match('/') : undefined) ||
      (await cache.match('/offline.html')) ||
      Response.error()
    );
  }
}

// ---- 4. Lifecycle ----------------------------------------------------------
// A new worker waits until the page asks it to take over (see ServiceWorkerRegister).
self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);
      try { await cache.add(new Request('/offline.html', { cache: 'reload' })); } catch {}
      try {
        const res = await fetch('/', { cache: 'reload' });
        if (res.ok && !res.redirected) await cache.put('/', res);
      } catch {}
    })()
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names
          .filter((n) => (n.startsWith('datrix-') && !ALL_CACHES.includes(n)) || isLegacyCacheName(n))
          .map((n) => caches.delete(n))
      );
      await self.clients.claim();
    })()
  );
});

// ---- 5. Fetch routing ------------------------------------------------------
self.addEventListener('fetch', (event) => {
  const route = routeFor(event.request, self.location.origin);
  if (route === 'articles') event.respondWith(networkFirstArticles(event));
  else if (route === 'static') event.respondWith(cacheFirst(event, STATIC_CACHE, STATIC_MAX_ENTRIES));
  else if (route === 'image') event.respondWith(cacheFirst(event, IMAGE_CACHE, IMAGES_MAX_ENTRIES));
  else if (route === 'navigate') event.respondWith(navigationHandler(event));
});

// Test-only hook (harmless in production): exposes internals to src/lib/__tests__/sw.test.ts.
self.__datrixSw = { parsePushData, safeNotificationUrl, handleNotificationClick, routeFor, isCacheable, isLegacyCacheName, navigationHandler, networkFirstArticles, cacheFirst, safePut, SHELL_CACHE, ARTICLES_CACHE, ARTICLES_MAX_AGE_MS, ARTICLES_NETWORK_TIMEOUT_MS };


// ---- 6. Push ---------------------------------------------------------------
const DEFAULT_PUSH_TITLE = 'Datrix';
const DEFAULT_PUSH_BODY = 'Fresh stories are ready.';

// Only same-origin relative paths; anything else falls back to '/'.
function safeNotificationUrl(url) {
  if (typeof url !== 'string' || url.length === 0 || url.length > 500) return '/';
  if (/[\u0000-\u001f\u007f\\]/.test(url)) return '/';
  if (!url.startsWith('/') || url.startsWith('//')) return '/';
  return url;
}

// Never throws. Invalid/empty payloads give the generic notification.
function parsePushData(text) {
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = null; }
  if (!data || typeof data !== 'object' || Array.isArray(data)) data = {};
  const clean = (v, max, fallback) => {
    if (typeof v !== 'string') return fallback;
    const t = v.trim();
    return t ? t.slice(0, max) : fallback;
  };
  return {
    title: clean(data.title, 80, DEFAULT_PUSH_TITLE),
    body: clean(data.body, 240, DEFAULT_PUSH_BODY),
    url: safeNotificationUrl(data.url),
  };
}

async function handleNotificationClick(rawUrl) {
  let target = new URL('/', self.location.origin).href;
  try {
    const resolved = new URL(safeNotificationUrl(rawUrl), self.location.origin);
    if (resolved.origin === self.location.origin) target = resolved.href; // defense in depth
  } catch {}
  const list = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  for (const client of list) {
    let sameOrigin = false;
    try { sameOrigin = new URL(client.url).origin === self.location.origin; } catch {}
    if (!sameOrigin) continue;
    let handled = false;
    try {
      if (client.url !== target && typeof client.navigate === 'function') {
        const navigated = await client.navigate(target);
        if (navigated && navigated.focus) { await navigated.focus(); handled = true; }
      }
    } catch {}
    try {
      if (!handled) { await client.focus(); handled = true; }
    } catch {}
    if (handled) return;
  }
  return self.clients.openWindow(target);
}

self.addEventListener('push', (event) => {
  let text = '';
  try { text = event.data ? event.data.text() : ''; } catch {}
  const { title, body, url } = parsePushData(text);
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: 'datrix-daily',
      renotify: false,
      data: { url },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data && event.notification.data.url;
  event.waitUntil(handleNotificationClick(url).catch(() => {}));
});
