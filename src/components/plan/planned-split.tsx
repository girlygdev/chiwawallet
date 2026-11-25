import { formatPeso } from "@/lib/money";
import type { PlanSummary } from "@/lib/plan";

const percent = new Intl.NumberFormat("en-PH", { style: "percent", maximumFractionDigits: 0 });

// "Planned split of income" (plan.md §4): each group's PLANNED amount as a
// share of this payday's income, next to the budget's target. The
// Dashboard's 50/30/20 card measures what was spent; this one what's planned.
export function PlannedSplit({ split, income }: { split: PlanSummary["split"]; income: number }) {
  const rows = [
    { key: "needs", label: "Needs", swatch: "bg-needs", ...split.needs },
    { key: "wants", label: "Wants", swatch: "bg-wants", ...split.wants },
    { key: "savings_debt", label: "Savings & debt payoff", swatch: "bg-savings-debt", ...split.savings_debt },
  ];
  // The bar can't show more than 100%: scale it down when too much is planned.
  const total = Math.max(1, rows.reduce((sum, r) => sum + r.share, 0) + split.notAssignedShare);

  return (
    <section aria-labelledby="split-title" className="flex flex-col gap-3 rounded-2xl border-[1.5px] border-line bg-surface p-5">
      <h2 id="split-title" className="font-display text-lg font-semibold text-ink">
        Planned split of income
      </h2>

      {/* The rows below say the same in words, so the bar is decorative. */}
      <div aria-hidden className="flex h-3 overflow-hidden rounded-full bg-track">
        {rows.map((r) => (
          <div key={r.key} className={r.swatch} style={{ width: `${(r.share / total) * 100}%` }} />
        ))}
      </div>

      <ul className="flex flex-col gap-2 text-sm">
        {rows.map((r) => (
          <li key={r.key} className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2 font-bold text-text-2">
              <span aria-hidden className={`size-3 rounded-[3px] ${r.swatch}`} />
              {r.label}
            </span>
            <span className="text-text-3">
              <span className="font-extrabold text-ink">{percent.format(r.share)}</span> · target {percent.format(r.target)}
            </span>
          </li>
        ))}
        <li className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-2 font-bold text-text-2">
            <span aria-hidden className="size-3 rounded-[3px] bg-track" />
            Not assigned
          </span>
          <span className="font-extrabold text-ink">{percent.format(split.notAssignedShare)}</span>
        </li>
      </ul>

      <p className="text-[13px] text-text-3">
        Of this payday&apos;s {formatPeso(income)} income. Planned debt payments count as needs; anything extra counts as
        savings &amp; debt payoff.
      </p>
    </section>
  );
}
