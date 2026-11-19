const CACHE_NAME = 'jiangzicui-group-v3';
const ASSETS = [
  './',
  './index.html',
  './manifest.json?v=3',
  './favicon.ico?v=3',
  './icons/apple-touch-icon.png?v=3',
  './icons/icon-192.png?v=3',
  './icons/icon-512.png?v=3',
  './icons/logo-book.svg?v=3'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    fetch(event.request)
      .then((res) => {
        const resClone = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, resClone));
        return res;
      })
      .catch(() => caches.match(event.request))
  );
});