import Link from "next/link";
import { formatPeriodRange } from "@/lib/periods";

// Next period (dashboard.md §3, 7d-2): a mint card in the desktop side
// column with the next period's dates, "₱33,000 expected · Electricity and
// MP2 due" (nextPeriodLine()) and Plan ahead, which opens it on the Plan.
// The page leaves it out when the line is empty (§4).
export function NextPeriodCard({ start, end, line }: { start: string; end: string; line: string }) {
  return (
    <section aria-labelledby="next-title" className="hidden flex-col gap-1.5 rounded-2xl bg-mint p-5 lg:flex">
      <h2 id="next-title" className="text-xs font-extrabold tracking-wide text-green-800 uppercase">
        Next period
      </h2>
      <p className="font-display text-xl leading-tight font-semibold text-ink">{formatPeriodRange(start, end)}</p>
      <p className="text-sm text-text-2">{line}</p>
      <Link
        href={`/plan?start=${start}`}
        className="mt-1 flex min-h-11 items-center self-start rounded-full bg-surface px-4 text-sm font-extrabold text-green-800 outline-link focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        Plan ahead
      </Link>
    </section>
  );
}
