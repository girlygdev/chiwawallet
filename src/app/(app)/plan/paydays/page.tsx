import type { Metadata } from "next";
import { Suspense } from "react";
import { PaydaysOverview } from "@/components/plan/paydays-table";
import { PageHeader } from "@/components/shell/page-header";
import { PageShell } from "@/components/shell/page-shell";
import { Skeleton, SkeletonRegion } from "@/components/skeleton";
import { formatPeriodRange, todayInManila } from "@/lib/periods";
import { loadPaydaysOverview } from "@/lib/plan-periods";
import { requireAppUser } from "@/lib/require-app-user";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Paydays overview · Chiwawallet" };

const BACK = { backHref: "/plan", backLabel: "Back to Plan" };

// The Paydays overview (week-7-tasks.md 7g-1, decision 1): every payday from
// the first period to 6 months ahead, read only, to compare with a Sheet.
export default function PaydaysPage() {
  return (
    <PageShell>
      {/* Cache Components: the login is request data. */}
      <Suspense fallback={<OverviewSkeleton />}>
        <PaydaysContent />
      </Suspense>
    </PageShell>
  );
}

async function PaydaysContent() {
  const { budget } = await requireAppUser();
  const supabase = await createClient();
  const { rows, total } = await loadPaydaysOverview(supabase, budget, todayInManila(new Date()));
  const first = rows[0];
  const last = rows.at(-1);
  const eyebrow = first && last ? `${rows.length} paydays · ${formatPeriodRange(first.period.start, last.period.end)}` : undefined;

  return (
    <>
      <PageHeader title="Paydays overview" mobile={BACK} eyebrow={eyebrow} />
      <PaydaysOverview rows={rows} total={total} />
    </>
  );
}

function OverviewSkeleton() {
  return (
    <>
      <PageHeader title="Paydays overview" mobile={BACK} />
      <SkeletonRegion className="flex flex-col gap-3">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-[150px] rounded-2xl xl:h-12" />
        ))}
      </SkeletonRegion>
    </>
  );
}
