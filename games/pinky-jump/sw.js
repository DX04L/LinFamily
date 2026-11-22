/* Pinky Jump: per-game offline PWA (scoped to this folder only). */
const CACHE = 'pinky-jump-v42';
const ASSETS = ['./','./index.html','./style.css?v=8','./locale.js?v=3','./game.js?v=20261122-ios-audio','./install.css','./install.js?v=2','./manifest.webmanifest?v=4','./pinky-icon.png?v=3','./pinky-icon-192.png?v=3','./pinky-icon-maskable.png?v=3','./apple-touch-icon.png?v=3','./name-filter.js?v=1','./pinky-online.js?v=23','./splash.css?v=2','./splash-cat.png?v=2','./pinky-arcade.css?v=18','./lf-menu.js?v=3','./controller.html','./pinky-jump-music.mp3'];
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
