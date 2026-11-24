import { Check, Pencil, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { HeaderStickerLink, PageHeader } from "@/components/shell/page-header";
import { PageShell } from "@/components/shell/page-shell";
import { Skeleton, SkeletonRegion } from "@/components/skeleton";
import { CategoryIconTile } from "@/components/transactions/category-grid";
import {
  type DebtTerms,
  debtPaid,
  debtProgress,
  debtsSummary,
  isPaidOff,
  type PaymentStatus,
  paydayFor,
  paymentStatusText,
} from "@/lib/debts";
import { formatPeso } from "@/lib/money";
import { formatShortDate, getPeriod, type PaySchedule, scheduleFromBudget, todayInManila } from "@/lib/periods";
import { potProgress } from "@/lib/pots";
import { requireAppUser } from "@/lib/require-app-user";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Debts · Chiwawallet" };

const ADD_HREF = "/debts?add=1";
/** PAID OFF shows three rows, then "Show more" (debts.md §2). */
const PAID_OFF_ROWS = 3;

// The Debts screen (debts.md, week-4-tasks.md 4f-1): total owed and when
// you're debt-free, then each active debt with its next payment and full
// schedule, then the paid-off ones. Plain and encouraging: no jokes here.
// Each card holds its schedule on every screen size (fix #4), so there's no
// separate details page. New and Edit debt open in a sheet (`?add=1`,
// `?edit=…`; 4f-2). Mark paid and Pay extra come with plan items (Week 5).
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

type Debt = DebtTerms & {
  id: string;
  name: string;
  lender: string | null;
  interest_rate: number | null;
  paid_off_at: string | null;
  paid: number;
};

async function DebtsContent() {
  const { budget } = await requireAppUser();
  const supabase = await createClient();
  const [debtRows, paymentRows] = await Promise.all([
    supabase
      .from("debts")
      .select(
        "id, name, lender, total_amount, payment_type, num_payments, payment_amount, first_due_date, interest_rate, paid_off_at",
      )
      .order("first_due_date"),
    // Every live payment, for what's been paid ("left" is never stored).
    supabase
      .from("transactions")
      .select("debt_id, amount, deleted_at")
      .eq("type", "debt_payment")
      .not("debt_id", "is", null)
      .is("deleted_at", null),
  ]);
  for (const result of [debtRows, paymentRows]) {
    if (result.error) throw new Error(`Couldn't load debts: ${result.error.message}`, { cause: result.error });
  }
  const debts: Debt[] = debtRows.data!.map((d) => ({
    ...d,
    // The check constraint allows only these two.
    payment_type: d.payment_type as DebtTerms["payment_type"],
    paid: debtPaid(paymentRows.data!.filter((p) => p.debt_id === d.id)),
  }));

  const schedule = scheduleFromBudget(budget);
  const today = todayInManila(new Date());
  const period = getPeriod(today, schedule);
  const summary = debtsSummary(debts, today, period);
  const active = debts.filter((d) => !isPaidOff(d));
  const paidOff = debts.filter((d) => isPaidOff(d));

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

      {debts.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          <section aria-label="Debt totals" className="grid gap-3 md:grid-cols-2 md:gap-4 lg:grid-cols-4">
            {/* The page's one hero: Deep Green, white text, sticker border. */}
            <div className="flex flex-col gap-2 rounded-xl border-2 border-sticker bg-green-700 p-5 text-white shadow-sticker md:col-span-2 lg:col-span-1">
              <p className="text-sm font-bold opacity-90">Total owed</p>
              <p className="font-display text-[34px] leading-none font-semibold">{formatPeso(summary.totalOwed)}</p>
              {summary.debtFreeBy && (
                <p className="text-sm opacity-90">Debt-free by {formatShortDate(summary.debtFreeBy)} if you keep the plan</p>
              )}
              {summary.activeTotal > 0 && (
                <>
                  <span aria-hidden className="block h-2 overflow-hidden rounded-full bg-white/25">
                    <span
                      className="block h-full rounded-full bg-white"
                      style={{ width: `${(potProgress(summary.activePaid, summary.activeTotal) ?? 0) * 100}%` }}
                    />
                  </span>
                  <p className="text-sm opacity-90">
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

          {active.length > 0 && (
            <section aria-labelledby="active-title" className="flex flex-col gap-3">
              <h2 id="active-title" className="text-xs font-extrabold tracking-wide text-text-3 uppercase">
                Active · {active.length === 1 ? "1 debt" : `${active.length} debts`}
              </h2>
              <ul className="grid gap-3 lg:grid-cols-2 lg:items-start">
                {active.map((debt) => (
                  <li key={debt.id}>
                    <DebtCard debt={debt} schedule={schedule} today={today} period={period} />
                  </li>
                ))}
              </ul>
              <p className="text-[13px] text-text-3">
                Planned payments count as Needs. Extra payments count toward <strong>Savings &amp; debt payoff</strong>{" "}
                in your 50/30/20 split.
              </p>
            </section>
          )}

          {paidOff.length > 0 && <PaidOff debts={paidOff} />}
        </>
      )}
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
}: {
  debt: Debt;
  schedule: PaySchedule;
  today: string;
  period: { start: string; end: string };
}) {
  const progress = debtProgress(debt, debt.paid, today, period);
  const next = progress.payments.find((p) => p.status !== "paid");
  const count = progress.payments.length;
  const detail = [
    debt.payment_type === "one_time" ? "One payment" : `${count} payments`,
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
        <p
          className={cn(
            "rounded-[12px] px-3 py-2 text-sm font-bold",
            next.status === "late" ? "bg-bad-bg text-bad-fg" : "bg-bg text-ink",
          )}
        >
          {next.status === "late"
            ? `Late: ${formatPeso(next.amount)} was due ${formatShortDate(next.due)}`
            : `Next: ${formatPeso(next.amount)} due ${formatShortDate(next.due)}`}
        </p>
      )}

      <ol className="flex flex-col divide-y divide-line-soft">
        {progress.payments.map((p) => {
          const payday = formatShortDate(paydayFor(p.due, schedule));
          return (
            <li key={p.number} className="flex items-center gap-3 py-2.5">
              <span
                aria-hidden
                className={cn(
                  "flex size-6 shrink-0 items-center justify-center rounded-full",
                  p.status === "paid" ? "bg-green-600 text-white" : "border-2 border-line",
                )}
              >
                {p.status === "paid" && <Check size={14} strokeWidth={3} />}
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="text-sm font-extrabold text-ink">
                  Payment {p.number} of {count}
                </span>
                <span className="truncate text-[13px] text-text-3">
                  {formatShortDate(p.due)} · {p.status === "paid" ? "paid from" : "planned in"} {payday} payday
                </span>
              </span>
              <span className="flex shrink-0 flex-col items-end gap-1">
                <span className="text-sm font-extrabold text-ink">{formatPeso(p.amount)}</span>
                <span className={cn("rounded-full px-2 py-0.5 text-xs font-bold", STATUS_TONE[p.status])}>
                  {paymentStatusText(p, today)}
                </span>
              </span>
            </li>
          );
        })}
      </ol>

      <Link
        href={`/debts?edit=${debt.id}`}
        scroll={false}
        className="flex h-11 items-center gap-2 self-start rounded-md px-2 text-sm font-extrabold text-link outline-link hover:text-link-hover focus-visible:outline-2"
      >
        <Pencil aria-hidden size={16} />
        Edit<span className="sr-only"> {debt.name}</span>
      </Link>
    </article>
  );
}

// PAID OFF (debts.md §2): compact rows with a "Paid off" tag; three shown,
// the rest behind "Show more".
function PaidOff({ debts }: { debts: Debt[] }) {
  const row = (debt: Debt) => (
    <li key={debt.id}>
      <Link
        href={`/debts?edit=${debt.id}`}
        scroll={false}
        className="flex items-center gap-3 px-4 py-3 outline-link hover:bg-bg focus-visible:outline-2 focus-visible:-outline-offset-2"
      >
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate font-extrabold text-ink">{debt.name}</span>
          <span className="text-[13px] text-text-3">
            {formatPeso(debt.total_amount)}
            {debt.paid_off_at && ` · paid off ${formatShortDate(debt.paid_off_at.slice(0, 10))}`}
          </span>
        </span>
        <span className="rounded-full bg-mint px-2 py-0.5 text-xs font-bold text-link-hover">Paid off</span>
      </Link>
    </li>
  );
  const LIST = "flex flex-col divide-y divide-line-soft rounded-2xl border-[1.5px] border-line bg-surface";
  return (
    <section aria-labelledby="paid-off-title" className="flex flex-col gap-3">
      <h2 id="paid-off-title" className="text-xs font-extrabold tracking-wide text-text-3 uppercase">
        Paid off
      </h2>
      <ul className={LIST}>{debts.slice(0, PAID_OFF_ROWS).map(row)}</ul>
      {debts.length > PAID_OFF_ROWS && (
        <details className="flex flex-col gap-2">
          <summary className="flex h-11 cursor-pointer items-center text-sm font-extrabold text-link outline-link focus-visible:outline-2">
            Show {debts.length - PAID_OFF_ROWS} more
          </summary>
          <ul className={LIST}>{debts.slice(PAID_OFF_ROWS).map(row)}</ul>
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
