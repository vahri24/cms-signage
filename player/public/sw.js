const CACHE_NAME = 'signage-player-v1';
const CONFIG_PATH = '/media/config.json';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) => Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

// media/config.json is fetched with a cache-busting ?t= query (see
// index.html) so the network always gets a fresh copy - but that means
// every request has a different URL. Normalize the cache key to just the
// pathname so repeated fetches read/write the same single cache entry.
function configCacheKey() {
  return new Request(self.location.origin + CONFIG_PATH);
}

async function networkFirst(request, cacheKey) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetch(request);
    if (response && response.ok) cache.put(cacheKey, response.clone());
    return response;
  } catch (err) {
    const cached = await cache.match(cacheKey);
    if (cached) return cached;
    throw err;
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response && response.ok) cache.put(request, response.clone());
  return response;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname === CONFIG_PATH) {
    event.respondWith(networkFirst(request, configCacheKey()));
    return;
  }

  // Uploaded filenames are content-addressed (admin appends a random
  // suffix per upload), so a cached media file is permanently valid.
  if (url.pathname.startsWith('/media/')) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // App shell (/, /index.html, /sw.js, /assets/*): stay fresh when online,
  // fall back to the last cached copy when offline.
  event.respondWith(networkFirst(request, request));
});

// index.html tells us which media files the current display actually uses
// after each config refresh, so we can evict anything else (old slides that
// rotated out) instead of letting the cache grow forever.
self.addEventListener('message', (event) => {
  const data = event.data;
  if (!data || data.type !== 'PRUNE_MEDIA') return;

  const keep = new Set(data.files || []);
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      const requests = await cache.keys();
      await Promise.all(
        requests.map((req) => {
          const path = new URL(req.url).pathname;
          if (!path.startsWith('/media/') || path === CONFIG_PATH) return undefined;
          const filename = decodeURIComponent(path.slice('/media/'.length));
          return keep.has(filename) ? undefined : cache.delete(req);
        })
      );
    })
  );
});
