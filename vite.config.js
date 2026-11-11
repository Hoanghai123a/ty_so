import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function offlineServiceWorker() {
  return {
    name: "offline-service-worker",
    apply: "build",
    generateBundle(_, bundle) {
      const publicFiles = [
        "h2-billiard.png",
        "qr-links.txt",
        "manifest.webmanifest",
        "icons/app-icon-192.png",
        "icons/app-icon-512.png",
        "icons/apple-touch-icon.png",
      ];
      const precache = new Set(["/", ...publicFiles.map((file) => `/${file}`)]);
      const contentHash = createHash("sha256");

      for (const output of Object.values(bundle)) {
        precache.add(`/${output.fileName}`);
        contentHash.update(output.type === "asset" ? output.source : output.code);
      }
      for (const file of publicFiles) {
        contentHash.update(readFileSync(resolve("public", file)));
      }

      const cacheName = `ty-so-offline-${contentHash.digest("hex").slice(0, 12)}`;
      const source = `
const CACHE_PREFIX = "ty-so-offline-";
const CACHE_NAME = ${JSON.stringify(cacheName)};
const PRECACHE_URLS = ${JSON.stringify([...precache])};

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(
    keys.filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME).map((key) => caches.delete(key)),
  )).then(() => self.clients.claim()));
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(fetch(request).then(async (response) => {
      if (!response.ok) return (await caches.match("/")) || (await caches.match("/index.html")) || response;
      await (await caches.open(CACHE_NAME)).put("/", response.clone());
      return response;
    }).catch(async () => (await caches.match("/")) || (await caches.match("/index.html")) || Response.error()));
    return;
  }

  if (url.pathname === "/qr-links.txt") {
    event.respondWith(fetch(request).then(async (response) => {
      if (!response.ok) return (await caches.match(url.href)) || response;
      await (await caches.open(CACHE_NAME)).put(url.href, response.clone());
      return response;
    }).catch(async () => (await caches.match(url.href)) || Response.error()));
    return;
  }

  event.respondWith(caches.match(request).then((cached) => cached || fetch(request)));
});
`;

      this.emitFile({ type: "asset", fileName: "service-worker.js", source });
    },
  };
}

export default defineConfig({
  plugins: [react(), offlineServiceWorker()],
  server: {
    host: "127.0.0.1",
    port: 5176,
    strictPort: true,
  },
});
