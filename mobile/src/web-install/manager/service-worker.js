const CACHE_PREFIX = 'memphis-zoo-custodial-manager-shell-';
const CACHE = `${CACHE_PREFIX}__MZ_EXACT_CACHE_ID__`;
const BASE = new URL('./', self.location.href);
const PRECACHE = [
  './index.html', './offline.html', './manifest.webmanifest', './pwa-register.js',
  './mobile.css', './field-guide.css', './Zoo_Logo_ui.webp',
  './icons/icon-192.png', './icons/icon-512.png', './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
];
const absolute = (path) => new URL(path, BASE);
const isSensitive = (request, url) => request.headers.has('authorization')
  || /(?:^|\/)(?:api|[^/]*-api)(?:\/|$)/i.test(url.pathname)
  || /\/(?:auth|rest|storage)\/v1\//i.test(url.pathname);
self.addEventListener('install', (event) => event.waitUntil((async () => {
  const cache = await caches.open(CACHE);
  for (const path of PRECACHE) {
    const response = await fetch(absolute(path), { cache: 'reload', credentials: 'omit' });
    if (!response.ok) throw new Error(`Manager shell asset unavailable: ${path}`);
    await cache.put(absolute(path), response);
  }
  await self.skipWaiting();
})()));
self.addEventListener('activate', (event) => event.waitUntil((async () => {
  const keys = await caches.keys();
  await Promise.all(keys.filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE).map((key) => caches.delete(key)));
  await self.clients.claim();
})()));
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || !url.pathname.startsWith(BASE.pathname) || isSensitive(event.request, url)) return;
  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request).catch(() => caches.match(absolute('./offline.html'))));
    return;
  }
  if (!['script', 'style', 'image', 'font'].includes(event.request.destination) || url.search) return;
  event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request).then(async (response) => {
    const control = String(response.headers.get('cache-control') || '');
    if (response.ok && !/\b(?:no-store|private)\b/i.test(control)) {
      const cache = await caches.open(CACHE);
      await cache.put(event.request, response.clone());
    }
    return response;
  })));
});
