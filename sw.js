const VERSION = "biomet-pwa-1.0.0";
const STATIC_CACHE = `${VERSION}-static`;
const PAGE_CACHE = `${VERSION}-pages`;
const RUNTIME_CACHE = `${VERSION}-runtime`;

const APP_SHELL = [
  "./",
  "./index.html",
  "./schedule.html",
  "./venue.html",
  "./contact.html",
  "./offline.html",
  "./manifest.json",
  "./assets/css/style.css",
  "./assets/js/data.js",
  "./assets/js/app.js",
  "./assets/icons/logo.png",
  "./assets/icons/favicon-64.png",
  "./assets/icons/apple-touch-icon.png",
  "./assets/icons/pwa-192.png",
  "./assets/icons/pwa-512.png",
  "./assets/icons/pwa-maskable-512.png",
  "./assets/icons/shortcut-schedule.png",
  "./assets/icons/shortcut-venue.png",
  "./assets/icons/shortcut-contact.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  const currentCaches = new Set([STATIC_CACHE, PAGE_CACHE, RUNTIME_CACHE]);
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((key) => !currentCaches.has(key)).map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (!url.protocol.startsWith("http")) return;

  // Navigation and conference data use network-first so live changes are preferred.
  if (request.mode === "navigate") {
    event.respondWith(networkFirstPage(request));
    return;
  }

  if (url.origin === self.location.origin && url.pathname.endsWith("/assets/js/data.js")) {
    event.respondWith(networkFirst(request, RUNTIME_CACHE));
    return;
  }

  // OpenStreetMap tiles should stay network-driven to avoid an unbounded cache.
  if (url.hostname.includes("tile.openstreetmap.org")) return;

  // Local assets and the small set of external libraries/fonts are cached at runtime.
  event.respondWith(staleWhileRevalidate(request, RUNTIME_CACHE));
});

async function networkFirstPage(request) {
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      const cache = await caches.open(PAGE_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    return (await caches.match(request)) ||
      (await caches.match(new URL(request.url).pathname.split("/").pop())) ||
      (await caches.match("./offline.html"));
  }
}

async function networkFirst(request, cacheName) {
  try {
    const response = await fetch(request);
    if (response && (response.ok || response.type === "opaque")) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    const cached = await caches.match(request);
    if (cached) return cached;
    throw error;
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then((response) => {
      if (response && (response.ok || response.type === "opaque")) {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => cached);

  return cached || network;
}
