import { ChevronRight, CreditCard, HandCoins, PiggyBank, Receipt } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { getCurrentBudget } from "@/lib/current-budget";
import { describeIncome, isActiveOn } from "@/lib/income";
import { scheduleFromBudget, todayInManila } from "@/lib/periods";
import { createClient } from "@/lib/supabase/server";

// More › MONEY (more-and-categories.md §1): how phones reach Income, Bills,
// Savings and Debts; desktop has them in the sidebar. Built early (Nov 19) so
// Income is reachable on mobile. Detail lines for Bills, Savings and Debts
// arrive with those features (Weeks 4–6).
const ROWS = [
  { href: "/income", label: "Income", icon: HandCoins, detail: <IncomeDetail /> },
  { href: "/bills", label: "Bills", icon: Receipt },
  { href: "/savings", label: "Savings pots", icon: PiggyBank },
  { href: "/debts", label: "Debts", icon: CreditCard },
];

export function MoneySection() {
  return (
    <section aria-labelledby="money-title" className="flex flex-col gap-2">
      <h2 id="money-title" className="text-[13px] font-extrabold tracking-wide text-text-3 uppercase">
        Money
      </h2>
      <ul className="overflow-hidden rounded-2xl border-[1.5px] border-line bg-surface">
        {ROWS.map(({ href, label, icon: Icon, detail }) => (
          <li key={href} className="border-t border-line-soft first:border-t-0">
            <Link
              href={href}
              className="flex min-h-14 items-center gap-3 px-3.5 py-3 outline-link hover:bg-bg focus-visible:outline-2 focus-visible:-outline-offset-2"
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-[12px] bg-mint text-link-hover">
                <Icon aria-hidden size={20} />
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="font-extrabold text-ink">{label}</span>
                {/* The detail reads the database, so it streams in after the row. */}
                {detail && <Suspense>{detail}</Suspense>}
              </span>
              <ChevronRight aria-hidden size={20} className="shrink-0 text-text-3" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

// "2 sources · ₱58,000 a month", counting sources paying today.
async function IncomeDetail() {
  const budget = await getCurrentBudget();
  if (!budget) return null;
  const supabase = await createClient();
  const { data: sources } = await supabase
    .from("income_sources")
    .select("amount, pay_slot, start_date, end_date")
    .eq("budget_id", budget.id);
  if (!sources) return null;
  const today = todayInManila(new Date());
  const active = sources.filter((s) => isActiveOn(s, today));
  return (
    <span className="truncate text-[13px] text-text-3">
      {active.length === 0 ? "No income sources yet" : describeIncome(active, scheduleFromBudget(budget))}
    </span>
  );
}
