/// <reference lib="webworker" />
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { CacheFirst, ExpirationPlugin, NetworkOnly, Serwist } from "serwist";

// The service worker (Week 8, owner Nov 27). It keeps the app's own static
// files so it opens faster, and shows /offline instead of the browser's error
// page when there's no signal. It never caches pages or Supabase data: money
// data must not sit in a phone's cache (a shared or lost phone), and offline
// editing is out of scope for the MVP.

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    // Filled in at build time with the JS, CSS and public files (the route's
    // precache manifest), plus /offline.
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  // A new deploy takes over straight away, so nobody is stuck on old code.
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    // Pages: always from the network. When that fails, the fallback below.
    { matcher: ({ request }) => request.mode === "navigate", handler: new NetworkOnly() },
    // Fonts and images from this site (icons, the mascot): kept for 30 days.
    {
      matcher: ({ request, sameOrigin }) => sameOrigin && (request.destination === "font" || request.destination === "image"),
      handler: new CacheFirst({
        cacheName: "static-media",
        plugins: [new ExpirationPlugin({ maxEntries: 64, maxAgeSeconds: 30 * 24 * 60 * 60 })],
      }),
    },
    // Everything else (Supabase, server actions, page data): network only.
    { matcher: () => true, handler: new NetworkOnly() },
  ],
  fallbacks: {
    entries: [{ url: "/offline", matcher: ({ request }) => request.destination === "document" }],
  },
});

serwist.addEventListeners();
