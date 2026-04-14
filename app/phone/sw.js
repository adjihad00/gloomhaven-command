const CACHE_NAME = 'gc-phone-v4';
const APP_SHELL = [
  '/phone',
  '/app/shared/styles/theme.css',
  '/app/shared/styles/typography.css',
  '/app/shared/styles/components.css',
  '/app/shared/styles/connection.css',
  '/app/phone/styles/phone.css',
  '/app/phone/dist/main.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Never cache WebSocket, API calls, or asset data
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/assets/')) {
    return;
  }

  // Cache-first for app shell, network-first for everything else
  event.respondWith(
    caches.match(event.request).then((cached) => {
      return cached || fetch(event.request).then((response) => {
        if (event.request.method === 'GET' && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      });
    })
  );
});
