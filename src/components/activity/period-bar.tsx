import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { formatPeriodRange } from "@/lib/periods";

const ARROW =
  "flex size-11 shrink-0 items-center justify-center rounded-[12px] text-ink outline-link focus-visible:outline-2";

// Activity's period bar (activity.md §1.2): a white card with the dates
// between previous and next arrows. The arrows are links to
// /activity?period=<start>; at either end (the first period, the current
// one) the arrow is shown disabled, so the dates don't jump around.
export function PeriodBar({
  start,
  end,
  status,
  prev,
  next,
}: {
  start: string;
  end: string;
  /** "15th payday · 7 days left", or "Past period". */
  status: string;
  prev: string | null;
  next: string | null;
}) {
  return (
    <nav
      aria-label="Period"
      className="flex items-center gap-2 rounded-2xl border-[1.5px] border-line bg-surface p-1 md:max-w-md"
    >
      <ArrowLink href={prev} label="Previous period" icon={<ChevronLeft aria-hidden size={22} />} />
      <div className="flex min-w-0 flex-1 flex-col items-center text-center" aria-live="polite">
        <p className="font-display text-lg leading-tight font-semibold text-ink">{formatPeriodRange(start, end)}</p>
        <p className="text-xs font-bold text-text-3">{status}</p>
      </div>
      <ArrowLink href={next} label="Next period" icon={<ChevronRight aria-hidden size={22} />} />
    </nav>
  );
}

function ArrowLink({ href, label, icon }: { href: string | null; label: string; icon: React.ReactNode }) {
  if (!href) {
    // A link with no href can't be focused or clicked; aria-disabled says why
    // it's there.
    return (
      <span role="link" aria-disabled="true" aria-label={label} className={`${ARROW} text-text-3 opacity-40`}>
        {icon}
      </span>
    );
  }
  return (
    <Link href={`/activity?period=${href}`} aria-label={label} className={`${ARROW} hover:bg-bg`}>
      {icon}
    </Link>
  );
}
