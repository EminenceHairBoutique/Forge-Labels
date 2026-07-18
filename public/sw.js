/*
 * Forge Labels service worker — deliberately conservative.
 *
 * Cache-first ONLY for content-hashed immutables (/_next/static) and the
 * bundled font library; network-first for page navigations with a cached
 * fallback (offline reopen of the local-mode studio). Everything else —
 * API routes, Supabase, Stripe, blobs — is never intercepted, so no
 * write, auth, or billing path can ever be served stale.
 */
const VERSION = "fl-sw-v1";
const STATIC_CACHE = `${VERSION}-static`;
const PAGE_CACHE = `${VERSION}-pages`;

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => !key.startsWith(VERSION))
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Immutable, content-hashed assets + bundled fonts: cache-first.
  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/fonts/") ||
    url.pathname.startsWith("/icons/")
  ) {
    event.respondWith(
      caches.open(STATIC_CACHE).then(async (cache) => {
        const hit = await cache.match(request);
        if (hit) return hit;
        const response = await fetch(request);
        if (response.ok) cache.put(request, response.clone());
        return response;
      }),
    );
    return;
  }

  // Page navigations: network-first, cached copy when offline.
  if (request.mode === "navigate") {
    event.respondWith(
      caches.open(PAGE_CACHE).then(async (cache) => {
        try {
          const response = await fetch(request);
          if (response.ok) cache.put(request, response.clone());
          return response;
        } catch {
          const hit = await cache.match(request);
          if (hit) return hit;
          const shell = await cache.match("/dashboard");
          if (shell) return shell;
          return new Response(
            "<!doctype html><title>Offline</title><h1>You're offline</h1><p>Reconnect to open Forge Labels.</p>",
            { status: 503, headers: { "Content-Type": "text/html" } },
          );
        }
      }),
    );
  }
  // Everything else (API routes, data fetches): untouched.
});
