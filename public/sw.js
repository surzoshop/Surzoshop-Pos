// Minimal pass-through service worker.
// Purpose: enable Chrome/Android PWA install prompt. Does NOT cache anything.
self.addEventListener("install", (e) => { self.skipWaiting(); });
self.addEventListener("activate", (e) => { e.waitUntil(self.clients.claim()); });
// Required for installability — must respond to fetch events but we just pass through.
self.addEventListener("fetch", (event) => {
  // Network-only, no caching at all (avoids stale-content issues).
  return;
});
