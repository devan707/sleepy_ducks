/** Minimal service worker — satisfies PWA install criteria; pass-through fetch only. */
self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', () => {
  /* PWA installability only — do not proxy fetch (adds latency on every asset). */
});
