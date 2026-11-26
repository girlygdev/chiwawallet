import type { Metadata } from "next";
import { Suspense } from "react";
import { BuildRows, StarterCard } from "@/components/plan/empty-plan";
import { PeriodPicker } from "@/components/plan/period-picker";
import { type CarryLabel, PlanGroups } from "@/components/plan/plan-groups";
import { PlanStats } from "@/components/plan/plan-stats";
import { incomeLine, PlanSummary } from "@/components/plan/plan-summary";
import { PlanTable } from "@/components/plan/plan-table";
import { PlannedSplit } from "@/components/plan/planned-split";
import type { PaydayCard } from "@/components/plan/payday-picker";
import { addOneOffHref, setBudgetHref } from "@/components/plan/plan-groups";
import { PlanOptionsMenu } from "@/components/plan/plan-options-menu";
import { HeaderStickerLink, PageHeader } from "@/components/shell/page-header";
import { PageShell } from "@/components/shell/page-shell";
import { Skeleton, SkeletonRegion } from "@/components/skeleton";
import { describeSchedule, formatPeriodRange, scheduleFromBudget, todayInManila } from "@/lib/periods";
import { isEmptyPlan, missingStarterItems, type PlanOrigin, planCounts, planDone } from "@/lib/plan";
import type { BudgetGroup } from "@/lib/transactions";
import { openPlanPeriod } from "@/lib/plan-periods";
import { requireAppUser } from "@/lib/require-app-user";
import { createClient } from "@/lib/supabase/server";
import { PlanEditor, UseStarterPlanButton } from "./plan-item-sheet";

export const metadata: Metadata = { title: "Plan · Chiwawallet" };

// The Plan (plan.md §1–5, week-5-tasks.md 5d): the period picker, then
// - on mobile, the summary card and the group sections;
// - on desktop, the stat cards, the plan table and the Planned split card;
// - when nothing but income is planned, the empty plan with the starter card.
// The period is a query string (/plan?start=2026-11-30), not a [periodId]
// segment: a dynamic segment breaks the build, and a future period doesn't
// need to exist before you open it. Tapping a row opens Edit item
// (`&edit=…`, 5e) and Add one-off item opens with `&add=1` (5f), while the
// period hasn't ended. Still to come: the Plan options menu (5g), ticking
// items paid (Week 6).
export default function PlanPage({ searchParams }: { searchParams: Promise<{ start?: string | string[] }> }) {
  return (
    <PageShell>
      {/* Cache Components: the query string and the login are both request data. */}
      <Suspense fallback={<PlanSkeleton />}>
        <PlanContent searchParams={searchParams} />
      </Suspense>
    </PageShell>
  );
}

async function PlanContent({ searchParams }: { searchParams: Promise<{ start?: string | string[] }> }) {
  const { start } = await searchParams;
  const { budget } = await requireAppUser();
  const supabase = await createClient();
  const plan = await openPlanPeriod(supabase, budget, start, todayInManila(new Date()));
  const period = { start: plan.period.start_date, end: plan.period.end_date };
  const empty = isEmptyPlan(plan.items);
  // An ended period's plan is read-only: no edit links, no starter button.
  const editStart = plan.ended ? null : plan.period.start_date;
  // Add one-off item's payday cards: now and up to 3 months ahead, labelled like the picker.
  const nextStart = plan.periods.find((p) => p.start > plan.currentStart)?.start;
  const cards: PaydayCard[] = editStart
    ? plan.periods
        .filter((p) => p.start >= plan.currentStart)
        .map((p) => ({
          start: p.start,
          end: p.end,
          label: p.start === plan.currentStart ? "Now" : p.start === nextStart ? "Next" : "Ahead",
        }))
    : [];
  // Set a budget: this period's spending budgets by category, to start from and for the impact line.
  const budgets = Object.fromEntries(
    plan.items.filter((i) => i.section === "spending" && i.category_id).map((i) => [i.category_id!, i.planned_amount]),
  );

  // The row under the income (plan.md §3, §5): on the very first period, the
  // carry-in is the starting balance typed in during setup.
  const carryLabel: CarryLabel = plan.isFirst
    ? { name: "Starting balance", detail: "From setup" }
    : { name: "Carried in", detail: `Left over from ${formatPeriodRange(plan.previous.start, plan.previous.end)}` };
  const groups = {
    items: plan.items,
    income: plan.income,
    carriedIn: plan.carriedIn,
    carryLabel,
    summary: plan.summary,
    future: plan.future,
    editStart,
    hasDebts: plan.debts.length > 0,
    // Started and not closed: today, or an earlier period's last day (6b-1).
    canTick: plan.payOn != null,
    // Planned vs actual per group (6e).
    progress: plan.progress,
  };
  // The Plan options menu, while the period can change. Use starter plan
  // only while a starter group is missing and pay is expected.
  const starterMissing = missingStarterItems(
    plan.starter,
    plan.items.map((i) => ({ origin: i.origin as PlanOrigin, budget_group: i.budget_group as BudgetGroup | null })),
  );
  const menu = editStart && (
    <PlanOptionsMenu periodStart={editStart} hasDebts={plan.debts.length > 0} canUseStarter={starterMissing.length > 0} />
  );

  return (
    // No items to edit in an ended period, so an old ?edit= link opens nothing.
    <PlanEditor
      items={editStart ? plan.items : []}
      summary={plan.summary}
      periodStart={plan.period.start_date}
      cards={cards}
      budgets={budgets}
      periodLabel={formatPeriodRange(period.start, period.end)}
      debts={plan.debts}
    >
      <PageHeader
        title="Plan"
        mobile="title"
        eyebrow={describeSchedule(scheduleFromBudget(budget))}
        mobileAction={menu || undefined}
        desktopAction={
          editStart ? (
            <div className="flex items-center gap-3">
              {menu}
              <HeaderStickerLink href={addOneOffHref(editStart)}>Add one-off item</HeaderStickerLink>
            </div>
          ) : undefined
        }
      />
      <div className="flex flex-col gap-5">
        <PeriodPicker periods={plan.periods} selected={plan.period.start_date} current={plan.currentStart} />

        {empty ? (
          <div className="flex flex-col gap-5 md:max-w-2xl">
            <PlanSummary summary={plan.summary} income={plan.income} carriedIn={plan.carriedIn} empty />
            <StarterCard
              pay={plan.pay}
              starter={plan.starter}
              targets={budget}
              action={editStart && <UseStarterPlanButton periodStart={editStart} />}
            />
            <PlanGroups {...groups} moneyInOnly />
            <BuildRows addOneOff={editStart && addOneOffHref(editStart)} setBudget={editStart && setBudgetHref(editStart)} />
          </div>
        ) : (
          <>
            {/* Mobile: the summary card and the group sections. */}
            <div className="flex flex-col gap-5 md:hidden">
              <PlanSummary summary={plan.summary} income={plan.income} carriedIn={plan.carriedIn} />
              <PlanGroups {...groups} />
            </div>

            {/* Desktop: stat cards, then the table beside the Planned split card. */}
            <div className="hidden flex-col gap-5 md:flex">
              <PlanStats
                moneyForPeriod={plan.summary.moneyForPeriod}
                incomeLine={incomeLine(plan.income, plan.carriedIn)}
                planned={plan.summary.planned}
                counts={planCounts(plan.items)}
                notAssigned={plan.summary.notAssigned}
                moneyOut={plan.moneyOut}
                done={planDone(plan.moneyOut ?? 0, plan.summary.planned)}
              />
              <div className="flex flex-col gap-5 lg:grid lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
                <PlanTable
                  period={period}
                  items={plan.items}
                  income={plan.income}
                  carriedIn={plan.carriedIn}
                  carryLabel={carryLabel}
                  summary={plan.summary}
                  editStart={editStart}
                  hasDebts={plan.debts.length > 0}
                  canTick={plan.payOn != null}
                  progress={plan.progress}
                />
                <PlannedSplit split={plan.summary.split} income={plan.income} />
              </div>
            </div>
          </>
        )}
      </div>
    </PlanEditor>
  );
}

// Skeleton blocks the size of the real content (app-shell.md §5 "Loading").
function PlanSkeleton() {
  return (
    <>
      <PageHeader title="Plan" mobile="title" />
      <SkeletonRegion className="flex flex-col gap-5 md:max-w-2xl">
        <div className="flex gap-2 overflow-hidden">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-14 w-24 shrink-0 rounded-[14px]" />
          ))}
        </div>
        <Skeleton className="h-[190px] rounded-[22px]" />
        <Skeleton className="h-[140px] rounded-2xl" />
        <Skeleton className="h-[200px] rounded-2xl" />
      </SkeletonRegion>
    </>
  );
}
