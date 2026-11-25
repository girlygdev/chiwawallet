import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PageHeader } from "@/components/shell/page-header";
import { PageShell } from "@/components/shell/page-shell";
import { formatPeso } from "@/lib/money";
import { formatPeriodRange, todayInManila } from "@/lib/periods";
import { openPlanPeriod } from "@/lib/plan-periods";
import { requireAppUser } from "@/lib/require-app-user";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Plan · Chiwawallet" };

// TEMPORARY (5c): opens a period and lists its items, so generation can be
// checked on a phone. 5d replaces this with the real Plan screen (plan.md).
// The period is a query string (/plan?start=2026-11-30), not a [periodId]
// segment: a dynamic segment breaks the build, and a future period doesn't
// need to exist before you open it.
export default function PlanPage({ searchParams }: { searchParams: Promise<{ start?: string | string[] }> }) {
  return (
    <PageShell>
      <PageHeader title="Plan" mobile="title" />
      {/* Cache Components: the query string and the login are both request data. */}
      <Suspense>
        <PlanContent searchParams={searchParams} />
      </Suspense>
    </PageShell>
  );
}

async function PlanContent({ searchParams }: { searchParams: Promise<{ start?: string | string[] }> }) {
  const { start } = await searchParams;
  const { budget } = await requireAppUser();
  const supabase = await createClient();
  const { period, periods, currentStart, items } = await openPlanPeriod(
    supabase,
    budget,
    start,
    todayInManila(new Date()),
  );

  return (
    <div className="flex flex-col gap-4">
      <nav aria-label="Payday periods" className="flex gap-2 overflow-x-auto pb-1">
        {periods.map((p) => (
          <Link
            key={p.start}
            href={`/plan?start=${p.start}`}
            aria-current={p.start === period.start_date ? "true" : undefined}
            className="flex min-h-11 shrink-0 items-center rounded-md border border-line px-3 text-sm font-bold text-ink aria-[current]:bg-green-600 aria-[current]:text-white"
          >
            {p.start === currentStart ? "Now · " : ""}
            {formatPeriodRange(p.start, p.end)}
          </Link>
        ))}
      </nav>

      {items.length === 0 ? (
        <p className="text-text-3">Nothing planned in this period yet.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-line rounded-lg border border-line bg-surface">
          {items.map((item) => (
            <li key={item.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <span className="font-bold text-ink">{item.name}</span>
              <span className="font-display text-ink">{formatPeso(item.planned_amount)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
