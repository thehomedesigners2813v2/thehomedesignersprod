const CACHE_VERSION = 'interior-design-v4';
const CACHE_NAME = `${CACHE_VERSION}-${self.registration.scope}`;
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.svg'
];

// Install event - precache essential static assets only
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .catch((error) => {
        console.error('Cache installation failed:', error);
      })
  );
  self.skipWaiting();
});

// Activate event - purge ALL old caches and stale entries
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME) {
              console.log('Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
            return undefined;
          })
        );
      })
      .then(() => {
        // Clean up stale entries from current cache (e.g. old hashed JS bundles)
        return caches.open(CACHE_NAME).then((cache) => {
          return cache.keys().then((requests) => {
            return Promise.all(
              requests.map((request) => {
                // Only keep precache URLs; remove everything else (dynamic fetches)
                const url = new URL(request.url);
                const isPrecache = PRECACHE_URLS.some(
                  (path) => url.pathname === path
                );
                if (!isPrecache) {
                  return cache.delete(request);
                }
                return undefined;
              })
            );
          });
        });
      })
      .then(() => self.clients.claim())
  );
});

// Fetch event strategy:
// - Navigation requests: network-first (so new deploys always show), cache fallback offline
// - Static assets (JS/CSS/images): cache-first with network update (immutable hashed files)
// - Everything else: network, no caching
self.addEventListener('fetch', (event) => {
  const request = event.request;

  // Skip cross-origin requests
  if (!request.url.startsWith(self.location.origin)) {
    return;
  }

  // Navigation requests: network-first so new deploys are always served
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseToCache);
            });
          }
          return response;
        })
        .catch(() => {
          return caches.match(request).then((response) => {
            return response || caches.match('/index.html');
          }).then((response) => response || Response.error());
        })
    );
    return;
  }

  // Static assets with hashes (JS, CSS, fonts, images): stale-while-revalidate
  const url = new URL(request.url);
  const isImmutableAsset =
    url.pathname.startsWith('/assets/') ||
    /\.(?:js|css|woff2?|ttf|png|jpg|jpeg|gif|svg|webp|ico)$/i.test(url.pathname);

  if (request.method === 'GET' && isImmutableAsset) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const networkFetch = fetch(request)
          .then((response) => {
            if (response && response.status === 200) {
              const responseToCache = response.clone();
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(request, responseToCache);
              });
            }
            return response;
          })
          .catch(() => cached || Response.error());
        return cached || networkFetch;
      })
    );
    return;
  }

  // All other same-origin GET requests: network-first, no caching
  if (request.method === 'GET') {
    event.respondWith(
      fetch(request).catch(() => caches.match(request).then((cached) => cached || Response.error()))
    );
  }
});

// Handle messages from the client
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
