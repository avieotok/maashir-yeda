// Service Worker for "מעשיר את הידע"
const CACHE_NAME = 'maashir-yeda-v1';
const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png',
  'https://fonts.googleapis.com/css2?family=David+Libre:wght@400;500;700&family=Frank+Ruhl+Libre:wght@400;500;700;900&family=Heebo:wght@300;400;500;700&display=swap',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(ASSETS).catch(err => console.log('Cache partial:', err)))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(names =>
      Promise.all(names.filter(n => n !== CACHE_NAME).map(n => caches.delete(n)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) {
        fetch(event.request).then(r => {
          if (r && r.status === 200) {
            const rc = r.clone();
            caches.open(CACHE_NAME).then(c => c.put(event.request, rc));
          }
        }).catch(() => {});
        return cached;
      }
      return fetch(event.request).then(r => {
        if (r && r.status === 200 && r.type === 'basic') {
          const rc = r.clone();
          caches.open(CACHE_NAME).then(c => c.put(event.request, rc));
        }
        return r;
      }).catch(() => new Response('אין חיבור לאינטרנט.', { status: 503 }));
    })
  );
});
