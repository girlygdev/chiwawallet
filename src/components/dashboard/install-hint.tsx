"use client";

import { Share, X } from "lucide-react";
import { useEffect, useState } from "react";

const DISMISSED_KEY = "chiwawallet:install-hint-dismissed";

// iPhone and iPad have no install button, so tell people how (Week 8). Shown
// only on iOS when the app isn't already opened from the Home Screen. The
// close button hides it on this device (browser storage; if that's blocked,
// it simply shows again next time).
export function InstallHint() {
  const [show, setShow] = useState(false);

  // After mount only: the server can't know the device, and rendering it
  // there would mismatch on every other phone.
  useEffect(() => {
    const ua = navigator.userAgent;
    // iPadOS reports itself as a Mac, so also check for a touch screen.
    const ios = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    const installed =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    let dismissed = false;
    try {
      dismissed = localStorage.getItem(DISMISSED_KEY) === "1";
    } catch {
      // Storage blocked (private mode): show it.
    }
    // A one-time read of the device on mount, not state derived from props.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setShow(ios && !installed && !dismissed);
  }, []);

  if (!show) return null;

  const dismiss = () => {
    setShow(false);
    try {
      localStorage.setItem(DISMISSED_KEY, "1");
    } catch {
      // Not saved: it comes back next visit, which is fine.
    }
  };

  return (
    <aside
      aria-label="Install Chiwawallet"
      className="flex items-center gap-3 rounded-2xl border-[1.5px] border-line bg-mint py-2 pr-1 pl-4 text-sm text-ink"
    >
      <Share aria-hidden size={20} className="shrink-0 text-link-hover" />
      <p className="flex-1">
        <span className="font-extrabold">Add Chiwawallet to your Home Screen:</span> tap Share, then Add to Home Screen.
      </p>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Hide this tip"
        className="flex size-11 shrink-0 items-center justify-center rounded-full text-text-2 outline-link hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        <X aria-hidden size={20} />
      </button>
    </aside>
  );
}
