"use client";

// Reloads the page that failed: the service worker shows /offline at the
// address you asked for, so a reload tries that page again.
export function TryAgainButton() {
  return (
    <button
      type="button"
      onClick={() => window.location.reload()}
      className="flex h-[52px] items-center justify-center rounded-md bg-green-600 px-6 text-base font-extrabold text-white outline-link hover:bg-green-600/90 focus-visible:outline-2 focus-visible:outline-offset-2"
    >
      Try again
    </button>
  );
}
