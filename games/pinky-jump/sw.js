/* Pinky Jump: per-game offline PWA (scoped to this folder only). */
const CACHE = 'pinky-jump-v13';
const ASSETS = ['./','./index.html','./style.css','./game.js?v=20261122-record-camera','./install.css','./install.js','./manifest.webmanifest','./pinky-icon.png','./app-icon.svg','./pinky-online.js?v=5','./pinky-arcade.css?v=3','./controller.html','./pinky-jump-music.mp3'];
self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE).then(cache => Promise.allSettled(ASSETS.map(path => cache.add(path)))));
});
self.addEventListener('activate', event => {
  event.waitUntil(Promise.all([
    caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('pinky-jump-') && key !== CACHE).map(key => caches.delete(key)))),
    self.clients.claim()
  ]));
});
self.addEventListener('fetch', event => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin || !url.href.startsWith(self.registration.scope)) return;
  event.respondWith(fetch(req).then(response => {
    if (response.ok) { const copy = response.clone(); event.waitUntil(caches.open(CACHE).then(cache => cache.put(req, copy)).catch(() => {})); }
    return response;
  }).catch(async () => (await caches.match(req)) || (req.mode === 'navigate' ? caches.match(url.pathname.endsWith('/controller.html') ? './controller.html' : './index.html') : Response.error())));
});
