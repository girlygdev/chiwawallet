"use client";

import { SerwistProvider } from "@serwist/turbopack/react";

// Registers the service worker (src/app/sw.ts) on every page.
// - Off in development, so `npm run dev` never serves stale files.
// - cacheOnNavigation off: pages are never cached (money data stays off the phone).
// - reloadOnOnline off: coming back online shouldn't wipe a half-filled form.
export function ServiceWorker({ children }: { children: React.ReactNode }) {
  return (
    <SerwistProvider
      swUrl="/serwist/sw.js"
      disable={process.env.NODE_ENV === "development"}
      cacheOnNavigation={false}
      reloadOnOnline={false}
    >
      {children}
    </SerwistProvider>
  );
}
