import type { Metadata } from "next";
import { TryAgainButton } from "./try-again-button";

export const metadata: Metadata = { title: "You're offline · Chiwawallet" };

// Shown by the service worker (src/app/sw.ts) in place of a page that can't
// load without a connection. Static, with no data, so it's safe to keep on
// the phone. The mascot comes from the precached public files.
export default function OfflinePage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-5 px-6 py-10 text-center">
      {/* Decorative: the heading says what's wrong. */}
      {/* eslint-disable-next-line @next/next/no-img-element -- static SVG, no optimisation needed */}
      <img src="/logo-mark.svg" alt="" width={96} height={96} />
      <h1 className="font-display text-[28px] leading-[1.1] font-semibold text-ink">You&apos;re offline</h1>
      <p className="text-[15px] text-text-2">Chiwawallet needs a connection to load your plan. Try again when you&apos;re back online.</p>
      <TryAgainButton />
    </main>
  );
}
