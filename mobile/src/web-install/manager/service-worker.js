const CACHE_PREFIX = 'memphis-zoo-custodial-manager-shell-';
const BASE = new URL('./', self.location.href);
const FAMILY = `${CACHE_PREFIX}${encodeURIComponent(BASE.pathname)}:`;
const CACHE = `${FAMILY}__MZ_EXACT_CACHE_ID__`;
const PRECACHE = [
  // Keep new shell identities available on the first offline launch.
  './assets/trail-v1/dashboard.svg',
  './assets/trail-v1/map.svg',
  './assets/trail-v1/messenger.svg',
  './assets/trail-v1/schedule.svg',
  './assets/trail-v1/staffing.svg',
  './assets/trail-v1/insights.svg',
  './assets/trail-v1/events.svg',
  './assets/trail-v1/feedback.svg',
  './assets/trail-v1/notifications.svg',
  './assets/trail-v1/unfinished.svg',
  './assets/trail-v1/phones.svg',
  './assets/trail-v1/supplies.svg',
  './assets/trail-v1/dashboard-320.webp',
  './assets/trail-v1/map-320.webp',
  './assets/trail-v1/messenger-320.webp',
  './assets/trail-v1/schedule-320.webp',
  './assets/trail-v1/staffing-320.webp',
  './assets/trail-v1/insights-320.webp',
  './assets/trail-v1/events-320.webp',
  './assets/trail-v1/feedback-320.webp',
  './assets/trail-v1/notifications-320.webp',
  './assets/trail-v1/unfinished-320.webp',
  './assets/trail-v1/phones-320.webp',
  './assets/trail-v1/supplies-320.webp',
  './trail-pages/manager-notifications.css',
  './trail-pages/manager-manager-access.css',
  "./trail-terracotta.css", "./trail-pages/manager-index.css", "./trail-pages/web-install-manager-offline.css", "./assets/trail-v1/terracotta.webp",
  './index.html', './offline.html', './manifest.webmanifest', './pwa-register.js',
  './mobile.css', './field-guide.css', './Zoo_Logo_ui.webp',
  './icons/icon-192.png', './icons/icon-512.png', './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
];
const absolute = (path) => new URL(path, BASE);
const isSensitive = (request, url) => request.headers.has('authorization')
  || /(?:^|\/)(?:api|[^/]*-api)(?:\/|$)/i.test(url.pathname)
  || /\/(?:auth|rest|storage)\/v1\//i.test(url.pathname);
const offlineUrl = absolute('./offline.html').href;
const readOffline = request => caches.match(request, {cacheName:CACHE});
self.addEventListener('install', event => event.waitUntil((async () => {
  const cache = await caches.open(CACHE);
  try {
    for (const path of PRECACHE) {
      const response = await fetch(absolute(path), { cache: 'reload', credentials: 'omit' });
      const control = response.headers.get('cache-control') || '';
      if (!response.ok || /\b(?:no-store|private)\b/i.test(control)) throw new Error(`Offline shell asset unavailable: ${path}`);
      await cache.put(absolute(path), response);
    }
  } catch (error) {
    await caches.delete(CACHE);
    throw error;
  }
  // Existing tabs stay with their original worker until the browser can
  // safely activate this release. A partial install is never read.
})()));
self.addEventListener('activate', event => event.waitUntil((async () => {
  const keys = await caches.keys();
  await Promise.all(keys.filter(key => key.startsWith(FAMILY) && key !== CACHE).map(key => caches.delete(key)));
  await self.clients.claim();
})()));
self.addEventListener('fetch', event => {
  const {request} = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || !url.pathname.startsWith(BASE.pathname) || isSensitive(request, url)) return;
  if (request.mode === 'navigate') {
    if (url.href === offlineUrl) {
      event.respondWith(readOffline(offlineUrl).then(response => response || new Response('Offline', {status:503})));
    } else {
      event.respondWith(fetch(request, {cache:'no-cache'}).catch(() => Response.redirect(offlineUrl)));
    }
    return;
  }
  if (!['script', 'style', 'image', 'font'].includes(request.destination)) return;
  if (request.referrer === offlineUrl) {
    event.respondWith(readOffline(request).then(response => response || fetch(request, {cache:'no-cache'})));
  } else {
    // Online HTML and its mutable asset URLs must come from the same current
    // site, even while the next worker is still installing.
    event.respondWith(fetch(request, {cache:'no-cache'}));
  }
});
