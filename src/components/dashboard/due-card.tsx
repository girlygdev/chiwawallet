import { Check } from "lucide-react";
import Link from "next/link";
import { EMPTY_BUTTON, EmptyCard } from "@/components/dashboard/empty-card";
import { MarkPaidPill } from "@/components/plan/tick-button";
import { CategoryIconTile } from "@/components/transactions/category-grid";
import { formatPeso } from "@/lib/money";
import { formatShortDate } from "@/lib/periods";
import { dueInDays } from "@/lib/plan";
import type { CurrentItem } from "@/lib/plan-periods";
import { cn } from "@/lib/utils";

/** Each kind's tile (dashboard.md §2 "Due this period"). */
const TILES: Record<string, { icon: string; color: string; label: string }> = {
  bills: { icon: "zap", color: "yellow", label: "Bill" },
  debts: { icon: "credit-card", color: "red", label: "Debt" },
  savings: { icon: "piggy-bank", color: "green", label: "Savings" },
  one_off: { icon: "gift", color: "purple", label: "One-off" },
};

/** "Bill · Due Nov 22", "Savings · Planned", "One-off · Needed by Dec 5", "Paid Nov 26". */
function detailLine(item: CurrentItem): string {
  if (item.paid_at != null) return item.paidOn ? `Paid ${formatShortDate(item.paidOn)}` : "Paid";
  const label = TILES[item.section]?.label ?? "Planned";
  if (item.section === "savings") return `${label} · Planned`;
  if (item.section === "debts" && !item.dueOn) return `${label} · Extra payment`;
  if (item.section === "one_off") return item.dueOn ? `${label} · Needed by ${formatShortDate(item.dueOn)}` : label;
  return item.dueOn ? `${label} · Due ${formatShortDate(item.dueOn)}` : label;
}

/**
 * Desktop's longer line (dashboard.md §3): "Bill · Due Nov 22 · in 2 days",
 * and on a debt "· ₱4,000 left after this". Paid rows keep the short line.
 */
function longDetailLine(item: CurrentItem, today: string): string {
  const short = detailLine(item);
  if (item.paid_at != null) return short;
  const when = item.dueOn ? ` · ${dueInDays(item.dueOn, today)}` : "";
  const left = item.leftAfter != null ? ` · ${formatPeso(item.leftAfter)} left after this` : "";
  return `${short}${when}${left}`;
}

// Due this period (dashboard.md §2, task 6c): this period's bills, debt
// payments, savings and one-offs, unpaid ones first by due date, at most
// five (dueList()). Each unpaid row has Mark paid (Add to pot for savings),
// the same as Bills and Debts; the row itself opens the item on the Plan.
export function DueCard({ items, periodStart, today }: { items: CurrentItem[]; periodStart: string; today: string }) {
  return (
    <section aria-labelledby="due-title" className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h2 id="due-title" className="text-[13px] font-extrabold tracking-wide text-text-3 uppercase">
          Due this period
        </h2>
        <Link
          href={`/plan?start=${periodStart}`}
          className="flex min-h-11 items-center px-1 text-sm font-extrabold text-link outline-link focus-visible:outline-2"
        >
          <span className="lg:hidden">See all</span>
          <span className="hidden lg:inline">Open plan</span>
        </Link>
      </div>

      {items.length === 0 ? (
        // The empty card (dashboard.md §4).
        <EmptyCard
          title="No bills or debts yet"
          action={
            <Link href="/bills?add=1" className={EMPTY_BUTTON}>
              Add a bill
            </Link>
          }
        >
          Add them once and Chiwawallet reminds you each payday.
        </EmptyCard>
      ) : (
        <ul className="flex flex-col divide-y divide-line-soft rounded-2xl border-[1.5px] border-line bg-surface">
          {items.map((item) => {
            const paid = item.paid_at != null;
            const tile = TILES[item.section] ?? TILES.one_off;
            return (
              <li key={item.id} className="flex items-center gap-2 pr-3">
                <Link
                  href={`/plan?start=${periodStart}&edit=${item.id}`}
                  className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl px-4 py-3 outline-link hover:bg-bg focus-visible:outline-2 focus-visible:-outline-offset-2"
                >
                  {paid ? (
                    // A paid item's tile: solid green with a white tick.
                    <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-green-500 text-white">
                      <Check size={22} strokeWidth={3} />
                    </span>
                  ) : (
                    <CategoryIconTile icon={tile.icon} color={tile.color} size="md" />
                  )}
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate font-extrabold text-ink">{item.name}</span>
                    <span className={cn("text-[13px] lg:truncate", paid ? "font-bold text-link-hover" : "text-text-3")}>
                      <span className="lg:hidden">{detailLine(item)}</span>
                      <span className="hidden lg:inline">{longDetailLine(item, today)}</span>
                    </span>
                  </span>
                  <span className={cn("shrink-0 font-extrabold", paid ? "text-text-3" : "text-ink")}>
                    {formatPeso(paid ? (item.paidAmount ?? item.planned_amount) : item.planned_amount)}
                  </span>
                </Link>
                {/* Desktop: paid rows get a "Paid" tag where the pill was. */}
                {paid && (
                  <span className="hidden shrink-0 rounded-full bg-mint px-2.5 py-1 text-xs font-extrabold text-green-800 lg:inline">Paid</span>
                )}
                {!paid && (
                  <MarkPaidPill
                    item={{
                      id: item.id,
                      name: item.name,
                      planned_amount: item.planned_amount,
                      paid: false,
                      pot: item.pot_id != null,
                      varies: item.varies,
                    }}
                    label={item.pot_id != null ? "Add to pot" : "Mark paid"}
                  />
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
