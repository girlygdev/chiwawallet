import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { CashCard, EarlyPayPrompt, PayPrompt } from "@/components/dashboard/cash-card";
import { DueCard } from "@/components/dashboard/due-card";
import { GetStartedCard } from "@/components/dashboard/get-started-card";
import { NextPeriodCard } from "@/components/dashboard/next-period-card";
import { PeriodSwitcher } from "@/components/dashboard/period-switcher";
import { type PotCard, PotsCard } from "@/components/dashboard/pots-card";
import { type SpendingRow, SpendingCard } from "@/components/dashboard/spending-card";
import { SplitCard } from "@/components/dashboard/split-card";
import { StartEarlyPrompt } from "@/components/dashboard/start-early";
import { StatRow } from "@/components/dashboard/stat-row";
import { IncomeCard } from "@/components/dashboard/income-card";
import { RecentActivity, type RecentRow } from "@/components/dashboard/recent-activity";
import { InstallHint } from "@/components/dashboard/install-hint";
import { PageHeader } from "@/components/shell/page-header";
import { PageShell } from "@/components/shell/page-shell";
import { Skeleton, SkeletonRegion } from "@/components/skeleton";
import type { ActivityRow } from "@/lib/activity";
import { firstDayOf, getOrCreatePeriod, loadEarlyStarts, periodOf } from "@/lib/budget-periods";
import { checklistSteps, potStarted } from "@/lib/checklist";
import { loadEarlyPay, loadStartEarly } from "@/lib/early-pay";
import { isChecklistDismissed } from "@/lib/checklist-cookie";
import { duePay, expectedForPeriod, isActiveOn, receivedSourceIds } from "@/lib/income";
import { dashboardNumbers, perDay, periodMoneyLine, safeToSpend, spentSplit, stillDueTotal } from "@/lib/money";
import { dashboardNeighbors, dueList, nextPeriodLine, spendingTotal, stillDueBreakdown, topBudgets } from "@/lib/plan";
import { closeEndedPeriodsOnVisit, openCurrentPlan } from "@/lib/plan-periods";
import { potBalance, potCardLine, potPeriodLine } from "@/lib/pots";
import {
  formatPeriodRange,
  paydayLabel,
  periodDayLine,
  periodStatusLine,
  scheduleFromBudget,
  todayInManila,
} from "@/lib/periods";
import { requireAppUser } from "@/lib/require-app-user";
import { createClient } from "@/lib/supabase/server";
import { editImpact } from "@/lib/transactions";

export const metadata: Metadata = { title: "Dashboard · Chiwawallet" };

/** Recent activity: the last four on phones (dashboard.md §2.7), five in the desktop table (§3). */
const RECENT_ROWS = 5;

// The Dashboard (dashboard.md, week-3-tasks.md 3f): this period's dates, Cash
// now with the spend bar and the pay prompt, income expected vs received, and
// Recent activity. Its money in and money out match Activity's totals.
// Safe to spend and Due this period come from the current period's plan
// items (6c), then Spending and Savings pots (7a) and the 50/30/20 check
// (7b). Desktop (7c, §3): a stat row, then a main and a side column.
// First-day state (7d-1, §4): Get started, the empty cards, "Day 1 of 15".
// Period arrows to the Plan and Next period (7d-2).
export default function DashboardPage() {
  return (
    <PageShell>
      <PageHeader title="Your payday at a glance" mobile="greeting" />
      {/* iPhone and iPad only, until installed or hidden (Week 8). */}
      <InstallHint />
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
  const { awaiting } = await closeEndedPeriodsOnVisit(supabase, budget, today);
  // A period waiting for its leftover choice: the payday screen first (6h-2).
  if (awaiting) redirect(`/payday?start=${awaiting.start}`);
  const row = await getOrCreatePeriod(supabase, budget, today);
  // Its real first day too: earlier than its payday if it started early (Task D2).
  const period = periodOf(row);
  const early = await loadEarlyStarts(supabase, budget.id);

  const [sources, periodRows, earlierRows, recent] = await Promise.all([
    supabase
      .from("income_sources")
      .select("id, name, amount, pay_slot, start_date, end_date")
      .eq("budget_id", budget.id)
      .order("created_at", { ascending: true }),
    supabase
      .from("transactions")
      .select("type, amount, deleted_at, card_id, income_source_id, category_id")
      .eq("period_id", row.id)
      .is("deleted_at", null),
    // Every earlier transaction, for carry-in (type and amount only).
    supabase.from("transactions").select("type, amount, deleted_at, card_id").lt("date", firstDayOf(row)).is("deleted_at", null),
    supabase
      .from("transactions")
      .select(
        "id, type, amount, card_id, date, note, created_at, deleted_at, period_id, category:categories(id, name, icon, color), source:income_sources(name), card:debts!transactions_card_fkey(name)",
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
  const current = await openCurrentPlan(supabase, budget, today, { withNext: true });
  const planned = current.items.filter((i) => i.tickable);
  const stillDue = stillDueTotal(planned);
  const safe = safeToSpend(numbers.cashNow, stillDue);

  // Spending (7a): the three biggest category budgets, with the Plan's bars.
  // Savings pots (7a): each pot's balance and its bar.
  const [categoryRows, potRows, savingRows] = await Promise.all([
    supabase.from("categories").select("id, icon, color, budget_group"),
    supabase.from("savings_pots").select("id, name, starting_balance, target_amount, is_locked").order("created_at").order("name"),
    supabase.from("transactions").select("pot_id, period_id, amount, deleted_at").eq("type", "savings").not("pot_id", "is", null).is("deleted_at", null),
  ]);
  for (const result of [categoryRows, potRows, savingRows]) {
    if (result.error) throw new Error(`Couldn't load the dashboard: ${result.error.message}`, { cause: result.error });
  }
  const look = new Map(categoryRows.data!.map((c) => [c.id, c]));
  const spendingLines = current.items.filter((i) => i.section === "spending" && i.bar != null);
  const spending: SpendingRow[] = topBudgets(spendingLines).map((i) => ({
    id: i.id,
    name: i.name,
    icon: look.get(i.category_id!)?.icon ?? "shopping-basket",
    color: look.get(i.category_id!)?.color ?? "green",
    planned: i.planned_amount,
    spent: i.spent ?? 0,
    bar: i.bar!,
  }));
  // The 50/30/20 check (7b): what was spent so far by group.
  const split = spentSplit(
    periodRows.data as Parameters<typeof spentSplit>[0],
    Object.fromEntries(categoryRows.data!.map((c) => [c.id, c.budget_group])),
    budget,
  );
  const pots: PotCard[] = potRows.data!.map((p) => {
    const rows = savingRows.data!.filter((r) => r.pot_id === p.id);
    const balance = potBalance(p, rows);
    // Desktop's "+₱3,000 this period": the net moved this period (a balance
    // from ₱0), else what's still planned for the pot this period.
    const moved = potBalance({ starting_balance: 0 }, rows.filter((r) => r.period_id === row.id));
    const planned = stillDueTotal(current.items.filter((i) => i.pot_id === p.id));
    return {
      id: p.id,
      name: p.name,
      balance,
      target: p.target_amount,
      line: potCardLine(balance, p.target_amount, p.is_locked),
      period: potPeriodLine(moved, planned),
    };
  });

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
            .select("period_id, type, amount, deleted_at, card_id")
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
  const due = duePay(sources.data!, received, schedule, today, early);
  // Paid early? (Nov 28): only while this period's pay is logged, so the two prompts never stack.
  const earlyPay = due ? null : await loadEarlyPay(supabase, budget, today);
  // Start my next period now (Nov 28, D3): once pay for the next payday is logged early.
  const startEarly = await loadStartEarly(supabase, budget, today);

  // Get started (7d-1): until all five steps are done or it's dismissed. Its
  // counts are skipped once dismissed. The first period gets "Day 1 of 15".
  const dismissed = await isChecklistDismissed(budget.id);
  const has = (q: PromiseLike<{ count: number | null; error: { message: string } | null }>) =>
    Promise.resolve(q).then((r) => {
      if (r.error) throw new Error(`Couldn't load the dashboard: ${r.error.message}`);
      return (r.count ?? 0) > 0;
    });
  const one = { count: "exact", head: true } as const;
  const [checks, firstPeriod] = await Promise.all([
    dismissed
      ? null
      : Promise.all([
          has(supabase.from("transactions").select("id", one).eq("type", "income").is("deleted_at", null)),
          has(supabase.from("recurring_bills").select("id", one).eq("budget_id", budget.id)),
          has(supabase.from("transactions").select("id", one).eq("type", "expense").is("deleted_at", null)),
        ]),
    supabase.from("budget_periods").select("start_date").eq("budget_id", budget.id).order("start_date").limit(1).maybeSingle(),
  ]);
  if (firstPeriod.error) throw new Error(`Couldn't load the dashboard: ${firstPeriod.error.message}`, { cause: firstPeriod.error });
  const payFrom = landing[0] ?? sources.data![0] ?? null;
  const checklist =
    checks &&
    checklistSteps({
      schedule,
      firstIncome: payFrom && { name: payFrom.name, amount: payFrom.amount },
      hasIncome: checks[0],
      hasBills: checks[1],
      hasPots: potStarted(pots),
      hasExpense: checks[2],
    });
  const getStarted = checklist && !checklist.complete && (
    <GetStartedCard list={checklist} payOptions={payFrom && { incomeSource: payFrom.id, amount: payFrom.amount }} />
  );
  const isFirstPeriod = firstPeriod.data?.start_date === period.start;
  // Nothing logged and nothing planned yet: "Your starting balance."
  const fresh = periodRows.data!.length === 0 && planned.length === 0;
  // The period arrows and Next period (7d-2); both open periods on the Plan.
  const neighbors = dashboardNeighbors(today, schedule, firstPeriod.data?.start_date ?? null, early);
  const next = current.next;
  const nextLine = next ? nextPeriodLine(next.expected, next.names) : "";
  const duePrompt = due && { id: due.id, name: due.name, amount: due.amount, payday: period.start };
  const daily = perDay(safe, today, period.end);

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <PeriodSwitcher
        start={period.start}
        end={period.end}
        status={isFirstPeriod ? `Your first payday period · ${periodDayLine(period, today)}` : periodStatusLine(period, schedule, today)}
        prev={neighbors.prev}
        next={neighbors.next}
      />

      {/* Desktop (§3): the pay prompt as a banner, then the stat row; phones
          have both inside the Cash card. */}
      {duePrompt && <PayPrompt due={duePrompt} today={today} className="hidden rounded-2xl bg-green-700 lg:flex" />}
      {!duePrompt && earlyPay && <EarlyPayPrompt early={earlyPay} className="hidden rounded-2xl bg-green-700 lg:flex" />}
      {startEarly && <StartEarlyPrompt offer={startEarly} className="hidden rounded-2xl bg-green-700 lg:flex" />}
      {/* Get started: above the stat row on desktop, under the Cash card on
          phones. Two copies; the hidden one is out of the accessibility tree. */}
      {getStarted && <div className="hidden lg:block">{getStarted}</div>}
      <StatRow
        numbers={numbers}
        safe={safe}
        daily={daily}
        periodLine={periodMoneyLine(numbers)}
        stillDue={stillDue}
        dueLine={stillDueBreakdown(planned)}
      />

      {/* Phones: one column in this order. Desktop: a grid with the side
          column spanning every row; its last row is 1fr, so a tall side
          column adds space below Recent activity, not between the cards. */}
      <div className="flex flex-col gap-4 md:gap-6 lg:grid lg:grid-cols-[minmax(0,2fr)_minmax(300px,1fr)] lg:grid-rows-[auto_auto_1fr] lg:items-start">
        <div className="lg:hidden">
          <CashCard numbers={numbers} safe={safe} stillDue={stillDue} daily={daily} due={duePrompt} early={earlyPay} startEarly={startEarly} today={today} fresh={fresh} />
        </div>
        {getStarted && <div className="lg:hidden">{getStarted}</div>}
        <div className="lg:col-start-1 lg:row-start-1">
          <DueCard items={dueList(planned)} periodStart={period.start} today={today} />
        </div>
        {/* Hidden until there's something to show (dashboard.md §4). */}
        {spending.length > 0 && (
          <div className="lg:col-start-1 lg:row-start-2">
            <SpendingCard rows={spending} planHref={`/plan?start=${period.start}`} total={spendingTotal(spendingLines)} />
          </div>
        )}
        <div className="flex flex-col gap-4 md:gap-6 lg:col-start-2 lg:row-span-3 lg:row-start-1">
          {/* With no pots: the empty card on desktop only (§4). */}
          <PotsCard pots={pots} />
          {/* Hidden until money out reaches ₱1,000 (dashboard.md §5). */}
          {split.show && <SplitCard groups={split.groups} />}
          {/* Hidden until there's something in it (§4). */}
          {next && nextLine && <NextPeriodCard start={next.period.start} end={next.period.end} line={nextLine} />}
          <IncomeCard
            received={numbers.income}
            expected={expectedForPeriod(sources.data!, schedule, period)}
            sources={landing.map((s) => ({ id: s.id, name: s.name, amount: s.amount, received: received.has(s.id) }))}
            paydayLabel={paydayLabel(schedule, period.paySlot)}
            firstPayCounted={row.first_pay_received}
          />
        </div>
        {/* Each row has exactly one category; see the Activity page. */}
        <div className="lg:col-start-1 lg:row-start-3">
          <RecentActivity rows={recentWithImpact} today={today} />
          {/* Phones (dashboard.md fix #5, decision 4): the next period's plan. */}
          {next && (
            <Link
              href={`/plan?start=${next.period.start}`}
              className="mt-2 flex min-h-11 items-center justify-center gap-1 rounded-md text-sm font-extrabold text-link outline-link hover:text-link-hover focus-visible:outline-2 lg:hidden"
            >
              Plan next payday · {formatPeriodRange(next.period.start, next.period.end)}
            </Link>
          )}
        </div>
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
      <div className="hidden grid-cols-4 gap-4 lg:grid">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-[124px] rounded-[20px]" />
        ))}
      </div>
      <div className="flex flex-col gap-4 md:gap-6 lg:grid lg:grid-cols-[minmax(0,2fr)_minmax(300px,1fr)]">
        <div className="flex flex-col gap-4 md:gap-6">
          <Skeleton className="h-[260px] rounded-xl lg:hidden" />
          <Skeleton className="h-[240px] rounded-xl" />
          <Skeleton className="h-[200px] rounded-xl" />
        </div>
        <Skeleton className="h-[300px] rounded-2xl" />
      </div>
    </SkeletonRegion>
  );
}
