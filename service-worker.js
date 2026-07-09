/* FRAC Equipment Inspection — Service Worker
 * Offline support + instant loads, WITHOUT ever serving a stale app.
 * Bump CACHE_VERSION on every deploy so devices refresh.
 */
const CACHE_VERSION = "frac-2026-07-09";
const APP_SHELL = "./";

// Always pull the shell straight from the network (never the HTTP cache) so
// a new deploy is picked up immediately; fall back to cache only when offline.
function freshFetch(url) {
  return fetch(url, { cache: "no-store", credentials: "same-origin" });
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) =>
      freshFetch(APP_SHELL)
        .then((res) => cache.put(APP_SHELL, res.clone()))
        .catch(() => {})
    )
  );
  self.skipWaiting();
});

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
  if (req.method !== "GET") return;

  // Page loads: fresh-from-network first, cached shell only if offline.
  if (req.mode === "navigate") {
    event.respondWith(
      freshFetch(req.url)
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
