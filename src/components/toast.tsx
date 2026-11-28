"use client";

import { useEffect } from "react";

/** How long a toast stays (style-guide.md "Sheets, dialogs and toasts"). */
const TOAST_MS = 5000;

export type ToastMessage = {
  /** Changes for every new toast, so the 5-second timer restarts. */
  id: number;
  text: string;
  action?: { label: string; onClick: () => void };
};

// Our own toast (decided Nov 20): ink background, white text, at the top of
// the screen (moved from the bottom Nov 28), with one action like Undo. Gone after 5 seconds.
// The live region is always on the page, so screen readers announce each
// message as it's put inside.
export function Toast({ toast, onDismiss }: { toast: ToastMessage | null; onDismiss: () => void }) {
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(onDismiss, TOAST_MS);
    return () => clearTimeout(timer);
  }, [toast, onDismiss]);

  return (
    <div
      role="status"
      aria-live="polite"
      // Top of the screen (owner, Nov 28): below the notch/status bar on
      // phones, top right of the page on desktop. Only the toast itself
      // takes taps; the empty strip around it lets them through.
      className="pointer-events-none fixed inset-x-4 top-[calc(12px+env(safe-area-inset-top))] z-50 flex justify-center md:inset-x-auto md:top-6 md:right-6"
    >
      {toast && (
        <div className="pointer-events-auto flex w-full max-w-[420px] items-center justify-between gap-3 rounded-lg bg-ink py-2 pr-2 pl-4 text-[15px] font-bold text-surface shadow-xl">
          <span>{toast.text}</span>
          {toast.action && (
            <button
              type="button"
              onClick={toast.action.onClick}
              className="h-11 shrink-0 rounded-md px-3 font-extrabold text-mint outline-mint focus-visible:outline-2"
            >
              {toast.action.label}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
