import type { Metadata } from "next";
import { Suspense } from "react";
import { ActivityEmpty } from "@/components/activity/activity-empty";
import { ActivityList } from "@/components/activity/activity-list";
import { PeriodBar } from "@/components/activity/period-bar";
import { ActivitySearchButton, ActivitySearchProvider } from "@/components/activity/search-context";
import { PageHeader } from "@/components/shell/page-header";
import { PageShell } from "@/components/shell/page-shell";
import { Skeleton, SkeletonRegion } from "@/components/skeleton";
import { type ActivityRow, periodNav, resolvePeriod } from "@/lib/activity";
import { getOrCreatePeriod } from "@/lib/budget-periods";
import { duePay, receivedSourceIds } from "@/lib/income";
import { formatPeso } from "@/lib/money";
import { formatPeriodRange, type PaySlot, periodStatusLine, scheduleFromBudget, todayInManila } from "@/lib/periods";
import { requireAppUser } from "@/lib/require-app-user";
import { createClient } from "@/lib/supabase/server";
import { periodTotals } from "@/lib/transactions";

export const metadata: Metadata = { title: "Transactions · Chiwawallet" };

/** The whole period loads at once (owner, Nov 23); more than this is unlikely. */
const MAX_ROWS = 500;

// Activity (mobile) / Transactions (desktop), activity.md §1–2 and §5: one
// period's transactions at /activity?period=<any day in it>, the current
// period by default. Rows open Edit transaction and have Delete (3e-2).
export default function ActivityPage({ searchParams }: PageProps<"/activity">) {
  return (
    <PageShell>
      {/* The header's search button and the list's search field share state. */}
      <ActivitySearchProvider>
        {/* Cache Components: the login check reads cookies, so it sits in <Suspense>. */}
        <Suspense fallback={<ActivitySkeleton />}>
          <ActivityContent searchParams={searchParams} />
        </Suspense>
      </ActivitySearchProvider>
    </PageShell>
  );
}

async function ActivityContent({ searchParams }: { searchParams: PageProps<"/activity">["searchParams"] }) {
  const { period: param } = await searchParams;
  const { budget } = await requireAppUser();
  const supabase = await createClient();
  const schedule = scheduleFromBudget(budget);
  const today = todayInManila(new Date());

  // The current period's row, created the first time it's needed (like the
  // Dashboard). Older periods are only read: browsing never creates one.
  const currentRow = await getOrCreatePeriod(supabase, budget, today);
  const { data: firstRow, error: firstError } = await supabase
    .from("budget_periods")
    .select("start_date")
    .eq("budget_id", budget.id)
    .order("start_date", { ascending: true })
    .limit(1)
    .single();
  if (firstError) throw new Error(`Couldn't load the first period: ${firstError.message}`, { cause: firstError });
  const limits = { today, firstStart: firstRow.start_date };

  const period = resolvePeriod(typeof param === "string" ? param : undefined, schedule, limits);
  const isCurrent = period.start === currentRow.start_date;
  const isFirst = period.start === firstRow.start_date;
  let periodRow = isCurrent ? currentRow : null;
  if (!isCurrent) {
    const { data, error } = await supabase
      .from("budget_periods")
      .select("*")
      .eq("budget_id", budget.id)
      .eq("start_date", period.start)
      .maybeSingle();
    if (error) throw new Error(`Couldn't load the period: ${error.message}`, { cause: error });
    periodRow = data;
  }

  let rows: ActivityRow[] = [];
  if (periodRow) {
    const { data, error } = await supabase
      .from("transactions")
      .select(
        "id, type, amount, card_id, date, note, created_at, deleted_at, category:categories(id, name, icon, color), source:income_sources(name)",
      )
      .eq("period_id", periodRow.id)
      .is("deleted_at", null)
      .order("date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(MAX_ROWS);
    if (error) throw new Error(`Couldn't load transactions: ${error.message}`, { cause: error });
    // The generated types say `string` for type; its check constraint allows
    // only the four types. Each row has exactly one category (not null).
    rows = data as unknown as ActivityRow[];
  }

  const totals = periodTotals(rows);
  const nav = periodNav(period, schedule, limits);
  const count = `${rows.length} ${rows.length === 1 ? "transaction" : "transactions"}${isCurrent ? " this period" : ""}`;

  // The empty state's "I got paid ₱25,000": only for the current period.
  let due: { id: string; amount: number } | null = null;
  if (rows.length === 0 && isCurrent) {
    const { data: sources, error } = await supabase
      .from("income_sources")
      .select("id, amount, pay_slot, start_date, end_date")
      .eq("budget_id", budget.id)
      .order("created_at", { ascending: true });
    if (error) throw new Error(`Couldn't load income sources: ${error.message}`, { cause: error });
    const received = receivedSourceIds(
      [],
      // The column's check constraint allows only the three pay slots.
      { start: currentRow.start_date, paySlot: currentRow.pay_slot as PaySlot, first_pay_received: currentRow.first_pay_received },
      sources,
      schedule,
    );
    due = duePay(sources, received, schedule, today);
  }

  return (
    <>
      <PageHeader
        title="Activity"
        desktopTitle="Transactions"
        mobile="title"
        eyebrow={count}
        mobileAction={rows.length > 0 ? <ActivitySearchButton /> : undefined}
      />

      <PeriodBar
        start={period.start}
        end={period.end}
        status={periodStatusLine(period, schedule, today)}
        prev={nav.prev}
        next={nav.next}
      />

      <Totals totals={totals} />

      {rows.length === 0 ? (
        <ActivityEmpty
          current={isCurrent}
          duePay={due}
          startingBalance={isFirst ? budget.opening_balance : null}
        />
      ) : (
        <ActivityList
          rows={rows}
          today={today}
          periodLabel={isCurrent ? "this period" : formatPeriodRange(period.start, period.end)}
        />
      )}
    </>
  );
}

// Mobile: Money in and Money out (activity.md §1.3). Desktop: Money in,
// Spending and To savings (§2); "incl. ₱1,700 bills" waits for Bills (Week 4).
function Totals({ totals }: { totals: ReturnType<typeof periodTotals> }) {
  const CARD = "flex flex-col gap-1 rounded-xl border-[1.5px] border-line bg-surface p-4";
  const LABEL = "text-[13px] font-bold text-text-3";
  const AMOUNT = "font-display text-[22px] leading-none font-semibold";
  return (
    <section aria-label="Totals this period" className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4">
      <div className={CARD}>
        <p className={LABEL}>Money in</p>
        <p className={`${AMOUNT} text-link`}>{formatPeso(totals.moneyIn)}</p>
      </div>
      <div className={CARD}>
        <p className={LABEL}>
          <span className="md:hidden">Money out</span>
          <span className="hidden md:inline">Spending</span>
        </p>
        <p className={`${AMOUNT} text-ink`}>{formatPeso(totals.moneyOut)}</p>
      </div>
      <div className={`${CARD} hidden md:flex`}>
        <p className={LABEL}>To savings</p>
        <p className={`${AMOUNT} text-ink`}>{formatPeso(totals.toSavings)}</p>
      </div>
    </section>
  );
}

function ActivitySkeleton() {
  return (
    <SkeletonRegion className="flex flex-col gap-4 md:gap-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-col gap-1.5">
          <Skeleton className="hidden h-4 w-40 md:block" />
          <Skeleton className="h-8 w-40" />
        </div>
        <Skeleton className="size-11 rounded-full md:h-12 md:w-48 md:rounded-[14px]" />
      </div>
      <Skeleton className="h-[54px] rounded-2xl md:max-w-md" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4">
        <Skeleton className="h-[78px] rounded-xl" />
        <Skeleton className="h-[78px] rounded-xl" />
        <Skeleton className="hidden h-[78px] rounded-xl md:block" />
      </div>
      <div className="flex gap-2">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-[38px] w-20 rounded-full" />
        ))}
      </div>
      <Skeleton className="h-64 rounded-2xl" />
    </SkeletonRegion>
  );
}
