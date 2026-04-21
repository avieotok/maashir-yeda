// Service Worker - תמיכה בעבודה אופליין
// "מעשיר את הידע" v3.5.0 (Remote screenshot feature)

const CACHE_NAME = 'maashir-yeda-v3.5.0';
const FILES_TO_CACHE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './icon-512-maskable.png',
  './apple-touch-icon.png',
  // Google Fonts
  'https://fonts.googleapis.com/css2?family=Assistant:wght@300;400;500;600;700;800&family=Heebo:wght@300;400;500;700&display=swap'
];

// Install: cache app shell + SKIP WAITING so new version takes over immediately
self.addEventListener('install', (event) => {
  console.log('[SW] Install v3.3.0');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Caching app shell');
      return cache.addAll(FILES_TO_CACHE).catch((err) => {
        console.warn('[SW] Some files failed to cache:', err);
      });
    })
  );
  // Force immediate activation - don't wait for old SW to release
  self.skipWaiting();
});

// Listen for skipWaiting message from main app (user clicked Update button)
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    console.log('[SW] Skipping waiting on user request');
    self.skipWaiting();
  }
});

// Activate: clean up old caches + CLAIM existing clients + FORCE RELOAD old clients
self.addEventListener('activate', (event) => {
  console.log('[SW] Activate v3.3.0');
  event.waitUntil(
    (async () => {
      // Delete ALL old caches (aggressive migration)
      const keyList = await caches.keys();
      await Promise.all(keyList.map((key) => {
        if (key !== CACHE_NAME) {
          console.log('[SW] Removing old cache:', key);
          return caches.delete(key);
        }
      }));

      // Take over all open clients
      await self.clients.claim();

      // Force all open windows to reload with new version
      const allClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      allClients.forEach((client) => {
        // Try to navigate the client to force reload with new SW
        if ('navigate' in client) {
          try {
            client.navigate(client.url).catch(() => {
              // Fallback: send reload message
              client.postMessage({ type: 'FORCE_RELOAD' });
            });
          } catch (e) {
            client.postMessage({ type: 'FORCE_RELOAD' });
          }
        } else {
          client.postMessage({ type: 'FORCE_RELOAD' });
        }
      });
    })()
  );
});

// Fetch: network-first for HTML (to catch updates), cache-first for assets
self.addEventListener('fetch', (event) => {
  // Only handle GET requests
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  const isHTML = event.request.destination === 'document' || url.pathname.endsWith('.html') || url.pathname === '/' || url.pathname.endsWith('/');

  // Network-first for HTML to catch updates quickly
  if (isHTML) {
    event.respondWith(
      fetch(event.request).then((response) => {
        if (response && response.status === 200) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      }).catch(() => {
        return caches.match(event.request).then(r => r || caches.match('./index.html'));
      })
    );
    return;
  }

  // Cache-first for everything else
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(event.request).then((response) => {
        // Cache Google Fonts and own assets dynamically
        if (
          response &&
          response.status === 200 &&
          (event.request.url.includes('fonts.g') ||
            event.request.url.includes(self.location.origin))
        ) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      }).catch(() => {
        // Offline and not cached
        if (event.request.destination === 'document') {
          return caches.match('./index.html');
        }
      });
    })
  );
});
