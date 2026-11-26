import Link from "next/link";
import { CategoryIconTile } from "@/components/transactions/category-grid";
import { formatPeso } from "@/lib/money";
import type { budgetBar } from "@/lib/plan";
import { cn } from "@/lib/utils";

export type SpendingRow = {
  id: string;
  name: string;
  icon: string;
  color: string;
  planned: number;
  spent: number;
  bar: ReturnType<typeof budgetBar>;
};

// The Dashboard's Spending card (dashboard.md §2.4, task 7a): up to three
// category budgets (topBudgets(): the biggest planned), each with "₱3,240 /
// ₱6,000", an 8px bar and "₱2,760 left" or "₱340 over", the same numbers as
// the Plan. The bars are decorative: the text beside them says the same.
// Desktop (7c) adds the total across every spending line: "₱4,750 of ₱9,500".
export function SpendingCard({
  rows,
  planHref,
  total,
}: {
  rows: SpendingRow[];
  planHref: string;
  /** spendingTotal() of this period's spending lines. */
  total: { spent: number; planned: number };
}) {
  return (
    <section aria-labelledby="spending-title" className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h2 id="spending-title" className="text-[13px] font-extrabold tracking-wide text-text-3 uppercase">
          Spending<span className="hidden lg:inline"> vs plan</span>
        </h2>
        <span className="ml-auto hidden pr-2 text-sm font-bold text-text-2 lg:inline">
          {formatPeso(total.spent)} of {formatPeso(total.planned)}
        </span>
        <Link href={planHref} className="flex min-h-11 items-center px-1 text-sm font-extrabold text-link outline-link focus-visible:outline-2">
          Plan
        </Link>
      </div>
      <ul className="flex flex-col divide-y divide-line-soft rounded-2xl border-[1.5px] border-line bg-surface">
        {rows.map((r) => (
          <li key={r.id} className="flex items-center gap-3 px-4 py-3">
            <CategoryIconTile icon={r.icon} color={r.color} size="md" />
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <span className="flex items-baseline justify-between gap-3">
                <span className="truncate font-extrabold text-ink">{r.name}</span>
                <span className="shrink-0 text-sm font-bold text-ink">
                  {formatPeso(r.spent)} / {formatPeso(r.planned)}
                </span>
              </span>
              <span aria-hidden className="block h-2 overflow-hidden rounded-full bg-track">
                <span
                  className={cn(
                    "block h-full rounded-full",
                    r.bar.tone === "over" ? "bg-danger" : r.bar.tone === "near" ? "bg-gold" : "bg-green-500",
                  )}
                  style={{ width: `${r.bar.share * 100}%` }}
                />
              </span>
              <span className={cn("text-[13px] font-bold", r.bar.tone === "over" ? "text-bad-fg" : "text-text-3")}>{r.bar.text}</span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
