"use client";

import { Dialog } from "@base-ui/react/dialog";
import { X } from "lucide-react";

type SheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
};

// The add/edit sheet used across the app (style-guide.md "Sheets, dialogs and
// toasts"). Under 768px it slides up from the bottom with 28px top corners and
// a grab handle; from 768px it's a centered dialog, max 440px wide.
//
// Base UI's Dialog does the accessibility work: it traps focus inside, closes
// on Esc or a click outside, returns focus to what opened it, and hides the
// rest of the page from screen readers while open.
export function Sheet({ open, onOpenChange, title, description, children }: SheetProps) {
  return (
    <Dialog.Root open={open} onOpenChange={(next) => onOpenChange(next)}>
      <Dialog.Portal>
        {/* Dims the screen behind at 50%. */}
        <Dialog.Backdrop className="fixed inset-0 z-40 bg-sticker/50 transition-opacity duration-200 data-ending-style:opacity-0 data-starting-style:opacity-0" />
        <Dialog.Popup className="fixed inset-x-0 bottom-0 z-50 flex max-h-[92dvh] flex-col rounded-t-sheet bg-surface pb-[env(safe-area-inset-bottom)] text-ink shadow-xl outline-none transition-transform duration-200 data-ending-style:translate-y-full data-starting-style:translate-y-full md:inset-x-auto md:top-1/2 md:bottom-auto md:left-1/2 md:w-[calc(100%-32px)] md:max-w-[440px] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-xl md:border-2 md:border-sticker md:pb-0 md:shadow-sticker-lg md:transition-opacity md:data-ending-style:translate-y-[-50%] md:data-ending-style:opacity-0 md:data-starting-style:translate-y-[-50%] md:data-starting-style:opacity-0">
          {/* Grab handle: a visual cue on phones only. */}
          <div aria-hidden className="mx-auto mt-2.5 h-1 w-10 shrink-0 rounded-full bg-line md:hidden" />

          <div className="flex items-start justify-between gap-3 px-5 pt-3 pb-2 md:px-6 md:pt-5">
            <div className="flex flex-col gap-1">
              <Dialog.Title className="font-display text-[22px] leading-tight font-semibold">{title}</Dialog.Title>
              {description && (
                <Dialog.Description className="text-sm text-text-3">{description}</Dialog.Description>
              )}
            </div>
            <Dialog.Close
              aria-label="Close"
              className="-mt-1 -mr-2 flex size-11 shrink-0 items-center justify-center rounded-full text-text-2 outline-link hover:bg-bg focus-visible:outline-2"
            >
              <X aria-hidden size={22} />
            </Dialog.Close>
          </div>

          {/* Scrolls when the form is taller than the screen. */}
          <div className="overflow-y-auto px-5 pt-2 pb-5 md:px-6 md:pb-6">{children}</div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
