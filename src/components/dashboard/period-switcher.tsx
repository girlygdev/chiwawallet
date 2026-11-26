import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { formatPeriodRange } from "@/lib/periods";

const ARROW = "flex size-11 shrink-0 items-center justify-center rounded-[12px] outline-link focus-visible:outline-2 lg:size-10";

// The Dashboard's period switcher (app-shell.md §4, 7d-2): the dates and the
// status line between previous and next arrows. The Dashboard always shows
// now, so the arrows open those periods on the Plan (decision 2). In the
// first period there's no previous one: that arrow is shown disabled, so
// the dates don't move.
export function PeriodSwitcher({
  start,
  end,
  status,
  prev,
  next,
}: {
  start: string;
  end: string;
  /** "15th payday · 4 days left", or "Your first payday period · Day 12 of 15". */
  status: string;
  /** The previous and next periods' starts (dashboardNeighbors()). */
  prev: string | null;
  next: string | null;
}) {
  return (
    <section aria-label="This period" className="flex items-center gap-1">
      <Arrow start={prev} label="Previous period" icon={<ChevronLeft aria-hidden size={22} />} />
      <div className="flex min-w-0 flex-col px-1">
        <p className="font-display text-2xl leading-tight font-semibold text-ink">{formatPeriodRange(start, end)}</p>
        <p className="text-[13px] font-bold text-text-3">{status}</p>
      </div>
      <Arrow start={next} label="Next period" icon={<ChevronRight aria-hidden size={22} />} />
    </section>
  );
}

function Arrow({ start, label, icon }: { start: string | null; label: string; icon: React.ReactNode }) {
  if (!start) {
    // No href: it can't be focused or clicked; aria-disabled says why it's there.
    return (
      <span role="link" aria-disabled="true" aria-label={label} className={`${ARROW} text-text-3 opacity-40`}>
        {icon}
      </span>
    );
  }
  return (
    <Link href={`/plan?start=${start}`} aria-label={label} className={`${ARROW} text-ink hover:bg-surface`}>
      {icon}
    </Link>
  );
}
