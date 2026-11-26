import type { ReactNode } from "react";
import { Logo } from "@/components/auth/logo";

/** The soft button an empty card ends with (a link or an OpenAddSheetButton). */
export const EMPTY_BUTTON =
  "flex min-h-11 items-center rounded-full bg-mint px-4 text-sm font-extrabold text-green-800 outline-link focus-visible:outline-2 focus-visible:outline-offset-2";

// The Dashboard's empty section cards (dashboard.md §4, 7d-1): a dashed
// line-dash card with the mascot, a title, one sentence and a soft button.
export function EmptyCard({ title, children, action }: { title: string; children: ReactNode; action: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl border-[1.5px] border-dashed border-line-dash bg-surface p-5 text-center">
      <Logo size={56} decorative />
      <p className="font-display text-lg font-semibold text-ink">{title}</p>
      <p className="text-sm text-text-2">{children}</p>
      {action}
    </div>
  );
}
