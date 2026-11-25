import type { Metadata } from "next";
import { Suspense } from "react";
import { PeriodPicker } from "@/components/plan/period-picker";
import { PlanGroups } from "@/components/plan/plan-groups";
import { PlanSummary } from "@/components/plan/plan-summary";
import { PageHeader } from "@/components/shell/page-header";
import { PageShell } from "@/components/shell/page-shell";
import { Skeleton, SkeletonRegion } from "@/components/skeleton";
import { todayInManila } from "@/lib/periods";
import { openPlanPeriod } from "@/lib/plan-periods";
import { requireAppUser } from "@/lib/require-app-user";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Plan · Chiwawallet" };

// The Plan (plan.md §1–3, week-5-tasks.md 5d-1): the period picker, the
// summary card and the group sections. The period is a query string
// (/plan?start=2026-11-30), not a [periodId] segment: a dynamic segment
// breaks the build, and a future period doesn't need to exist before you
// open it. Still to come: editing (5e), the desktop table and the empty
// plan (5d-2), the Plan options menu (5e), ticking items paid (Week 6).
export default function PlanPage({ searchParams }: { searchParams: Promise<{ start?: string | string[] }> }) {
  return (
    <PageShell>
      <PageHeader title="Plan" mobile="title" />
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

  return (
    <div className="flex flex-col gap-5 md:max-w-2xl">
      <PeriodPicker periods={plan.periods} selected={plan.period.start_date} current={plan.currentStart} />
      <PlanSummary summary={plan.summary} income={plan.income} carriedIn={plan.carriedIn} />
      <PlanGroups
        items={plan.items}
        income={plan.income}
        carriedIn={plan.carriedIn}
        previous={plan.previous}
        summary={plan.summary}
      />
    </div>
  );
}

// Skeleton blocks the size of the real content (app-shell.md §5 "Loading").
function PlanSkeleton() {
  return (
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
  );
}
