/* CenterWay app-shell worker.
 *
 * Deliberately does not cache content. Chrome will not offer installation
 * unless a service worker answers a navigation while offline, so exactly one
 * document is precached — /offline.html — and it is served only when the
 * network actually fails. Everything else is a pass-through, which means a
 * deploy can never be shadowed by a stale copy sitting in a user's cache.
 *
 * If real offline reading of lessons is added later, it belongs in a second
 * cache with its own version and its own invalidation, not in this one.
 */
// v2: offline.html changed (the broken-mark illustration). The browser only
// reinstalls this worker when its own bytes differ, so a content-only edit to
// the precached document needs this bump — otherwise an already-installed
// client keeps serving the old cached page from the Cache API forever.
const SHELL_CACHE = "cw-shell-v3";
const OFFLINE_URL = "/offline.html";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.add(new Request(OFFLINE_URL, { cache: "reload" })))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== SHELL_CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  if (request.mode !== "navigate") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(request).catch(() =>
      caches.open(SHELL_CACHE).then((cache) => cache.match(OFFLINE_URL)),
    ),
  );
});
