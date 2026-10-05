/* ==========================================================================
   GRIMOIRE: LOST PAGES — Service Worker (PWA / offline)
   Versión: v69
   Cambios vs v68:
   - Añadido ./vendor/gsap.min.js al precache (setup GSAP, fase G2).
   - Bump de caché.
   Se MANTIENE el guard crítico: el SW no intercepta su propio sw.js.
   (Sin ese guard, el SW viejo sirve el sw.js viejo al navegador que pide
   actualizar, este ve bytes idénticos, no instala el nuevo y los bumps de
   CACHE_NAME son inútiles → SW inmortal. Con el guard, sw.js viaja por red
   y los cambios de versión sí se aplican.)
   Estrategia:
   - precaché del núcleo (allSettled: si una ruta falta, no tumba la instalación);
   - network-first para navegaciones;
   - cache-first para assets (excepto sw.js);
   - limpieza de cachés obsoletas.
   ========================================================================== */

const CACHE_NAME = "grimoire-lost-pages-pwa-v69";

const PRECACHE_URLS = [
  "./",
  "./index.html",
  "./style.css",
  "./game.js",
  "./vendor/gsap.min.js",
  "./src/logic.js",
  "./src/audio.js",
  "./manifest.webmanifest",
  "./icons/favicon.ico",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png",
  "./fonts/opticolumna-solid.woff2",

  /* G1: audio real (MP3) precacheado para offline */
  "./assets/audio/ui_click.mp3",
  "./assets/audio/card_attack.mp3",
  "./assets/audio/card_skill.mp3",
  "./assets/audio/card_power.mp3",
  "./assets/audio/card_heal.mp3",
  "./assets/audio/draw.mp3",
  "./assets/audio/block.mp3",
  "./assets/audio/burn.mp3",
  "./assets/audio/enemy_hit.mp3",
  "./assets/audio/player_hit.mp3",
  "./assets/audio/turn_end.mp3",
  "./assets/audio/victory.mp3",
  "./assets/audio/defeat.mp3",
  "./assets/audio/music_menu.mp3",
  "./assets/audio/music_combat.mp3"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      // allSettled: si una ruta faltara (p.ej. gsap aún no descargado),
      // no tumba la instalación entera; el resto se cachea igual.
      .then((cache) => Promise.allSettled(PRECACHE_URLS.map((url) => cache.add(url))))
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

  // Solo interceptamos GET.
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // No interceptamos peticiones externas.
  if (url.origin !== self.location.origin) return;

  // CRÍTICO: no interceptar el propio service worker (ver cabecera).
  if (url.pathname.endsWith("/sw.js")) return;

  // Navegaciones: network-first con fallback a la copia en caché.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put("./index.html", copy));
          return response;
        })
        .catch(() => caches.match("./index.html"))
    );
    return;
  }

  // Assets: cache-first con guardado en caché al primer uso.
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;

      return fetch(request).then((response) => {
        if (
          response &&
          response.status === 200 &&
          response.type === "basic"
        ) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return response;
      });
    })
  );
});
