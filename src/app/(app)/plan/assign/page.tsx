import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AssignForm } from "@/components/plan/assign-form";
import { PageHeader } from "@/components/shell/page-header";
import { PageShell } from "@/components/shell/page-shell";
import { Skeleton, SkeletonRegion } from "@/components/skeleton";
import { formatPeso } from "@/lib/money";
import { formatPeriodRange, todayInManila } from "@/lib/periods";
import type { AssignPreset } from "@/lib/plan";
import { assignTargets, loadAssignData, openPlanPeriod } from "@/lib/plan-periods";
import { requireAppUser } from "@/lib/require-app-user";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Give leftover a job · Chiwawallet" };

/** The Plan's shortcuts (`?preset=pot|debt|buffer`) → a preset. */
const SHORTCUTS: Record<string, AssignPreset> = { pot: "save_all", debt: "debt_first", buffer: "keep_all" };

type Params = Promise<{ start?: string | string[]; preset?: string | string[] }>;

// Give leftover a job (plan.md §7, task 6f): /plan/assign?start=…, for a
// period that hasn't ended. The page opens the period like the Plan does,
// so Not assigned yet and each pot's and debt's limits are live numbers.
export default function AssignPage({ searchParams }: { searchParams: Params }) {
  return (
    <PageShell>
      {/* Cache Components: the query string and the login are both request data. */}
      <Suspense fallback={<AssignSkeleton />}>
        <AssignContent searchParams={searchParams} />
      </Suspense>
    </PageShell>
  );
}

async function AssignContent({ searchParams }: { searchParams: Params }) {
  const { start, preset } = await searchParams;
  const { budget } = await requireAppUser();
  const supabase = await createClient();
  const today = todayInManila(new Date());
  const plan = await openPlanPeriod(supabase, budget, start, today);
  const backHref = `/plan?start=${plan.period.start_date}`;
  const range = formatPeriodRange(plan.period.start_date, plan.period.end_date);
  const total = plan.summary.notAssigned;
  const back = { backHref, backLabel: "Back to Plan" };

  if (plan.ended || total <= 0) {
    return (
      <>
        <PageHeader title="Give leftover a job" mobile={back} />
        <section className="flex flex-col items-start gap-3 rounded-2xl border-[1.5px] border-line bg-surface p-5">
          <p className="text-[15px] text-text-2">
            {plan.ended ? `${range} has ended, so its plan can't change.` : `Every peso in ${range} already has a job.`}
          </p>
          <Link
            href={backHref}
            className="flex min-h-11 items-center rounded-full bg-mint px-4 text-sm font-extrabold text-green-800 outline-link focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            Back to Plan
          </Link>
        </section>
      </>
    );
  }

  const { destinations, next } = await loadAssignData(supabase, budget, plan, today);
  const { pot, debt } = assignTargets(destinations);

  return (
    <>
      <PageHeader
        title={`Give ${formatPeso(total)} a job`}
        mobile={back}
        eyebrow={`${range} · not assigned yet`}
        desktopAction={
          <Link
            href={backHref}
            className="flex min-h-11 items-center rounded-full border-[1.5px] border-line bg-surface px-4 text-sm font-extrabold text-ink outline-link focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            Back to Plan
          </Link>
        }
      />
      <p className="-mt-2 text-sm text-text-3 md:hidden">{range} · not assigned yet</p>
      <AssignForm
        total={total}
        periodStart={plan.period.start_date}
        destinations={destinations}
        potKey={pot?.key ?? null}
        debtKey={debt?.key ?? null}
        next={next}
        initialPreset={typeof preset === "string" ? (SHORTCUTS[preset] ?? null) : null}
        backHref={backHref}
      />
    </>
  );
}

function AssignSkeleton() {
  return (
    <SkeletonRegion className="flex flex-col gap-5">
      <Skeleton className="h-8 w-56" />
      <Skeleton className="h-[150px] rounded-[22px]" />
      <Skeleton className="h-11 w-full rounded-full" />
      <Skeleton className="h-[140px] rounded-2xl" />
      <Skeleton className="h-[140px] rounded-2xl" />
    </SkeletonRegion>
  );
}
