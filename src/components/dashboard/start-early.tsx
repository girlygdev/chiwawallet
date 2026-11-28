"use client";

import { AlertDialog } from "@base-ui/react/alert-dialog";
import { LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { startNextPeriodEarly } from "@/app/(app)/dashboard/actions";
import { FormError } from "@/components/auth/form-error";
import { useAppToast } from "@/components/transactions/add-transaction-provider";
import type { StartEarly } from "@/lib/early-pay";
import { formatPeso } from "@/lib/money";
import { formatPeriodRange, formatShortDate } from "@/lib/periods";

/**
 * Start my next period now (owner, Nov 28; Task D3), shown once pay for the
 * next payday is logged early. Inside the Cash card on phones, a Forest
 * banner on desktop, like the pay prompts. The dialog shows the effect in
 * pesos first, because there's no undo. Green, not red: nothing is deleted.
 */
export function StartEarlyPrompt({ offer, className }: { offer: StartEarly; className: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-white ${className}`}>
      <p className="text-sm font-bold">
        Your {formatShortDate(offer.payday)} pay is in. Start spending from it now?
      </p>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="h-10 shrink-0 rounded-[10px] bg-white px-4 text-sm font-extrabold text-green-800 outline-white focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        Start my next period now
      </button>
      <StartEarlyDialog offer={offer} open={open} onOpenChange={setOpen} />
    </div>
  );
}

function StartEarlyDialog({ offer, open, onOpenChange }: { offer: StartEarly; open: boolean; onOpenChange: (open: boolean) => void }) {
  const router = useRouter();
  const showToast = useAppToast();
  const notYetRef = useRef<HTMLButtonElement>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();
  const payday = formatShortDate(offer.payday);

  const confirm = () => {
    setError(undefined);
    startTransition(async () => {
      const result = await startNextPeriodEarly();
      if ("formError" in result) {
        setError(result.formError);
        return;
      }
      onOpenChange(false);
      if (result.askOnPayday) {
        // The payday screen asks what to do with the old period's leftover.
        router.push(`/payday?start=${result.oldStart}`);
      } else {
        // Ask me on payday is off: the Dashboard carries it over on reload.
        showToast({ id: Date.now(), text: `Your ${payday} period started. ${formatPeso(result.leftover)} carried over.` });
        router.refresh();
      }
    });
  };

  return (
    <AlertDialog.Root open={open} onOpenChange={(next) => !pending && onOpenChange(next)}>
      <AlertDialog.Portal>
        <AlertDialog.Backdrop className="fixed inset-0 z-40 bg-sticker/50 transition-opacity duration-200 data-ending-style:opacity-0 data-starting-style:opacity-0" />
        {/* The same sheet-then-dialog layout as ConfirmDelete. */}
        <AlertDialog.Popup
          initialFocus={notYetRef}
          className="fixed inset-x-0 bottom-0 z-50 flex max-h-[92dvh] flex-col gap-4 overflow-y-auto rounded-t-sheet bg-surface px-5 pt-5 pb-[calc(20px+env(safe-area-inset-bottom))] text-ink outline-none transition-transform duration-200 data-ending-style:translate-y-full data-starting-style:translate-y-full md:inset-x-auto md:top-1/2 md:bottom-auto md:left-1/2 md:w-[min(440px,calc(100%-32px))] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-[22px] md:border-2 md:border-sticker md:p-6 md:shadow-sticker-lg md:transition-opacity md:data-ending-style:translate-y-[-50%] md:data-ending-style:opacity-0 md:data-starting-style:translate-y-[-50%] md:data-starting-style:opacity-0"
        >
          <div className="flex flex-col gap-1.5">
            <AlertDialog.Title className="font-display text-[22px] leading-tight font-semibold">
              Start your {payday} period today?
            </AlertDialog.Title>
            <AlertDialog.Description className="text-[15px] text-text-2">This can&apos;t be undone.</AlertDialog.Description>
          </div>

          <ul className="flex flex-col gap-2 rounded-xl border-[1.5px] border-line p-4 text-[15px]">
            <li>
              {formatPeriodRange(offer.oldStart, offer.oldEnd)} ends yesterday with{" "}
              <strong className="font-extrabold">{formatPeso(offer.leftover)} left</strong>
            </li>
            {offer.movingOut > 0 && <li>{formatPeso(offer.movingOut)} spent today moves to the new period</li>}
            <li>Your {formatPeso(offer.pay)} pay counts from today</li>
          </ul>

          <FormError message={error} />

          <div className="flex flex-col gap-2 md:flex-row-reverse md:justify-start">
            <button
              type="button"
              onClick={confirm}
              disabled={pending}
              aria-busy={pending || undefined}
              className="flex h-[52px] items-center justify-center gap-2 rounded-md bg-green-600 px-5 text-base font-extrabold text-white outline-link focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-70 md:flex-1"
            >
              {pending && <LoaderCircle aria-hidden className="size-5 animate-spin" />}
              {pending ? "Starting…" : "Start now"}
            </button>
            <AlertDialog.Close
              ref={notYetRef}
              disabled={pending}
              className="flex h-[52px] items-center justify-center rounded-md border-[1.5px] border-line bg-surface px-5 text-base font-extrabold text-ink outline-link focus-visible:outline-2 focus-visible:outline-offset-2 md:flex-1"
            >
              Not yet
            </AlertDialog.Close>
          </div>
        </AlertDialog.Popup>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
