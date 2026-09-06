const CACHE_PREFIX = 'tw-cheerleader-pwa-';
const CACHE_NAME = `${CACHE_PREFIX}v13`;
const LEGACY_CACHES = ['tw-cheerleader-pwa-v1'];
const APP_SHELL = ['./', './index.html', './manifest.json', './pwa.js', './favicon-32.png', './twc-app-icon-v3-180.png', './twc-app-icon-v3-192.png', './twc-app-icon-v3-512.png', './src/app/navigation.js', './src/app/navigation-config.js', './src/app/girls-mobile-filters.js', './src/app/game-app-enhancements.js?v=2', './src/app/gacha-history.js?v=1', './src/app/navigation.css', './src/storage/legacy-storage.js', './src/services/data-loader.js?v=4'];

const isOwnedCache = key => key.startsWith(CACHE_PREFIX) || LEGACY_CACHES.includes(key);
const canStore = (request, response) => request.cache !== 'no-store' && response && response.ok && response.type !== 'error';

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)));
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(key => isOwnedCache(key) && key !== CACHE_NAME).map(key => caches.delete(key))))
    .then(() => self.clients.claim()));
});

self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  if (request.cache === 'no-store') { event.respondWith(fetch(request)); return; }

  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).then(response => {
      const cacheResponse = canStore(request, response) ? response.clone() : null;
      if (cacheResponse) event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.put('./index.html', cacheResponse)).catch(() => undefined));
      return response;
    }).catch(async () => (await caches.match('./index.html')) || (await caches.match('./')) || new Response('目前離線，且尚無可用內容。', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } })));
    return;
  }

  event.respondWith(caches.match(request).then(cached => {
    const update = fetch(request).then(response => {
      const cacheResponse = canStore(request, response) ? response.clone() : null;
      if (cacheResponse) event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.put(request, cacheResponse)).catch(() => undefined));
      return response;
    });
    if (cached) { event.waitUntil(update.catch(() => undefined)); return cached; }
    return update.catch(() => new Response('Offline', { status: 503 }));
  }));
});