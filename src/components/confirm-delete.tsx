"use client";

import { AlertDialog } from "@base-ui/react/alert-dialog";
import { LoaderCircle } from "lucide-react";
import { useRef } from "react";
import { FormError } from "@/components/auth/form-error";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** A question naming the thing: "Delete Main job?" (delete-pattern.md §2.1). */
  title: string;
  description: React.ReactNode;
  /** The item card and the effect rows in pesos. */
  children: React.ReactNode;
  /** Repeats the action and the object: "Delete income source". */
  confirmLabel: string;
  onConfirm: () => void;
  pending: boolean;
  error?: string;
};

// The confirmation for level 1 and 2 deletes (delete-pattern.md §2): an alert
// dialog, so screen readers announce it as a warning. Focus starts on Keep it,
// never on the red button; Esc keeps the item. Phones: a bottom sheet with
// the buttons stacked, red on top. From 768px: a centered dialog, red on the
// right.
export function ConfirmDelete({
  open,
  onOpenChange,
  title,
  description,
  children,
  confirmLabel,
  onConfirm,
  pending,
  error,
}: Props) {
  const keepRef = useRef<HTMLButtonElement>(null);
  return (
    <AlertDialog.Root open={open} onOpenChange={(next) => onOpenChange(next)}>
      <AlertDialog.Portal>
        <AlertDialog.Backdrop className="fixed inset-0 z-40 bg-sticker/50 transition-opacity duration-200 data-ending-style:opacity-0 data-starting-style:opacity-0" />
        <AlertDialog.Popup
          initialFocus={keepRef}
          className="fixed inset-x-0 bottom-0 z-50 flex max-h-[92dvh] flex-col gap-4 overflow-y-auto rounded-t-sheet bg-surface px-5 pt-5 pb-[calc(20px+env(safe-area-inset-bottom))] text-ink outline-none transition-transform duration-200 data-ending-style:translate-y-full data-starting-style:translate-y-full md:inset-x-auto md:top-1/2 md:bottom-auto md:left-1/2 md:w-[min(440px,calc(100%-32px))] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-[22px] md:border-2 md:border-sticker md:p-6 md:shadow-sticker-lg md:transition-opacity md:data-ending-style:translate-y-[-50%] md:data-ending-style:opacity-0 md:data-starting-style:translate-y-[-50%] md:data-starting-style:opacity-0"
        >
          <div className="flex flex-col gap-1.5">
            <AlertDialog.Title className="font-display text-[22px] leading-tight font-semibold">{title}</AlertDialog.Title>
            <AlertDialog.Description className="text-[15px] text-text-2">{description}</AlertDialog.Description>
          </div>

          {children}

          <FormError message={error} />

          <div className="flex flex-col gap-2 md:flex-row-reverse md:justify-start">
            <button
              type="button"
              onClick={onConfirm}
              disabled={pending}
              aria-busy={pending || undefined}
              className="flex h-[52px] items-center justify-center gap-2 rounded-md bg-danger px-5 text-base font-extrabold text-white outline-link focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-70 md:flex-1"
            >
              {pending && <LoaderCircle aria-hidden className="size-5 animate-spin" />}
              {pending ? "Deleting…" : confirmLabel}
            </button>
            <AlertDialog.Close
              ref={keepRef}
              disabled={pending}
              className="flex h-[52px] items-center justify-center rounded-md border-[1.5px] border-line bg-surface px-5 text-base font-extrabold text-ink outline-link focus-visible:outline-2 focus-visible:outline-offset-2 md:flex-1"
            >
              Keep it
            </AlertDialog.Close>
          </div>
          <p className="hidden text-center text-xs text-text-3 md:block">Press Esc to keep it.</p>
        </AlertDialog.Popup>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
