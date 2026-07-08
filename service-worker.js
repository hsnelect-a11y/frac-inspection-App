/* FRAC Equipment Inspection — Service Worker
 * Gives the installed app offline support and instant loads.
 * Bump CACHE_VERSION whenever you deploy changes so devices refresh.
 */
const CACHE_VERSION = "frac-v1";
const APP_SHELL = "./";

// Pre-cache the entry point so the app opens even with no signal.
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll([APP_SHELL]))
  );
  self.skipWaiting();
});

// Remove old caches on activation.
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;

  // Only handle GET; let the browser deal with POST/PUT (e.g. SharePoint sync).
  if (req.method !== "GET") return;

  // Page navigations: network-first, fall back to cached shell when offline.
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_VERSION).then((c) => c.put(APP_SHELL, copy));
          return res;
        })
        .catch(() => caches.match(APP_SHELL))
    );
    return;
  }

  // Other assets: stale-while-revalidate.
  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          if (res && res.status === 200 && res.type === "basic") {
            const copy = res.clone();
            caches.open(CACHE_VERSION).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
