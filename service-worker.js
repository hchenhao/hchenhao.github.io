// Service Worker: image cache-first strategy for /assets/images/
const CACHE_NAME = 'site-img-cache-v1';
const IMAGE_PATH = '/assets/images/';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
    ))
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  try {
    const url = new URL(req.url);
    // Only handle same-origin image requests under IMAGE_PATH
    if (url.origin === self.location.origin && url.pathname.startsWith(IMAGE_PATH)) {
      event.respondWith((async () => {
        const cache = await caches.open(CACHE_NAME);
        const cached = await cache.match(req);
        if (cached) return cached;
        try {
          const networkResp = await fetch(req);
          if (networkResp && networkResp.status === 200) {
            cache.put(req, networkResp.clone()).catch(() => {});
          }
          return networkResp;
        } catch (err) {
          // network failed; return cached if available (already handled) or fail
          return cached || Response.error();
        }
      })());
    }
  } catch (e) {
    // ignore URL parse errors
  }
});
