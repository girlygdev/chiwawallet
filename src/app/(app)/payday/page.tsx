import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { PaydayScreen } from "@/components/payday/payday-screen";
import { PageShell } from "@/components/shell/page-shell";
import { Skeleton, SkeletonRegion } from "@/components/skeleton";
import { todayInManila } from "@/lib/periods";
import { loadPaydayData } from "@/lib/plan-periods";
import { requireAppUser } from "@/lib/require-app-user";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "It's payday · Chiwawallet" };

type Params = Promise<{ start?: string | string[] }>;

// The payday screen (payday-rollover.md, task 6h-2): /payday?start=<the
// period that just ended> (owner, Nov 26: a query string like the Plan's).
// The Dashboard and the Plan send people here when a period is waiting for
// its leftover choice. A period that isn't waiting goes back to the
// Dashboard, so an old link can't show it twice.
export default function PaydayPage({ searchParams }: { searchParams: Params }) {
  return (
    <PageShell>
      {/* Cache Components: the query string and the login are both request data. */}
      <Suspense fallback={<PaydaySkeleton />}>
        <PaydayContent searchParams={searchParams} />
      </Suspense>
    </PageShell>
  );
}

async function PaydayContent({ searchParams }: { searchParams: Params }) {
  const { start } = await searchParams;
  const { budget } = await requireAppUser();
  const supabase = await createClient();
  const today = todayInManila(new Date());
  if (typeof start !== "string") redirect("/");

  const { data: old, error } = await supabase
    .from("budget_periods")
    .select("id, start_date, end_date, closed_at")
    .eq("budget_id", budget.id)
    .eq("start_date", start)
    .maybeSingle();
  if (error) throw new Error(`Couldn't load the period: ${error.message}`, { cause: error });
  if (!old || old.closed_at != null || old.end_date >= today) redirect("/");

  const data = await loadPaydayData(supabase, budget, old, today);
  return <PaydayScreen data={data} />;
}

function PaydaySkeleton() {
  return (
    <SkeletonRegion className="flex flex-col items-center gap-4 pt-4">
      <Skeleton className="size-28 rounded-full" />
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-[180px] w-full rounded-[20px]" />
      <Skeleton className="h-[220px] w-full rounded-[22px]" />
    </SkeletonRegion>
  );
}
