const CACHE = "authors-forge-hosted-shell-v1";
const SHELL = [
  "/",
  "/index.html",
  "/series.html",
  "/styles.css",
  "/forge-royal-hardening.css",
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
  "/forge-royal-ui.js",
  "/forge-pwa.js",
  "/forge-hosted-client.js",
  "/forge-hosted-client.css",
  "/manifest.webmanifest",
  "/icon.svg",
  "/icon-192.svg",
  "/icon-512.svg"
];

const OFFICE_API = /^\/(?:journal|workbooks|specialized)\/api(?:\/|$)/;
const ROOT_API = /^\/api(?:\/|$)/;

function isProjectStateRequest(url) {
  return ROOT_API.test(url.pathname) || OFFICE_API.test(url.pathname);
}

function isSensitiveGatewayPath(url) {
  return url.pathname.startsWith("/__forge/") || url.searchParams.has("access");
}

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
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || isProjectStateRequest(url) || isSensitiveGatewayPath(url)) return;

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
        if (url.pathname.startsWith("/journal/")) return (await caches.match("/journal/")) || caches.match("/index.html");
        if (url.pathname.startsWith("/workbooks/")) return (await caches.match("/workbooks/")) || caches.match("/index.html");
        if (url.pathname.startsWith("/specialized/")) return (await caches.match("/specialized/")) || caches.match("/index.html");
        return caches.match("/index.html");
      })
  );
});
