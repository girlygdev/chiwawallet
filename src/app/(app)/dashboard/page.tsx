import type { Metadata } from "next";
import { Suspense } from "react";
import { CashCard } from "@/components/dashboard/cash-card";
import { IncomeCard } from "@/components/dashboard/income-card";
import { RecentActivity } from "@/components/dashboard/recent-activity";
import { PageHeader } from "@/components/shell/page-header";
import { PageShell } from "@/components/shell/page-shell";
import { Skeleton, SkeletonRegion } from "@/components/skeleton";
import type { ActivityRow } from "@/lib/activity";
import { getOrCreatePeriod } from "@/lib/budget-periods";
import { duePay, expectedForPeriod, isActiveOn, receivedSourceIds } from "@/lib/income";
import { dashboardNumbers } from "@/lib/money";
import {
  formatPeriodRange,
  type PaySlot,
  type Period,
  paydayLabel,
  periodStatusLine,
  scheduleFromBudget,
  todayInManila,
} from "@/lib/periods";
import { requireAppUser } from "@/lib/require-app-user";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Dashboard · Chiwawallet" };

/** Recent activity shows the last four (dashboard.md §2.7). */
const RECENT_ROWS = 4;

// The Dashboard (dashboard.md, week-3-tasks.md 3f): this period's dates, Cash
// now with the spend bar and the pay prompt, income expected vs received, and
// Recent activity. Its money in and money out match Activity's totals.
// Due this period, Spending, Savings pots, 50/30/20 and Safe to spend need
// plan items, pots and debts (Weeks 4-5).
export default function DashboardPage() {
  return (
    <PageShell>
      <PageHeader title="Your payday at a glance" mobile="greeting" />
      {/* Cache Components: the login check reads cookies, so it sits in <Suspense>. */}
      <Suspense fallback={<DashboardSkeleton />}>
        <DashboardBody />
      </Suspense>
    </PageShell>
  );
}

async function DashboardBody() {
  const { budget } = await requireAppUser();
  const supabase = await createClient();
  const schedule = scheduleFromBudget(budget);
  const today = todayInManila(new Date());

  // Creates this period's row the first time it's opened (task 2c).
  const row = await getOrCreatePeriod(supabase, budget, today);
  const period: Period = { start: row.start_date, end: row.end_date, paySlot: row.pay_slot as PaySlot };

  const [sources, periodRows, earlierRows, recent] = await Promise.all([
    supabase
      .from("income_sources")
      .select("id, name, amount, pay_slot, start_date, end_date")
      .eq("budget_id", budget.id)
      .order("created_at", { ascending: true }),
    supabase
      .from("transactions")
      .select("type, amount, deleted_at, income_source_id")
      .eq("period_id", row.id)
      .is("deleted_at", null),
    // Every earlier transaction, for carry-in (type and amount only).
    supabase.from("transactions").select("type, amount, deleted_at").lt("date", period.start).is("deleted_at", null),
    supabase
      .from("transactions")
      .select(
        "id, type, amount, date, note, created_at, deleted_at, category:categories(id, name, icon, color), source:income_sources(name)",
      )
      .is("deleted_at", null)
      .order("date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(RECENT_ROWS),
  ]);
  for (const result of [sources, periodRows, earlierRows, recent]) {
    if (result.error) throw new Error(`Couldn't load the dashboard: ${result.error.message}`, { cause: result.error });
  }

  // The generated types say `string` for type; its check constraint allows
  // only the four transaction types.
  type Rows = Parameters<typeof dashboardNumbers>[1];
  const numbers = dashboardNumbers(budget.opening_balance, earlierRows.data as Rows, periodRows.data as Rows);

  // Income expected vs received, and the pay prompt.
  const received = receivedSourceIds(
    periodRows.data!,
    { start: period.start, paySlot: period.paySlot, first_pay_received: row.first_pay_received },
    sources.data!,
    schedule,
  );
  const landing = sources.data!.filter(
    (s) =>
      isActiveOn(s, period.start) &&
      (schedule.frequency !== "semi_monthly" || s.pay_slot === "every" || s.pay_slot === period.paySlot),
  );
  const due = duePay(sources.data!, received, schedule, today);

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      {/* The period switcher's text (app-shell.md §4). Its arrows come with
          Plan (Week 5), when moving to another period opens that period's plan. */}
      <section aria-label="This period" className="flex flex-col">
        <p className="font-display text-2xl leading-tight font-semibold text-ink">
          {formatPeriodRange(period.start, period.end)}
        </p>
        <p className="text-[13px] font-bold text-text-3">{periodStatusLine(period, schedule, today)}</p>
      </section>

      <div className="flex flex-col gap-4 md:gap-6 lg:grid lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start">
        <div className="flex flex-col gap-4 md:gap-6">
          <CashCard
            numbers={numbers}
            due={due && { id: due.id, name: due.name, amount: due.amount, payday: period.start }}
            today={today}
          />
          <IncomeCard
            received={numbers.income}
            expected={expectedForPeriod(sources.data!, schedule, period)}
            sources={landing.map((s) => ({ id: s.id, name: s.name, amount: s.amount, received: received.has(s.id) }))}
            paydayLabel={paydayLabel(schedule, period.paySlot)}
            firstPayCounted={row.first_pay_received}
          />
        </div>
        {/* Each row has exactly one category; see the Activity page. */}
        <RecentActivity rows={recent.data as unknown as ActivityRow[]} today={today} />
      </div>
    </div>
  );
}

// Skeleton blocks the size of the real content (app-shell.md §5 "Loading").
function DashboardSkeleton() {
  return (
    <SkeletonRegion className="flex flex-col gap-4 md:gap-6">
      <div className="flex flex-col gap-1.5">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-4 w-48" />
      </div>
      <div className="flex flex-col gap-4 md:gap-6 lg:grid lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="flex flex-col gap-4 md:gap-6">
          <Skeleton className="h-[260px] rounded-xl" />
          <Skeleton className="h-[140px] rounded-xl" />
        </div>
        <Skeleton className="h-[300px] rounded-2xl" />
      </div>
    </SkeletonRegion>
  );
}
