const CACHE_NAME = 'linfamily-v1';
self.addEventListener('install', () => { self.skipWaiting(); });
self.addEventListener('activate', (e) => { e.waitUntil(clients.claim()); });
self.addEventListener('fetch', () => {
  // 交由網路直接處理
});
