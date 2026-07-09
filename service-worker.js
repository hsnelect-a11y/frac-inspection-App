/* FRAC Equipment Inspection — Service Worker
 * Offline support + instant loads, without ever serving a stale app.
 * Bump CACHE_VERSION on every deploy.
 */
const CACHE_VERSION = "frac-2026-07-09b";
const APP_SHELL = "./";

function freshFetch(url) {
  return fetch(url, { cache: "no-store", credentials: "same-origin" });
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) =>
      freshFetch(APP_SHELL).then((res) => cache.put(APP_SHELL, res.clone())).catch(() => {})
    )
  );
  // NOTE: no skipWaiting here — a new version waits so it can't reload you
  // mid-report. The in-app Refresh button (or closing all tabs) activates it.
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Let the page tell a waiting worker to activate immediately (Refresh button).
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

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
