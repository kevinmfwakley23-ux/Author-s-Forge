const CACHE = "authors-forge-shell-v15";
const SHELL = [
  "/",
  "/index.html",
  "/series.html",
  "/styles.css",
  "/app.js",
  "/forge-command-center.js",
  "/forge-workbench.js",
  "/forge-ai-proposals.js",
  "/forge-editing-proposals.js",
  "/forge-story-map.js",
  "/forge-story-architecture.js",
  "/forge-chapter-cards.js",
  "/forge-chapter-card-workflow.js",
  "/forge-chapter-card-approval.js",
  "/forge-scene-cards.js",
  "/forge-manuscript-import.js",
  "/forge-series.js",
  "/forge-image-lab.js",
  "/forge-pwa.js",
  "/manifest.webmanifest",
  "/icon.svg",
  "/icon-192.svg",
  "/icon-512.svg"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))).then(() => self.clients.claim()));
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET" || new URL(request.url).origin !== self.location.origin) return;
  const url = new URL(request.url);
  if (url.pathname.startsWith("/api/")) return;

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy)).catch(() => {});
        }
        return response;
      })
      .catch(async () => {
        const exact = await caches.match(request);
        if (exact) return exact;
        const shellPath = await caches.match(url.pathname);
        if (shellPath) return shellPath;
        return caches.match("/index.html");
      })
  );
});
