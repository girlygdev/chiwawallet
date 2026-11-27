import { ChevronRight, CreditCard, HandCoins, PiggyBank, Receipt } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { chargedFor, loadCardCharges } from "@/lib/card-charges";
import { getCurrentBudget } from "@/lib/current-budget";
import { describeIncome, isActiveOn } from "@/lib/income";
import { type DebtTerms, debtPaidFor, debtsSummary } from "@/lib/debts";
import { formatPeso } from "@/lib/money";
import { getPeriod, scheduleFromBudget, todayInManila } from "@/lib/periods";
import { potBalance, totalSaved } from "@/lib/pots";
import { createClient } from "@/lib/supabase/server";

// More › MONEY (more-and-categories.md §1): how phones reach Income, Bills,
// Savings and Debts; desktop has them in the sidebar. Built early (Nov 19) so
// Income is reachable on mobile. Each row has a live detail line (4g):
// "3 recurring", "3 pots · ₱67,500 saved", "1 debt · ₱8,000 left".
const ROWS = [
  { href: "/income", label: "Income", icon: HandCoins, detail: <IncomeDetail /> },
  { href: "/bills", label: "Bills", icon: Receipt, detail: <BillsDetail /> },
  { href: "/savings", label: "Savings pots", icon: PiggyBank, detail: <SavingsDetail /> },
  { href: "/debts", label: "Debts", icon: CreditCard, detail: <DebtsDetail /> },
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

const DETAIL = "truncate text-[13px] text-text-3";
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

// "3 recurring" (more-and-categories.md §1).
async function BillsDetail() {
  const budget = await getCurrentBudget();
  if (!budget) return null;
  const supabase = await createClient();
  const { count } = await supabase
    .from("recurring_bills")
    .select("id", { count: "exact", head: true })
    .eq("budget_id", budget.id);
  if (count == null) return null;
  return <span className={DETAIL}>{count === 0 ? "No bills yet" : `${count} recurring`}</span>;
}

// "3 pots · ₱67,500 saved". Balances come from transactions (never stored).
async function SavingsDetail() {
  const supabase = await createClient();
  const [pots, rows] = await Promise.all([
    supabase.from("savings_pots").select("id, starting_balance"),
    supabase
      .from("transactions")
      .select("pot_id, amount, deleted_at")
      .eq("type", "savings")
      .not("pot_id", "is", null)
      .is("deleted_at", null),
  ]);
  if (!pots.data || !rows.data) return null;
  if (pots.data.length === 0) return <span className={DETAIL}>No pots yet</span>;
  const saved = totalSaved(pots.data.map((p) => potBalance(p, rows.data.filter((r) => r.pot_id === p.id))));
  return (
    <span className={DETAIL}>
      {plural(pots.data.length, "pot", "pots")} · {formatPeso(saved)} saved
    </span>
  );
}

// "1 debt · ₱8,000 left", counting active debts only.
async function DebtsDetail() {
  const budget = await getCurrentBudget();
  if (!budget) return null;
  const supabase = await createClient();
  const [debts, payments, charges] = await Promise.all([
    supabase
      .from("debts")
      .select("id, name, total_amount, payment_type, num_payments, payment_amount, first_due_date, paid_off_at"),
    supabase
      .from("transactions")
      .select("debt_id, amount, deleted_at, category:categories(system_key)")
      .eq("type", "debt_payment")
      .not("debt_id", "is", null)
      .is("deleted_at", null),
    loadCardCharges(supabase),
  ]);
  if (!debts.data || !payments.data) return null;
  const today = todayInManila(new Date());
  const summary = debtsSummary(
    debts.data.map((d) => ({
      ...d,
      // The check constraint allows only these.
      payment_type: d.payment_type as DebtTerms["payment_type"],
      ...debtPaidFor(payments.data, d.id),
      // A card's purchases count in what's owed (8b-2).
      charged: chargedFor(d, charges),
    })),
    today,
    getPeriod(today, scheduleFromBudget(budget)),
  );
  if (summary.activeCount === 0) return <span className={DETAIL}>No active debts</span>;
  return (
    <span className={DETAIL}>
      {plural(summary.activeCount, "debt", "debts")} · {formatPeso(summary.totalOwed)} left
    </span>
  );
}
