import type { SpentGroup } from "@/lib/money";
import type { BudgetGroup } from "@/lib/transactions";

const GROUPS: { key: BudgetGroup; label: string; swatch: string }[] = [
  { key: "needs", label: "Needs", swatch: "bg-needs" },
  { key: "wants", label: "Wants", swatch: "bg-wants" },
  { key: "savings_debt", label: "Savings & debt payoff", swatch: "bg-savings-debt" },
];

// The Dashboard's 50/30/20 check (dashboard.md §5, task 7b): what was spent
// so far this period by group, against the budget's targets. The Plan's
// "Planned split of income" shows what's planned; this is what happened.
// Mobile says "Target 50%"; desktop "11 pts over 50%", "above 20%". The
// stacked bar is decorative: the rows say the same in words.
export function SplitCard({ groups }: { groups: Record<BudgetGroup, SpentGroup> }) {
  return (
    <section aria-labelledby="split-title" className="flex flex-col gap-3 rounded-2xl border-[1.5px] border-line bg-surface p-5">
      <h2 id="split-title" className="font-extrabold text-ink">
        50/30/20 check
      </h2>
      <span aria-hidden className="flex h-3.5 gap-0.5 overflow-hidden rounded-full bg-track">
        {GROUPS.map(({ key, swatch }) =>
          groups[key].share > 0 ? <span key={key} className={`h-full ${swatch}`} style={{ width: `${groups[key].share * 100}%` }} /> : null,
        )}
      </span>
      <ul className="flex flex-col gap-2 text-sm">
        {GROUPS.map(({ key, label, swatch }) => (
          <li key={key} className="flex items-center gap-2">
            <span aria-hidden className={`size-2.5 shrink-0 rounded-sm ${swatch}`} />
            <span className="min-w-0 flex-1 text-ink">{label}</span>
            <span className="font-extrabold text-ink">{groups[key].pct}%</span>
            <span className="w-32 shrink-0 text-right text-text-3">
              <span className="md:hidden">Target {groups[key].target}%</span>
              <span className="hidden md:inline">{groups[key].compare}</span>
            </span>
          </li>
        ))}
      </ul>
      <p className="text-[13px] text-text-3">Share of money out so far this period. Extra debt payments count as savings &amp; debt payoff.</p>
    </section>
  );
}
