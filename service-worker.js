self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(Promise.resolve());
});

self.addEventListener('activate', event => {
  self.clients.claim();
  event.waitUntil(Promise.resolve());
});

self.addEventListener('fetch', () => {
  return;
});
