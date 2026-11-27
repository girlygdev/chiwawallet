import { formatPeso } from "@/lib/money";
import { groupBudgets, type PlanSummary, type Targets } from "@/lib/plan";
import { cn } from "@/lib/utils";

const SWATCH = { needs: "bg-needs", wants: "bg-wants", savings_debt: "bg-savings-debt" } as const;

// The 50/30/20 split as group budgets (7i, owner Nov 27; was plan.md §4's
// "Planned split of income" in percentages). Each group's budget is its share
// of this payday's pay, and everything planned in the group counts against
// it: rent ₱2,000 leaves ₱10,500 of ₱12,500 for Needs. The Dashboard's
// 50/30/20 card measures what was spent; this one what's planned.
export function PlannedSplit({ split, income, targets }: { split: PlanSummary["split"]; income: number; targets: Targets }) {
  const budgets = groupBudgets(
    { needs: split.needs.planned, wants: split.wants.planned, savings_debt: split.savings_debt.planned },
    income,
    targets,
  );
  const name = `${targets.needs_pct}/${targets.wants_pct}/${targets.savings_debt_pct}`;

  return (
    <section aria-labelledby="split-title" className="flex flex-col gap-4 rounded-2xl border-[1.5px] border-line bg-surface p-5">
      <h2 id="split-title" className="font-display text-lg font-semibold text-ink">
        Your {name} budget
      </h2>

      <ul className="flex flex-col gap-3.5 text-sm">
        {budgets.map((b) => (
          <li key={b.group} className="flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between gap-3">
              <span className="flex items-center gap-2 font-bold text-ink">
                <span aria-hidden className={cn("size-3 rounded-[3px]", SWATCH[b.group])} />
                {b.label}
              </span>
              {/* Over is a heads-up, not an error: red is only for deleting. */}
              <span className={cn("font-extrabold", b.left < 0 ? "text-warn-fg" : "text-ink")}>{b.text}</span>
            </div>
            {/* The words below say the same, so the bar is decorative. */}
            <span aria-hidden className="block h-2 overflow-hidden rounded-full bg-track">
              <span className={cn("block h-full rounded-full", SWATCH[b.group])} style={{ width: `${b.share * 100}%` }} />
            </span>
            <span className="text-[13px] text-text-3">
              {formatPeso(b.planned)} of {formatPeso(b.target)} planned
            </span>
          </li>
        ))}
      </ul>

      <p className="text-[13px] text-text-3">
        {income > 0 ? `Your ${formatPeso(income)} pay this payday, split ${name}.` : "No pay is expected this payday."} Bills,
        savings, spending budgets and one-offs count toward their group. Planned debt payments count as needs; anything extra
        counts as savings &amp; debt payoff.
      </p>
    </section>
  );
}
