// Self-healing service worker (dev-mode source).
// SW_VERSION is injected by the server at request time via
// `self.GC_SW_VERSION_INJECTED = "..."` prepended to the response body.
// In production, app/build.mjs generates app/display/dist/sw.js from a template
// with the same logic plus a baked-in fallback version.
const SW_VERSION = self.GC_SW_VERSION_INJECTED || ('dev-' + Date.now());
const CACHE_NAME = 'gc-display-' + SW_VERSION;
const SCOPE_ROOT = '/display';
const APP_SHELL = [
  '/display',
  '/app/shared/styles/theme.css',
  '/app/shared/styles/typography.css',
  '/app/shared/styles/components.css',
  '/app/shared/styles/connection.css',
  '/app/display/styles/display.css',
  '/app/display/dist/main.js',
];

// Paths the SW must NEVER intercept — escape hatches and non-cacheable data.
const BYPASS_PATHS = ['/api/', '/assets/', '/sw-version.json', '/unregister'];

function isBypassed(url) {
  if (BYPASS_PATHS.some((p) => url.pathname.startsWith(p))) return true;
  if (url.pathname.endsWith('/sw.js')) return true;
  return false;
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .catch((err) => { console.warn('[sw] Install addAll failed, continuing:', err); })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)));
    await self.clients.claim();
    try {
      const res = await fetch('/sw-version.json', { cache: 'no-store' });
      if (res.ok) {
        const body = await res.json();
        if (body && body.version && body.version !== SW_VERSION) {
          console.warn('[sw] Version mismatch on activate, self-destructing',
            { sw: SW_VERSION, server: body.version });
          await selfDestruct();
        }
      }
    } catch (_) { /* offline — don't self-destruct */ }
  })());
});

async function selfDestruct() {
  try {
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => caches.delete(k)));
  } catch (_) { /* ignore */ }
  try {
    const reg = await self.registration;
    if (reg) await reg.unregister();
  } catch (_) { /* ignore */ }
  try {
    const all = await self.clients.matchAll();
    for (const c of all) { try { c.postMessage({ type: 'sw-self-destructed' }); } catch (_) {} }
  } catch (_) { /* ignore */ }
}

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (isBypassed(url)) return;

  const isNavigate = event.request.mode === 'navigate'
    || (event.request.method === 'GET'
        && (event.request.headers.get('accept') || '').includes('text/html'));

  if (isNavigate) {
    event.respondWith((async () => {
      try {
        const response = await fetch(event.request);
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone)).catch(() => {});
        }
        return response;
      } catch (_) {
        const cached = await caches.match(event.request);
        if (cached) return cached;
        const fallback = await caches.match(SCOPE_ROOT);
        if (fallback) return fallback;
        return Response.error();
      }
    })());
    return;
  }

  // Static assets: network-first with cache fallback.
  event.respondWith((async () => {
    try {
      const response = await fetch(event.request);
      if (event.request.method === 'GET' && response && response.status === 200) {
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone)).catch(() => {});
      }
      return response;
    } catch (_) {
      const cached = await caches.match(event.request);
      if (cached) return cached;
      return Response.error();
    }
  })());
});
