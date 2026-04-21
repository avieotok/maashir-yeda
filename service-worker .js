// Service Worker - תמיכה בעבודה אופליין
// "מעשיר את הידע" v3.2.5 (Auto-update notification support)

const CACHE_NAME = 'maashir-yeda-v3.2.5';
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

// Install: cache app shell
self.addEventListener('install', (event) => {
  console.log('[SW] Install');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Caching app shell');
      return cache.addAll(FILES_TO_CACHE).catch((err) => {
        console.warn('[SW] Some files failed to cache:', err);
      });
    })
  );
  // Don't call skipWaiting() here - wait for user to click "Update" button
});

// Listen for skipWaiting message from main app (user clicked Update button)
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    console.log('[SW] Skipping waiting on user request');
    self.skipWaiting();
  }
});

// Activate: clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activate');
  event.waitUntil(
    caches.keys().then((keyList) => {
      return Promise.all(keyList.map((key) => {
        if (key !== CACHE_NAME) {
          console.log('[SW] Removing old cache:', key);
          return caches.delete(key);
        }
      }));
    })
  );
  self.clients.claim();
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
