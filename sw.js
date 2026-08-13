const CACHE_NAME = 'kikes-preop-v28';
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.json',
  './app_icon_192.png',
  './app_icon_512.png',
  './Kikes_logo.png',
  './lib/dexie.min.js',
  './lib/pdf-lib.min.js'
];

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  // Network-first strategy for app files to fetch latest edits immediately
  e.respondWith(
    fetch(e.request).then((networkResponse) => {
      if (e.request.method === 'GET' && networkResponse.status === 200) {
        const responseClone = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(e.request, responseClone);
        });
      }
      return networkResponse;
    }).catch(() => {
      // Fallback to cache when offline
      return caches.match(e.request);
    })
  );
});
