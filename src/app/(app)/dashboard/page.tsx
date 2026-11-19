import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/shell/page-header";
import { PageShell } from "@/components/shell/page-shell";
import { getOrCreatePeriod } from "@/lib/budget-periods";
import { expectedForPeriod, isActiveOn } from "@/lib/income";
import { formatPeso } from "@/lib/money";
import {
  formatPeriodRange,
  type Period,
  type PaySlot,
  paydayLabel,
  periodStatusLine,
  scheduleFromBudget,
  todayInManila,
} from "@/lib/periods";
import { requireAppUser } from "@/lib/require-app-user";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Dashboard · Chiwawallet" };

// Week 2 (task 2f): this period's dates, days left and expected income, which
// is Week 2's "done when". Safe to spend, Due this period and the rest of
// dashboard.md need transactions and plan items (Weeks 3–5).
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

  const { data: sources, error } = await supabase
    .from("income_sources")
    .select("id, name, amount, pay_slot, start_date, end_date")
    .eq("budget_id", budget.id)
    .order("created_at", { ascending: true });
  if (error) throw new Error(`Couldn't load income sources: ${error.message}`, { cause: error });

  const expected = expectedForPeriod(sources, schedule, period);
  // The sources that land on this period's payday, for the breakdown.
  const landing = sources.filter(
    (s) =>
      isActiveOn(s, period.start) &&
      (schedule.frequency !== "semi_monthly" || s.pay_slot === "every" || s.pay_slot === period.paySlot),
  );

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

      {/* The dashboard's one hero card (style-guide.md: one sticker per area). */}
      <section
        aria-labelledby="expected-title"
        className="flex max-w-xl flex-col gap-3 rounded-xl border-2 border-sticker bg-green-700 p-5 text-white shadow-sticker"
      >
        <h2 id="expected-title" className="text-sm font-bold opacity-90">
          Expected income this period
        </h2>
        <p className="font-display text-[44px] leading-none font-semibold">{formatPeso(expected)}</p>

        {row.first_pay_received && (
          // Onboarding's "Has your pay already arrived?" was yes: it's already
          // inside the starting balance (plan review 3.14).
          // White, not text-mint: mint turns dark green in dark mode, and the
          // Forest pill stays dark in both themes.
          <p className="w-fit rounded-full bg-green-800 px-3 py-1 text-[13px] font-extrabold text-white">
            Already in your starting balance
          </p>
        )}

        {landing.length > 0 ? (
          <ul className="flex flex-col gap-1 border-t border-white/20 pt-3 text-sm">
            {landing.map((s) => (
              <li key={s.id} className="flex justify-between gap-3">
                <span className="opacity-90">{s.name}</span>
                <span className="font-extrabold">{formatPeso(s.amount)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm opacity-90">
            No income lands on your {paydayLabel(schedule, period.paySlot)} payday.
          </p>
        )}
      </section>

      <p className="text-[15px] text-text-3">
        Your bills, spending and Safe to spend will show up here once you start logging money.
      </p>
    </div>
  );
}

// Skeleton blocks the size of the real content (app-shell.md §5 "Loading").
function DashboardSkeleton() {
  return (
    <div aria-hidden className="flex flex-col gap-4 md:gap-6">
      <div className="flex flex-col gap-1.5">
        <span className="h-7 w-40 rounded bg-track" />
        <span className="h-4 w-48 rounded bg-track" />
      </div>
      <span className="h-[180px] max-w-xl rounded-xl bg-track" />
    </div>
  );
}
