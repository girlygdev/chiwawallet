import { Lock } from "lucide-react";
import { formatPeso } from "@/lib/money";
import { formatMonthYear } from "@/lib/periods";
import type { PotStatus } from "@/lib/pots";
import { cn } from "@/lib/utils";

// Status in words, not only colour (savings.md §2).
export function PotStatusTag({ status }: { status: PotStatus }) {
  const TAG = "inline-flex w-fit items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold";
  switch (status.kind) {
    case "on_track":
      return <span className={cn(TAG, "bg-mint text-link-hover")}>On track for {formatMonthYear(status.date)}</span>;
    case "reached":
      return <span className={cn(TAG, "bg-mint text-link-hover")}>Goal reached</span>;
    case "locked":
      return (
        <span className={cn(TAG, "bg-track text-text-2")}>
          <Lock aria-hidden size={12} strokeWidth={2.5} />
          Locked · deposits only
        </span>
      );
    case "behind":
      return (
        <span className="flex flex-col gap-1">
          <span className={cn(TAG, "bg-warn-bg text-warn-fg")}>Behind</span>
          <span className="text-[13px] font-bold text-warn-fg">
            Save {formatPeso(status.needed)} each payday to make it by {formatMonthYear(status.by)}.
          </span>
        </span>
      );
    case "no_plan":
      return <span className={cn(TAG, "bg-track text-text-2")}>Set how much to save each payday</span>;
    case "no_target":
      return null;
  }
}

