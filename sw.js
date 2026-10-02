/* ==========================================================================
   GRIMOIRE: LOST PAGES — SERVICE WORKER
   PWA / offline básico.
   Versión v2 para forzar reinstall limpia en Android.
   ========================================================================== */

const CACHE_NAME = "grimoire-lost-pages-pwa-v2";

const CORE_ASSETS = [
  "./",
  "./index.html",
  "./style.css",
  "./game.js",
  "./src/logic.js",
  "./manifest.webmanifest",
  "./icons/favicon.ico",
  "./icons/icon-192.png",
  "./icons/icon-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(CORE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;

  if (request.method !== "GET") {
    return;
  }

  const requestUrl = new URL(request.url);

  // Navegaciones: red primero, fallback a index.html en caché.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put("./index.html", copy);
            });
          }

          return response;
        })
        .catch(() => caches.match("./index.html"))
    );

    return;
  }

  // Solo mismos dominio.
  if (requestUrl.origin !== self.location.origin) {
    return;
  }

  // Si alguien pide index.html con query, también fallback a caché básica.
  if (requestUrl.pathname.endsWith("/index.html")) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put("./index.html", copy);
            });
          }

          return response;
        })
        .catch(() => caches.match("./index.html"))
    );

    return;
  }

  // Assets: caché primero, luego red, y se actualiza en segundo plano.
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      const networkFetch = fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.ok) {
            const copy = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, copy);
            });
          }

          return networkResponse;
        })
        .catch(() => cachedResponse);

      return cachedResponse || networkFetch;
    })
  );
});
