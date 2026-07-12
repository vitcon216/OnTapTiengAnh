const CACHE_NAME = 'engvocab-cache-v2';
const urlsToCache = [
  './',
  './index.html',
  './manifest.json',
  './assets/icon.svg',
  './css/main.css',
  './css/components.css',
  './css/animations.css',
  './css/variables.css',
  './js/app.js',
  './js/data.js'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        return cache.addAll(urlsToCache);
      })
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    fetch(event.request).catch(() => {
      return caches.match(event.request);
    })
  );
});
