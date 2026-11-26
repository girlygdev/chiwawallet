import Link from "next/link";
import { formatPeso } from "@/lib/money";
import type { PlanSummary as Summary } from "@/lib/plan";

/** "₱25,000 income + ₱5,000 carried in", or for a future period "₱33,000 expected · carry-in not known yet". */
export function incomeLine(income: number, carriedIn: number | null): string {
  return carriedIn == null
    ? `${formatPeso(income)} expected · carry-in not known yet`
    : `${formatPeso(income)} income + ${formatPeso(carriedIn)} carried in`;
}

// The Plan's summary card (plan.md §3), the page's one sticker element:
// Money for this period, a bar of how much is planned, and the Planned and
// Not assigned yet key. All numbers come from planSummary().
export function PlanSummary({
  summary,
  income,
  carriedIn,
  empty = false,
  assignHref = null,
}: {
  summary: Summary;
  income: number;
  /** Empty for future periods: their carry-in isn't known yet. */
  carriedIn: number | null;
  /** Nothing planned but income: the plain version (plan.md §5). */
  empty?: boolean;
  /** Give leftover a job (6f), while there's money left and the period hasn't ended. */
  assignHref?: string | null;
}) {
  const { moneyForPeriod, planned, notAssigned } = summary;

  // The empty plan (§5): a plain card, since the starter card is that area's sticker.
  if (empty) {
    return (
      <section aria-labelledby="plan-summary-title" className="flex flex-col gap-2 rounded-2xl border-[1.5px] border-line bg-surface p-[18px]">
        <div className="flex flex-col gap-0.5">
          <h2 id="plan-summary-title" className="text-sm font-bold text-text-2">
            Money for this period
          </h2>
          <p className="font-display text-[26px] leading-tight font-semibold text-ink">{formatPeso(moneyForPeriod)}</p>
          <p className="text-[13px] text-text-3">incl. {formatPeso(income)} {carriedIn == null ? "expected" : "income"}</p>
        </div>
        <p className="text-sm text-text-2">
          <span className="font-extrabold text-ink">Planned: {formatPeso(planned)}</span>, {formatPeso(notAssigned)} not
          assigned
        </p>
      </section>
    );
  }
  const percent = moneyForPeriod > 0 ? Math.min(100, Math.round((planned / moneyForPeriod) * 100)) : planned > 0 ? 100 : 0;

  return (
    <section
      aria-labelledby="plan-summary-title"
      className="flex flex-col gap-3 rounded-[22px] border-2 border-sticker bg-surface p-[18px] shadow-sticker"
    >
      <div className="flex flex-col gap-0.5">
        <h2 id="plan-summary-title" className="text-sm font-bold text-text-2">
          Money for this period
        </h2>
        <p className="font-display text-[26px] leading-tight font-semibold text-ink">{formatPeso(moneyForPeriod)}</p>
        <p className="text-[13px] text-text-3">
          {incomeLine(income, carriedIn)}
        </p>
      </div>

      {/* The key below says the same in words, so the bar is decorative. */}
      <div aria-hidden className="h-3 overflow-hidden rounded-full bg-mint">
        <div className="h-full rounded-full bg-green-500" style={{ width: `${percent}%` }} />
      </div>

      <dl className="flex flex-col gap-1.5 text-sm">
        <div className="flex items-center justify-between gap-3">
          <dt className="flex items-center gap-2 font-bold text-text-2">
            <span aria-hidden className="size-3 rounded-[3px] bg-green-500" />
            Planned
          </dt>
          <dd className="font-extrabold text-ink">{formatPeso(planned)}</dd>
        </div>
        <div className="flex items-center justify-between gap-3">
          <dt className="flex items-center gap-2 font-bold text-text-2">
            <span aria-hidden className="size-3 rounded-[3px] border-[1.5px] border-line-dash bg-mint" />
            Not assigned yet
          </dt>
          <dd className="font-extrabold text-ink">{formatPeso(notAssigned)}</dd>
        </div>
      </dl>

      {/* Too much planned: say it in words, in the warning colours (red is for deletes only). */}
      {notAssigned < 0 && (
        <p className="rounded-[12px] bg-warn-bg px-3 py-2 text-[13px] font-bold text-warn-fg">
          You&apos;ve planned {formatPeso(-notAssigned)} more than this period has.
        </p>
      )}

      {/* "Assign the ₱8,800" (plan.md §3): a Soft button to Give leftover a job. */}
      {assignHref && notAssigned > 0 && (
        <Link
          href={assignHref}
          className="flex min-h-11 items-center justify-center rounded-[12px] bg-mint px-4 text-sm font-extrabold text-green-800 outline-link focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          Assign the {formatPeso(notAssigned)}
        </Link>
      )}
    </section>
  );
}
