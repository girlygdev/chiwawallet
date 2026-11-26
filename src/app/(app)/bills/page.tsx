import { Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { HeaderStickerLink, PageHeader } from "@/components/shell/page-header";
import { PageShell } from "@/components/shell/page-shell";
import { Skeleton, SkeletonRegion } from "@/components/skeleton";
import { CategoryIconTile } from "@/components/transactions/category-grid";
import {
  type BillFrequency,
  billScheduleLine,
  billsPerMonth,
  billsPerPayday,
  billStatus,
  heavyPayday,
  paydayShares,
  splitHalves,
} from "@/lib/bills";
import { formatPeso } from "@/lib/money";
import { stillDue, upcomingCounts } from "@/lib/plan";
import { openCurrentPlan, upcomingItems } from "@/lib/plan-periods";
import { formatShortDate, getPeriod, type PaySchedule, paydayLabel, scheduleFromBudget, todayInManila } from "@/lib/periods";
import { requireAppUser } from "@/lib/require-app-user";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { BillSheet } from "./bill-sheet";

export const metadata: Metadata = { title: "Bills · Chiwawallet" };

const ADD_HREF = "/bills?add=1";

// The Bills screen (bills.md, week-4-tasks.md 4c): what bills cost each
// month, how they spread across paydays, and each bill with when it's due.
// New and Edit bill open in a sheet (`?add=1`, `?edit=…`, `?delete=…`; 4c-2), like Income.
// "Still due this period" comes from the current period's unpaid bill items
// (5h-3), so the page opens that period like the Plan does. Paid this
// period and Mark paid come with ticking items (Week 6).
export default function BillsPage() {
  return (
    <PageShell>
      {/* Cache Components: the header shows totals from the database (cookies). */}
      <Suspense fallback={<BillsSkeleton />}>
        <BillsContent />
      </Suspense>
    </PageShell>
  );
}

type Bill = {
  id: string;
  name: string;
  amount: number;
  amount_varies: boolean;
  frequency: BillFrequency;
  due_day: number;
  first_due_month: number | null;
  pay_slot: string;
  category_id: string;
  remind: boolean;
  category: { name: string; icon: string; color: string };
};

async function BillsContent() {
  const { budget } = await requireAppUser();
  const supabase = await createClient();
  const [billRows, categoryRows] = await Promise.all([
    supabase
      .from("recurring_bills")
      .select(
        "id, name, amount, amount_varies, frequency, due_day, first_due_month, pay_slot, category_id, remind, category:categories(name, icon, color)",
      )
      .eq("budget_id", budget.id)
      .order("name"),
    // The form's category choices: spending categories that aren't system ones.
    supabase.from("categories").select("id, name").eq("kind", "expense").is("system_key", null).order("name"),
  ]);
  for (const result of [billRows, categoryRows]) {
    if (result.error) throw new Error(`Couldn't load bills: ${result.error.message}`, { cause: result.error });
  }
  // The check constraints allow only these frequencies; each bill has one category.
  const bills = billRows.data as unknown as Bill[];
  const categories = categoryRows.data!;
  // New bills use the Bills category by default (bills.md §4).
  const defaultCategoryId = (categories.find((c) => c.name === "Bills") ?? categories[0])?.id ?? "";

  const schedule = scheduleFromBudget(budget);
  const today = todayInManila(new Date());
  const period = getPeriod(today, schedule);
  const perMonth = billsPerMonth(bills);
  const recurring = bills.length === 1 ? "1 recurring bill" : `${bills.length} recurring bills`;

  // This period's unpaid bill items, and each bill's items still to come (Delete bill).
  const [current, upcoming] = await Promise.all([
    openCurrentPlan(supabase, budget, today),
    upcomingItems(supabase, budget, today),
  ]);
  const due = stillDue(
    current.items.filter((i) => i.bill_id != null),
    bills,
    current.period,
    schedule,
  );
  const upcomingByBill = upcomingCounts(upcoming.map((i) => i.bill_id));

  return (
    <>
      <PageHeader
        title="Bills"
        eyebrow={bills.length > 0 ? `${formatPeso(perMonth)} a month · ${bills.length} recurring` : "Bills that repeat"}
        mobile={{ backHref: "/more", backLabel: "Back to More" }}
        mobileAction={
          <Link
            href={ADD_HREF}
            scroll={false}
            aria-label="Add bill"
            className="flex size-11 items-center justify-center rounded-[14px] border-2 border-sticker bg-green-500 text-white shadow-sticker-sm outline-link focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            <Plus aria-hidden size={22} strokeWidth={2.5} />
          </Link>
        }
        desktopAction={<HeaderStickerLink href={ADD_HREF}>Add bill</HeaderStickerLink>}
      />

      {bills.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          <div className="flex flex-col gap-4 md:flex-row md:items-stretch">
            {/* The page's one hero: Deep Green, white text, sticker border. */}
            <section
              aria-label="Bills each month"
              className="flex flex-col gap-1 rounded-xl border-2 border-sticker bg-green-700 p-5 text-white shadow-sticker md:w-full md:max-w-md"
            >
              <p className="text-sm font-bold opacity-90">Bills each month</p>
              <p className="font-display text-[34px] leading-none font-semibold">{formatPeso(perMonth)}</p>
              <p className="text-sm opacity-90">
                {recurring} · {formatPeso(due.total)} still due this period
              </p>
            </section>
            {/* Desktop's stat card (bills.md §3). Paid this period comes with Mark paid (Week 6). */}
            <section
              aria-label="Still due this period"
              className="hidden flex-col gap-1 rounded-xl border-[1.5px] border-line bg-surface p-5 md:flex md:min-w-56"
            >
              <p className="text-xs font-extrabold tracking-wide text-text-3 uppercase">Still due this period</p>
              <p className="font-display text-[28px] leading-none font-semibold text-ink">{formatPeso(due.total)}</p>
              <p className="text-sm text-text-3">
                {due.next ? `${due.next.name} · ${formatShortDate(due.next.date)}` : "Nothing due"}
              </p>
            </section>
          </div>

          <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
            <div className="flex flex-col gap-6">
              {schedule.frequency === "semi_monthly" ? (
                <>
                  <BillSection slot="payday_1" bills={bills} schedule={schedule} today={today} period={period} />
                  <BillSection slot="payday_2" bills={bills} schedule={schedule} today={today} period={period} />
                </>
              ) : (
                <BillSection slot="every" bills={bills} schedule={schedule} today={today} period={period} />
              )}
            </div>
            {/* Mobile: right under the hero. Desktop: the side column (bills.md §3). */}
            <div className="order-first lg:order-none">
              <PerPayday bills={bills} schedule={schedule} />
            </div>
          </div>
        </>
      )}

      <BillSheet
        bills={bills}
        upcoming={upcomingByBill}
        categories={categories}
        defaultCategoryId={defaultCategoryId}
        schedule={schedule}
        today={today}
      />
    </>
  );
}

// BILLS PER PAYDAY (bills.md §1–2): a bar per payday with its amount in
// text, plus the balance message. Hidden on one-payday budgets.
function PerPayday({ bills, schedule }: { bills: Bill[]; schedule: PaySchedule }) {
  const perPayday = billsPerPayday(bills, schedule);
  if (!perPayday) return null;
  const shares = paydayShares(perPayday);
  const heavy = heavyPayday(perPayday);
  const label = (slot: "payday_1" | "payday_2") => paydayLabel(schedule, slot);

  return (
    <section aria-labelledby="per-payday-title" className="flex flex-col gap-3 rounded-xl border-[1.5px] border-line bg-surface p-5">
      <h2 id="per-payday-title" className="text-xs font-extrabold tracking-wide text-text-3 uppercase">
        Bills per payday
      </h2>
      <ul className="flex flex-col gap-2.5">
        {(["payday_1", "payday_2"] as const).map((slot) => (
          <li key={slot} className="flex flex-col gap-1">
            <span className="flex justify-between text-sm">
              <span className="font-bold text-text-2">{label(slot)}</span>
              {/* The amount is text, so the bar isn't the only way to read it. */}
              <span className="font-extrabold text-ink">{formatPeso(perPayday[slot])}</span>
            </span>
            <span aria-hidden className="block h-2.5 overflow-hidden rounded-full bg-track">
              <span className="block h-full rounded-full bg-green-600" style={{ width: `${shares[slot] * 100}%` }} />
            </span>
          </li>
        ))}
      </ul>
      {heavy ? (
        <p className="rounded-[12px] bg-warn-bg px-3 py-2 text-sm font-bold text-warn-fg">
          The {label(heavy)} carries most of your bills. Move one, or split it across both.
        </p>
      ) : (
        <p className="text-sm text-text-2">Nicely balanced. Each payday covers about half.</p>
      )}
      <p className="hidden text-[13px] text-text-3 lg:block">
        Tip: when one payday carries most bills, move one to the other payday, or pick <strong>Split</strong> to pay half
        from each.
      </p>
    </section>
  );
}

// PAID FROM 15TH PAYDAY ₱2,700 (bills.md §2). Split bills appear in both
// sections at half the amount, with a Split tag.
function BillSection({
  slot,
  bills,
  schedule,
  today,
  period,
}: {
  slot: "payday_1" | "payday_2" | "every";
  bills: Bill[];
  schedule: PaySchedule;
  today: string;
  period: { start: string; end: string };
}) {
  const rows =
    slot === "every"
      ? bills.map((b) => ({ bill: b, amount: b.amount, split: false }))
      : bills
          .filter((b) => b.pay_slot === slot || b.pay_slot === "split")
          .map((b) => ({
            bill: b,
            amount: b.pay_slot === "split" ? splitHalves(b.amount)[slot] : b.amount,
            split: b.pay_slot === "split",
          }));
  const perPayday = billsPerPayday(bills, schedule);
  const total = slot === "every" ? billsPerMonth(bills) : perPayday![slot];
  const title = slot === "every" ? "Your bills" : `Paid from ${paydayLabel(schedule, slot)} payday`;
  const headingId = `bills-${slot}`;

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-2">
      <h2 id={headingId} className="flex justify-between text-xs font-extrabold tracking-wide text-text-3 uppercase">
        <span>{title}</span>
        {/* "a month" on one-payday budgets, where the total is per month. */}
        <span>
          {formatPeso(total)}
          {slot === "every" && " a month"}
        </span>
      </h2>
      {rows.length === 0 ? (
        <p className="rounded-2xl border-[1.5px] border-dashed border-line px-4 py-3 text-sm text-text-3">
          No bills on this payday.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-line-soft rounded-2xl border-[1.5px] border-line bg-surface">
          {rows.map(({ bill, amount, split }) => {
            const status = billStatus(bill, period);
            return (
              <li key={bill.id}>
                {/* The whole row is the Edit link (bills.md fix #1). */}
                <Link
                  href={`/bills?edit=${bill.id}`}
                  scroll={false}
                  className="flex items-center gap-3 rounded-[14px] px-3.5 py-3 outline-link hover:bg-bg focus-visible:outline-2 focus-visible:-outline-offset-2"
                >
                  <CategoryIconTile icon={bill.category.icon} color={bill.category.color} size="md" />
                  <span className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="truncate font-extrabold text-ink">{bill.name}</span>
                    <span className="truncate text-[13px] text-text-3">{billScheduleLine(bill, today)}</span>
                    <span className="flex flex-wrap gap-1.5">
                      {/* Status in words, not only colour (bills.md §6). */}
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-xs font-bold",
                          status.kind === "due" ? "bg-warn-bg text-warn-fg" : "bg-track text-text-2",
                        )}
                      >
                        {status.kind === "due" ? "Due" : "Next:"} {formatShortDate(status.date)}
                      </span>
                      {split && <span className="rounded-full bg-info-bg px-2 py-0.5 text-xs font-bold text-info-fg">Split</span>}
                    </span>
                  </span>
                  <span className="shrink-0 text-right font-display text-lg font-semibold text-ink">
                    {/* ≈ for amounts that change each month (bills.md §2). */}
                    {bill.amount_varies && (
                      <>
                        <span aria-hidden>≈</span>
                        <span className="sr-only">about </span>
                      </>
                    )}
                    {formatPeso(amount)}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function EmptyState() {
  return (
    <section className="flex flex-col items-center gap-3 rounded-2xl border-[1.5px] border-line bg-surface p-8 text-center">
      {/* eslint-disable-next-line @next/next/no-img-element -- static SVG, decorative */}
      <img src="/logo-mark.svg" alt="" width={72} height={72} />
      <h2 className="font-display text-xl font-semibold text-ink">No bills yet</h2>
      <p className="max-w-sm text-sm text-text-2">
        Add the bills that repeat, like electricity, internet, rent or subscriptions. Pick the payday that pays each one.
      </p>
      <Link
        href={ADD_HREF}
        scroll={false}
        className="flex h-12 items-center gap-2 rounded-md bg-primary px-5 font-extrabold text-primary-foreground outline-link focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        <Plus aria-hidden size={20} strokeWidth={2.5} />
        Add bill
      </Link>
    </section>
  );
}

// The same layout as the real page, in grey.
function BillsSkeleton() {
  return (
    <SkeletonRegion className="flex flex-col gap-4 md:gap-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-col gap-1.5">
          <Skeleton className="hidden h-4 w-40 md:block" />
          <Skeleton className="h-8 w-28" />
        </div>
        <Skeleton className="size-11 rounded-[14px] md:h-12 md:w-36" />
      </div>
      <Skeleton className="h-[108px] rounded-xl md:max-w-md" />
      <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-3.5 w-48" />
          <Skeleton className="h-56 rounded-2xl" />
        </div>
        <Skeleton className="order-first h-44 rounded-xl lg:order-none" />
      </div>
    </SkeletonRegion>
  );
}
