import { Check, Pencil, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { HeaderStickerLink, PageHeader } from "@/components/shell/page-header";
import { PageShell } from "@/components/shell/page-shell";
import { Skeleton, SkeletonRegion } from "@/components/skeleton";
import { MarkPaidPill } from "@/components/plan/tick-button";
import { OpenAddSheetButton } from "@/components/transactions/add-transaction-provider";
import { CategoryIconTile } from "@/components/transactions/category-grid";
import { loadCardCharges } from "@/lib/card-charges";
import { cardCharged, cardNextPayment, cardOwedText } from "@/lib/cards";
import {
  cardBalance,
  type DebtTerms,
  debtPaidFor,
  debtProgress,
  isSettled,
  debtsSummary,
  isPaidOff,
  type PaymentStatus,
  paydayFor,
  paymentStatusText,
} from "@/lib/debts";
import { formatPeso } from "@/lib/money";
import { formatMonthYear, formatShortDate, getPeriod, type PaySchedule, scheduleFromBudget, todayInManila } from "@/lib/periods";
import { potProgress } from "@/lib/pots";
import { cardDueInPeriod, debtItemToPay } from "@/lib/plan";
import { payableDebtItems } from "@/lib/plan-periods";
import { requireAppUser } from "@/lib/require-app-user";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { DebtSheet } from "./debt-sheet";

export const metadata: Metadata = { title: "Debts · Chiwawallet" };

const ADD_HREF = "/debts?add=1";
/** PAID OFF shows three rows, then "Show more" (debts.md §2). */
const PAID_OFF_ROWS = 3;

// The Debts screen (debts.md, week-4-tasks.md 4f-1): total owed and when
// you're debt-free, then each active debt with its next payment and full
// schedule, then the paid-off ones. Plain and encouraging: no jokes here.
// Each card holds its schedule on every screen size (fix #4), so there's no
// separate details page. New and Edit debt open in a sheet (`?add=1`,
// `?edit=…`, `?delete=…`; 4f-2). Mark paid on the next payment comes from its
// plan item (6b-2); Pay extra comes with the Transfer tab (6d-2).
export default function DebtsPage() {
  return (
    <PageShell>
      {/* Cache Components: the totals come from the database (cookies). */}
      <Suspense fallback={<DebtsSkeleton />}>
        <DebtsContent />
      </Suspense>
    </PageShell>
  );
}

// A loan, BNPL, one payment or "When I can"; credit cards are Card below.
type Debt = Omit<DebtTerms, "payment_type"> & {
  payment_type: Exclude<DebtTerms["payment_type"], "card">;
  id: string;
  name: string;
  lender: string | null;
  interest_rate: number | null;
  paid_off_at: string | null;
  paid: number;
  /** Extra payments among `paid`: they shrink the last payments first. */
  extraPaid: number;
};

// A credit card (8b-2): no schedule; its balance is worked out from its
// purchases and payments (cardBalance()).
type Card = {
  id: string;
  name: string;
  lender: string | null;
  /** The balance when it was added. */
  total_amount: number;
  due_day: number;
  pay_slot: string;
  interest_rate: number | null;
  paid_off_at: string | null;
  paid: number;
  /** Everything bought with it. */
  charged: number;
  /** Bought with it this period. */
  chargedNow: number;
  /** Starting balance + purchases − payments; below 0 is a credit. */
  balance: number;
};

async function DebtsContent() {
  const { budget } = await requireAppUser();
  const supabase = await createClient();
  const [debtRows, paymentRows, charges] = await Promise.all([
    supabase
      .from("debts")
      .select(
        "id, name, lender, total_amount, payment_type, num_payments, payment_amount, first_due_date, interest_rate, paid_off_at, target_date, due_day, pay_slot",
      )
      .order("first_due_date")
      .order("created_at"),
    // Every live payment, for what's been paid ("left" is never stored).
    supabase
      .from("transactions")
      .select("debt_id, amount, deleted_at, category:categories(system_key)")
      .eq("type", "debt_payment")
      .not("debt_id", "is", null)
      .is("deleted_at", null),
    // What was bought with each card (8b-2).
    loadCardCharges(supabase),
  ]);
  for (const result of [debtRows, paymentRows]) {
    if (result.error) throw new Error(`Couldn't load debts: ${result.error.message}`, { cause: result.error });
  }
  const schedule = scheduleFromBudget(budget);
  const today = todayInManila(new Date());
  const period = getPeriod(today, schedule);

  const debts: Debt[] = debtRows
    .data!.filter((d) => d.payment_type !== "card")
    .map((d) => ({
      ...d,
      // The check constraint allows only these; cards are below.
      payment_type: d.payment_type as Exclude<DebtTerms["payment_type"], "card">,
      // Total paid, and the extra payments that shrink the last payments (debts.md §5).
      ...debtPaidFor(paymentRows.data!, d.id),
    }));
  const cards: Card[] = debtRows
    .data!.filter((d) => d.payment_type === "card" && d.due_day != null && d.pay_slot != null)
    .map((d) => {
      const { paid } = debtPaidFor(paymentRows.data!, d.id);
      return {
        id: d.id,
        name: d.name,
        lender: d.lender,
        total_amount: d.total_amount,
        due_day: d.due_day!,
        pay_slot: d.pay_slot!,
        interest_rate: d.interest_rate,
        paid_off_at: d.paid_off_at,
        paid,
        charged: cardCharged(charges, d.id),
        chargedNow: cardCharged(charges, d.id, period),
        // Purchases and payments both carry card_id; payments came in above.
        balance: cardBalance(d.total_amount, charges, d.id) - paid,
      };
    });

  // Debt items that can be paid now, for Mark paid on each card (6b-2).
  const payable = await payableDebtItems(supabase, budget, today);
  const summary = debtsSummary(
    [
      ...debts,
      ...cards.map((c) => ({
        ...c,
        payment_type: "card" as const,
        num_payments: null,
        payment_amount: null,
        first_due_date: null,
      })),
    ],
    today,
    period,
  );
  const active = debts.filter((d) => !isPaidOff(d));
  const paidOff = debts.filter((d) => isPaidOff(d));
  const openCards = cards.filter((c) => c.paid_off_at == null);
  const closedCards = cards.filter((c) => c.paid_off_at != null);
  const activeCount = active.length + openCards.length;

  return (
    <>
      <PageHeader
        title="Debts"
        eyebrow={
          summary.activeCount > 0
            ? `${formatPeso(summary.totalOwed)} left${summary.debtFreeBy ? ` · debt-free by ${formatShortDate(summary.debtFreeBy)}` : ""}`
            : "Loans, cards and money you owe"
        }
        mobile={{ backHref: "/more", backLabel: "Back to More" }}
        mobileAction={
          <Link
            href={ADD_HREF}
            scroll={false}
            aria-label="Add debt"
            className="flex size-11 items-center justify-center rounded-[14px] border-2 border-sticker bg-green-500 text-white shadow-sticker-sm outline-link focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            <Plus aria-hidden size={22} strokeWidth={2.5} />
          </Link>
        }
        desktopAction={<HeaderStickerLink href={ADD_HREF}>Add debt</HeaderStickerLink>}
      />

      {debts.length + cards.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          <section aria-label="Debt totals" className="grid gap-3 md:grid-cols-2 md:gap-4 lg:grid-cols-4">
            {/* Phones: white, so the amount owed stays neutral and the green bar
                carries the good news (debts.md fix #1, owner Nov 24). From md, with
                the stat cards: the page's one hero, Deep Green with a sticker border. */}
            <div className="flex flex-col gap-2 rounded-xl border-[1.5px] border-line bg-surface p-5 text-ink md:col-span-2 md:border-2 md:border-sticker md:bg-green-700 md:text-white md:shadow-sticker lg:col-span-1">
              <p className="text-sm font-bold text-text-2 md:text-white md:opacity-90">Total owed</p>
              <p className="font-display text-[34px] leading-none font-semibold">{formatPeso(summary.totalOwed)}</p>
              {summary.debtFreeBy && (
                <p className="text-sm text-text-2 md:text-white md:opacity-90">
                  Debt-free by {formatShortDate(summary.debtFreeBy)} if you keep the plan
                </p>
              )}
              {summary.activeTotal > 0 && (
                <>
                  <span aria-hidden className="block h-2 overflow-hidden rounded-full bg-track md:bg-white/25">
                    <span
                      className="block h-full rounded-full bg-green-600 md:bg-white"
                      style={{ width: `${(potProgress(summary.activePaid, summary.activeTotal) ?? 0) * 100}%` }}
                    />
                  </span>
                  <p className="text-sm font-bold text-link-hover md:font-normal md:text-white md:opacity-90">
                    {formatPeso(summary.activePaid)} of {formatPeso(summary.activeTotal)} paid
                  </p>
                </>
              )}
            </div>
            {/* Desktop's other stat cards (debts.md §3). */}
            <Stat
              label="Due this period"
              value={formatPeso(summary.dueThisPeriod)}
              note={summary.nextDue ? `${summary.nextDue.name} · ${formatShortDate(summary.nextDue.date)}` : "Nothing due"}
            />
            <Stat
              label="Debt-free by"
              value={summary.debtFreeBy ? formatShortDate(summary.debtFreeBy) : "—"}
              note="if you keep the plan"
            />
            <Stat
              label="Paid off so far"
              value={formatPeso(summary.paidSoFar)}
              note={
                summary.paidOffCount > 0
                  ? `incl. ${summary.paidOffCount} finished ${summary.paidOffCount === 1 ? "debt" : "debts"}`
                  : "Every payment logged"
              }
            />
          </section>

          {activeCount > 0 && (
            <section aria-labelledby="active-title" className="flex flex-col gap-3">
              <h2 id="active-title" className="text-xs font-extrabold tracking-wide text-text-3 uppercase">
                Active · {activeCount === 1 ? "1 debt" : `${activeCount} debts`}
              </h2>
              <ul className="grid gap-3 lg:grid-cols-2 lg:items-start">
                {active.map((debt) => (
                  <li key={debt.id}>
                    <DebtCard debt={debt} schedule={schedule} today={today} period={period} payable={payable} />
                  </li>
                ))}
                {openCards.map((card) => (
                  <li key={card.id}>
                    <CreditCard card={card} schedule={schedule} today={today} payable={payable} />
                  </li>
                ))}
              </ul>
              <p className="text-[13px] text-text-3">
                Planned payments count as Needs. Extra payments count toward <strong>Savings &amp; debt payoff</strong>{" "}
                in your 50/30/20 split.
                {openCards.length > 0 && " Card purchases count when you buy them, so paying a card doesn't count again."}
              </p>
            </section>
          )}

          {paidOff.length + closedCards.length > 0 && (
            <PaidOff
              rows={[
                ...paidOff.map((d) => ({ id: d.id, name: d.name, amount: d.total_amount, date: d.paid_off_at, closed: false })),
                // A closed card shows what it owed when closed (usually ₱0).
                ...closedCards.map((c) => ({ id: c.id, name: c.name, amount: Math.max(0, c.balance), date: c.paid_off_at, closed: true })),
              ]}
            />
          )}
        </>
      )}

      <DebtSheet
        debts={debts.map((debt) => ({ ...debt, left: debtProgress(debt, debt.paid, today, period).left }))}
        cards={cards.map((card) => ({ ...card, left: Math.max(0, card.balance) }))}
        schedule={schedule}
        today={today}
      />
    </>
  );
}

function Stat({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="hidden flex-col gap-1 rounded-xl border-[1.5px] border-line bg-surface p-4 md:flex">
      <p className="text-[13px] font-bold text-text-3">{label}</p>
      <p className="font-display text-[22px] leading-none font-semibold text-ink">{value}</p>
      <p className="text-[13px] text-text-3">{note}</p>
    </div>
  );
}

const STATUS_TONE: Record<PaymentStatus, string> = {
  paid: "bg-mint text-link-hover",
  cleared: "bg-mint text-link-hover",
  due: "bg-warn-bg text-warn-fg",
  planned: "bg-track text-text-2",
  // An error tone, not the destructive red (style-guide.md).
  late: "bg-bad-bg text-bad-fg",
};

// An active debt (debts.md §2): header, next payment, and the schedule as an
// ordered list (§6), each payment with its status in words and its payday.
function DebtCard({
  debt,
  schedule,
  today,
  period,
  payable,
}: {
  debt: Debt;
  schedule: PaySchedule;
  today: string;
  period: { start: string; end: string };
  /** Debt items that can be paid now (6b-2). */
  payable: Awaited<ReturnType<typeof payableDebtItems>>;
}) {
  const progress = debtProgress(debt, debt.paid, today, period, debt.extraPaid);
  const next = progress.payments.find((p) => !isSettled(p.status));
  // The plan item that pays the next payment, if its period has started.
  const toPay = debtItemToPay(debt.id, next?.due ?? null, schedule, payable);
  const tick = toPay && { id: toPay.id, name: toPay.name, planned_amount: toPay.planned_amount, paid: false, pot: false, varies: false };
  const count = progress.payments.length;
  const detail = [
    debt.payment_type === "one_time" ? "One payment" : debt.payment_type === "flexible" ? "When I can" : `${count} payments`,
    debt.interest_rate != null ? `${debt.interest_rate}% interest` : null,
    debt.lender,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <article aria-labelledby={`debt-${debt.id}`} className="flex flex-col gap-3 rounded-2xl border-[1.5px] border-line bg-surface p-4">
      <header className="flex items-start gap-3">
        <CategoryIconTile icon="credit-card" color="red" size="md" />
        <div className="flex min-w-0 flex-1 flex-col">
          <h3 id={`debt-${debt.id}`} className="truncate font-extrabold text-ink">
            {debt.name}
          </h3>
          <p className="truncate text-[13px] text-text-3">{detail}</p>
        </div>
        <p className="shrink-0 text-right">
          <span className="block font-display text-xl font-semibold text-ink">{formatPeso(progress.left)} left</span>
          <span className="block text-xs text-text-3">of {formatPeso(debt.total_amount)}</span>
        </p>
      </header>

      {next && (
        <div
          className={cn(
            "flex items-center justify-between gap-2 rounded-[12px] px-3 py-1.5 text-sm font-bold",
            next.status === "late" ? "bg-bad-bg text-bad-fg" : "bg-bg text-ink",
          )}
        >
          <p className="py-1">
            {next.status === "late"
              ? `Late: ${formatPeso(next.amount)} was due ${formatShortDate(next.due)}`
              : `Next: ${formatPeso(next.amount)} due ${formatShortDate(next.due)}`}
          </p>
          {/* Mobile: "Mark paid"; desktop: "Mark Nov 25 paid" (debts.md §2–3). */}
          {tick && (
            <>
              <MarkPaidPill item={tick} className="md:hidden" />
              <MarkPaidPill item={tick} label={`Mark ${formatShortDate(next.due)} paid`} className="hidden md:flex" />
            </>
          )}
        </div>
      )}

      {/* "When I can" (Nov 24): no schedule, just how much is paid and the target. */}
      {debt.payment_type === "flexible" && (
        <div className="flex flex-col gap-1.5">
          <span aria-hidden className="block h-2 overflow-hidden rounded-full bg-track">
            <span
              className="block h-full rounded-full bg-green-600"
              style={{ width: `${(potProgress(Math.min(debt.paid, debt.total_amount), debt.total_amount) ?? 0) * 100}%` }}
            />
          </span>
          <p className="flex justify-between gap-2 text-[13px] text-text-2">
            <span>{formatPeso(progress.paid)} paid so far</span>
            <span>{debt.target_date ? `Aiming for ${formatMonthYear(debt.target_date)}` : "Pay whenever you have extra"}</span>
          </p>
        </div>
      )}

      {progress.payments.length > 0 && (
        <ol className="flex flex-col divide-y divide-line-soft">
          {progress.payments.map((p) => {
            const payday = formatShortDate(paydayFor(p.due, schedule));
            const settled = isSettled(p.status);
            // Cleared by extras (7e): no payday paid it. Partly lowered: say by how much.
            const when =
              p.status === "cleared"
                ? "cleared early by extra payments"
                : `${p.status === "paid" ? "paid from" : "planned in"} ${payday} payday${p.cleared > 0 ? ` · ${formatPeso(p.cleared)} cleared early` : ""}`;
            return (
              <li key={p.number} className="flex items-center gap-3 py-2.5">
                <span
                  aria-hidden
                  className={cn(
                    "flex size-6 shrink-0 items-center justify-center rounded-full",
                    settled ? "bg-green-600 text-white" : "border-2 border-line",
                  )}
                >
                  {settled && <Check size={14} strokeWidth={3} />}
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="text-sm font-extrabold text-ink">
                    Payment {p.number} of {count}
                  </span>
                  <span className="text-[13px] text-text-3">
                    {formatShortDate(p.due)} · {when}
                  </span>
                </span>
                <span className="flex shrink-0 flex-col items-end gap-1">
                  {/* A cleared payment shows what it was, muted: ₱0 told nothing. */}
                  <span className={cn("text-sm font-extrabold", p.status === "cleared" ? "text-text-3" : "text-ink")}>
                    {formatPeso(p.status === "cleared" ? p.original : p.amount)}
                  </span>
                  <span className={cn("rounded-full px-2 py-0.5 text-xs font-bold", STATUS_TONE[p.status])}>
                    {paymentStatusText(p, today)}
                  </span>
                </span>
              </li>
            );
          })}
        </ol>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link
          href={`/debts?edit=${debt.id}`}
          scroll={false}
          className="flex h-11 items-center gap-2 rounded-md px-2 text-sm font-extrabold text-link outline-link hover:text-link-hover focus-visible:outline-2"
        >
          <Pencil aria-hidden size={16} />
          Edit<span className="sr-only"> {debt.name}</span>
        </Link>
        {/* Pay extra (debts.md §5, 6d-2): the add sheet's To a debt, this debt picked. */}
        <OpenAddSheetButton
          options={{ tab: "savings", direction: "debt", debtId: debt.id }}
          className="flex min-h-11 items-center rounded-full border-[1.5px] border-line bg-surface px-4 text-sm font-extrabold text-ink outline-link focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          Pay extra<span className="sr-only"> on {debt.name}</span>
        </OpenAddSheetButton>
      </div>
    </article>
  );
}

// A credit card (8b-2): what's owed on it, its next payment and the payday
// that pays it, and what was bought with it this period. No schedule and no
// "left of": a card you keep using has no end. Once its payday has started,
// Mark paid pays the Plan's payment and asks how much (8b-4).
function CreditCard({
  card,
  schedule,
  today,
  payable,
}: {
  card: Card;
  schedule: PaySchedule;
  today: string;
  payable: Awaited<ReturnType<typeof payableDebtItems>>;
}) {
  const next = cardNextPayment(card, today, schedule);
  // The card's unpaid Plan payment in a payday that has started (oldest first: a late one).
  const toPay = payable.filter((i) => i.debt_id === card.id).sort((a, b) => a.period_start.localeCompare(b.period_start))[0];
  const tick = toPay && { id: toPay.id, name: toPay.name, planned_amount: toPay.planned_amount, paid: false, pot: false, varies: true };
  // The due date that payment is for; before today when it's late.
  const tickDue = toPay ? cardDueInPeriod(card, getPeriod(toPay.period_start, schedule), schedule) : null;
  const late = tickDue != null && tickDue < today;
  const detail = ["Credit card", card.interest_rate != null ? `${card.interest_rate}% interest` : null, card.lender]
    .filter(Boolean)
    .join(" · ");
  return (
    <article aria-labelledby={`debt-${card.id}`} className="flex flex-col gap-3 rounded-2xl border-[1.5px] border-line bg-surface p-4">
      <header className="flex items-start gap-3">
        <CategoryIconTile icon="credit-card" color="red" size="md" />
        <div className="flex min-w-0 flex-1 flex-col">
          <h3 id={`debt-${card.id}`} className="truncate font-extrabold text-ink">
            {card.name}
          </h3>
          <p className="truncate text-[13px] text-text-3">{detail}</p>
        </div>
        <p className="shrink-0 text-right font-display text-xl font-semibold text-ink">{cardOwedText(card.balance)}</p>
      </header>

      <div
        className={cn(
          "flex items-center justify-between gap-2 rounded-[12px] px-3 py-1.5 text-sm font-bold",
          late ? "bg-bad-bg text-bad-fg" : "bg-bg text-ink",
        )}
      >
        <p className="py-1">
          {tick && tickDue
            ? late
              ? `Late: ${formatPeso(tick.planned_amount)} was due ${formatShortDate(tickDue)}`
              : `Next: ${formatPeso(tick.planned_amount)} due ${formatShortDate(tickDue)}`
            : `Next payment due ${formatShortDate(next.due)} · from the ${formatShortDate(next.payday)} payday`}
        </p>
        {tick && <MarkPaidPill item={tick} />}
      </div>
      <p className="text-[13px] text-text-2">
        {card.chargedNow > 0 ? `${formatPeso(card.chargedNow)} charged this period` : "Nothing charged this period"}
      </p>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link
          href={`/debts?edit=${card.id}`}
          scroll={false}
          className="flex h-11 items-center gap-2 rounded-md px-2 text-sm font-extrabold text-link outline-link hover:text-link-hover focus-visible:outline-2"
        >
          <Pencil aria-hidden size={16} />
          Edit<span className="sr-only"> {card.name}</span>
        </Link>
        {/* Pay it now: the add sheet's To a debt, this card picked. */}
        {card.balance > 0 && (
          <OpenAddSheetButton
            options={{ tab: "savings", direction: "debt", debtId: card.id }}
            className="flex min-h-11 items-center rounded-full border-[1.5px] border-line bg-surface px-4 text-sm font-extrabold text-ink outline-link focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            Pay<span className="sr-only"> {card.name}</span>
          </OpenAddSheetButton>
        )}
      </div>
    </article>
  );
}

type FinishedRow = { id: string; name: string; amount: number; date: string | null; closed: boolean };

// PAID OFF (debts.md §2): compact rows with a "Paid off" tag (a closed card:
// "Closed", 8b-2); three shown, the rest behind "Show more".
function PaidOff({ rows }: { rows: FinishedRow[] }) {
  const row = (debt: FinishedRow) => (
    <li key={debt.id}>
      <Link
        href={`/debts?edit=${debt.id}`}
        scroll={false}
        className="flex items-center gap-3 px-4 py-3 outline-link hover:bg-bg focus-visible:outline-2 focus-visible:-outline-offset-2"
      >
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate font-extrabold text-ink">{debt.name}</span>
          <span className="text-[13px] text-text-3">
            {debt.closed ? `Credit card · ${formatPeso(debt.amount)} owed` : formatPeso(debt.amount)}
            {debt.date && ` · ${debt.closed ? "closed" : "paid off"} ${formatShortDate(debt.date.slice(0, 10))}`}
          </span>
        </span>
        <span className="rounded-full bg-mint px-2 py-0.5 text-xs font-bold text-link-hover">{debt.closed ? "Closed" : "Paid off"}</span>
      </Link>
    </li>
  );
  const LIST = "flex flex-col divide-y divide-line-soft rounded-2xl border-[1.5px] border-line bg-surface";
  return (
    <section aria-labelledby="paid-off-title" className="flex flex-col gap-3">
      <h2 id="paid-off-title" className="text-xs font-extrabold tracking-wide text-text-3 uppercase">
        Paid off
      </h2>
      <ul className={LIST}>{rows.slice(0, PAID_OFF_ROWS).map(row)}</ul>
      {rows.length > PAID_OFF_ROWS && (
        <details className="flex flex-col gap-2">
          <summary className="flex h-11 cursor-pointer items-center text-sm font-extrabold text-link outline-link focus-visible:outline-2">
            Show {rows.length - PAID_OFF_ROWS} more
          </summary>
          <ul className={LIST}>{rows.slice(PAID_OFF_ROWS).map(row)}</ul>
        </details>
      )}
    </section>
  );
}

function EmptyState() {
  return (
    <section className="flex flex-col items-center gap-3 rounded-2xl border-[1.5px] border-line bg-surface p-8 text-center">
      <h2 className="font-display text-xl font-semibold text-ink">No debts here</h2>
      <p className="max-w-sm text-sm text-text-2">
        Add a loan, credit card, BNPL like SPayLater, or money you owe someone. We&apos;ll spread the payments across your
        paydays.
      </p>
      <Link
        href={ADD_HREF}
        scroll={false}
        className="flex h-12 items-center gap-2 rounded-md bg-primary px-5 font-extrabold text-primary-foreground outline-link focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        <Plus aria-hidden size={20} strokeWidth={2.5} />
        Add debt
      </Link>
    </section>
  );
}

// The same layout as the real page, in grey.
function DebtsSkeleton() {
  return (
    <SkeletonRegion className="flex flex-col gap-4 md:gap-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-col gap-1.5">
          <Skeleton className="hidden h-4 w-48 md:block" />
          <Skeleton className="h-8 w-28" />
        </div>
        <Skeleton className="size-11 rounded-[14px] md:h-12 md:w-36" />
      </div>
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        <Skeleton className="h-[136px] rounded-xl md:col-span-2 lg:col-span-1" />
        <Skeleton className="hidden h-[136px] rounded-xl md:block" />
        <Skeleton className="hidden h-[136px] rounded-xl md:block" />
        <Skeleton className="hidden h-[136px] rounded-xl md:block" />
      </div>
      <Skeleton className="h-72 rounded-2xl lg:w-1/2" />
    </SkeletonRegion>
  );
}
