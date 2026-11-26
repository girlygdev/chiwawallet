import type { Metadata } from "next";
import { Suspense } from "react";
import { CashCard } from "@/components/dashboard/cash-card";
import { DueCard } from "@/components/dashboard/due-card";
import { IncomeCard } from "@/components/dashboard/income-card";
import { RecentActivity, type RecentRow } from "@/components/dashboard/recent-activity";
import { PageHeader } from "@/components/shell/page-header";
import { PageShell } from "@/components/shell/page-shell";
import { Skeleton, SkeletonRegion } from "@/components/skeleton";
import type { ActivityRow } from "@/lib/activity";
import { getOrCreatePeriod } from "@/lib/budget-periods";
import { duePay, expectedForPeriod, isActiveOn, receivedSourceIds } from "@/lib/income";
import { dashboardNumbers, perDay, safeToSpend, stillDueTotal } from "@/lib/money";
import { dueList } from "@/lib/plan";
import { closeEndedPeriodsOnVisit, openCurrentPlan } from "@/lib/plan-periods";
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
import { editImpact } from "@/lib/transactions";

export const metadata: Metadata = { title: "Dashboard · Chiwawallet" };

/** Recent activity shows the last four (dashboard.md §2.7). */
const RECENT_ROWS = 4;

// The Dashboard (dashboard.md, week-3-tasks.md 3f): this period's dates, Cash
// now with the spend bar and the pay prompt, income expected vs received, and
// Recent activity. Its money in and money out match Activity's totals.
// Safe to spend and Due this period come from the current period's plan
// items (6c). Spending, Savings pots and 50/30/20 come in Week 7.
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

  // Close any period that has ended (6h-1), then create this period's row
  // the first time it's opened (task 2c).
  await closeEndedPeriodsOnVisit(supabase, budget, today);
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
        "id, type, amount, date, note, created_at, deleted_at, period_id, category:categories(id, name, icon, color), source:income_sources(name)",
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

  // Safe to spend (dashboard.md §1): cash now − what's still due, from this
  // period's plan items, opened (created and synced) like the Plan does.
  const current = await openCurrentPlan(supabase, budget, today);
  const planned = current.items.filter((i) => i.tickable);
  const stillDue = stillDueTotal(planned);
  const safe = safeToSpend(numbers.cashNow, stillDue);

  // Recent rows open Edit transaction, whose Delete link shows the effect on
  // the row's own period. Rows from earlier periods need those periods' rows
  // and dates: one more round trip, only when there are any.
  const recentRows = recent.data as unknown as (ActivityRow & { period_id: string })[];
  const olderIds = [...new Set(recentRows.map((r) => r.period_id).filter((id) => id !== row.id))];
  const [olderRows, olderPeriods] =
    olderIds.length === 0
      ? [{ data: [], error: null }, { data: [], error: null }]
      : await Promise.all([
          supabase
            .from("transactions")
            .select("period_id, type, amount, deleted_at")
            .in("period_id", olderIds)
            .is("deleted_at", null),
          supabase.from("budget_periods").select("id, start_date, end_date").in("id", olderIds),
        ]);
  for (const result of [olderRows, olderPeriods]) {
    if (result.error) throw new Error(`Couldn't load the dashboard: ${result.error.message}`, { cause: result.error });
  }
  const rowsOf = (periodId: string) =>
    (periodId === row.id ? periodRows.data! : olderRows.data!.filter((r) => r.period_id === periodId)) as Rows;
  const labelOf = (periodId: string) => {
    const p = olderPeriods.data!.find((x) => x.id === periodId);
    return periodId === row.id || !p ? "this period" : formatPeriodRange(p.start_date, p.end_date);
  };
  const recentWithImpact: RecentRow[] = recentRows.map((r) => ({
    ...r,
    impact: editImpact(rowsOf(r.period_id), r, 0),
    periodLabel: labelOf(r.period_id),
  }));

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
            safe={safe}
            stillDue={stillDue}
            daily={perDay(safe, today, period.end)}
            due={due && { id: due.id, name: due.name, amount: due.amount, payday: period.start }}
            today={today}
          />
          <DueCard items={dueList(planned)} periodStart={period.start} />
          <IncomeCard
            received={numbers.income}
            expected={expectedForPeriod(sources.data!, schedule, period)}
            sources={landing.map((s) => ({ id: s.id, name: s.name, amount: s.amount, received: received.has(s.id) }))}
            paydayLabel={paydayLabel(schedule, period.paySlot)}
            firstPayCounted={row.first_pay_received}
          />
        </div>
        {/* Each row has exactly one category; see the Activity page. */}
        <RecentActivity rows={recentWithImpact} today={today} />
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
