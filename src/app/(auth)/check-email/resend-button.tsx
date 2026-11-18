"use client";

import { useEffect, useState, useTransition } from "react";
import { FormError } from "@/components/auth/form-error";
import { resendConfirmation } from "../actions";

const COOLDOWN_SECONDS = 45;

// Secondary "Resend link" button with a 45-second cooldown (auth-screens.md).
// The countdown text isn't announced every second; the live region below
// only speaks when the button becomes available again.
export function ResendButton({ startReady = false }: { startReady?: boolean }) {
  const [secondsLeft, setSecondsLeft] = useState(startReady ? 0 : COOLDOWN_SECONDS);
  const [status, setStatus] = useState<string>();
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const timer = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [secondsLeft]);

  const ready = secondsLeft <= 0 && !pending;
  const label = pending
    ? "Sending…"
    : secondsLeft > 0
      ? `Resend link in 0:${String(secondsLeft).padStart(2, "0")}`
      : "Resend link";

  const onClick = () => {
    setError(undefined);
    setStatus(undefined);
    startTransition(async () => {
      const result = await resendConfirmation();
      if (result.ok) {
        setStatus("We sent a new link.");
        setSecondsLeft(COOLDOWN_SECONDS);
      } else {
        setError(result.error);
      }
    });
  };

  return (
    <div className="flex flex-col gap-3">
      <FormError message={error} />
      <button
        type="button"
        onClick={onClick}
        disabled={!ready}
        className="h-[50px] w-full rounded-md border-[1.5px] border-line bg-surface text-base font-bold text-ink outline-link hover:bg-mint focus-visible:outline-2 focus-visible:outline-offset-2 disabled:bg-surface disabled:text-text-3"
      >
        {label}
      </button>
      <p aria-live="polite" className="text-center text-[13px] font-semibold text-text-3 empty:hidden">
        {status ?? (secondsLeft === 0 && !startReady ? "You can resend the link now." : "")}
      </p>
    </div>
  );
}
