import type { SupabaseClient } from "@supabase/supabase-js";
import { loadEarlyStarts } from "@/lib/budget-periods";
import type { Budget } from "@/lib/current-budget";
import { differenceInCalendarDays, format, parseISO, subDays } from "date-fns";
import { EARLY_PAY_DAYS, earlyPay, type StartEarlyOffer, startEarlyOffer } from "@/lib/income";
import { nextPeriods, scheduleFromBudget } from "@/lib/periods";
import type { Database } from "@/lib/supabase/types";

export type EarlyPay = {
  /** The next payday ("YYYY-MM-DD"), which early pay is saved on. */
  payday: string;
  /** Sources due that payday and not logged for it yet, oldest first. */
  sources: { id: string; name: string; amount: number }[];
};

/**
 * Paid early? (owner, Nov 28): loads the budget's sources and the income
 * already logged for the next payday, then asks earlyPay(). `excludeId` is
 * a row being edited, so its own source still counts as not logged. Once
 * the next period has started early (Task D2), it's the current one and
 * there's nothing to offer until the payday after it. RLS limits the
 * queries to the user's own rows.
 */
export async function loadEarlyPay(
  supabase: SupabaseClient<Database>,
  budget: Budget,
  today: string,
  excludeId: string | null = null,
): Promise<EarlyPay | null> {
  const schedule = scheduleFromBudget(budget);
  const early = await loadEarlyStarts(supabase, budget.id);
  const [, next] = nextPeriods(today, schedule, 2, early);
  const [sources, rows] = await Promise.all([
    supabase
      .from("income_sources")
      .select("id, name, amount, pay_slot, start_date, end_date")
      .eq("budget_id", budget.id)
      .order("created_at", { ascending: true }),
    supabase
      .from("transactions")
      .select("id, type, income_source_id, date, deleted_at")
      .eq("type", "income")
      .gte("date", next.start)
      .lte("date", next.end)
      .is("deleted_at", null),
  ]);
  for (const result of [sources, rows]) {
    if (result.error) throw new Error(`Couldn't load early pay: ${result.error.message}`, { cause: result.error });
  }
  const due = earlyPay(
    sources.data!,
    rows.data!.filter((r) => r.id !== excludeId),
    schedule,
    today,
    early,
  );
  return due && { payday: due.payday, sources: due.sources.map((s) => ({ id: s.id, name: s.name, amount: s.amount })) };
}

/** Start my next period now's offer, with the rows start_period_early() needs. */
export type StartEarly = StartEarlyOffer & {
  /** The period that would start today. */
  periodId: string;
  /** The current period's payday, for the payday screen afterwards. */
  oldStart: string;
  /** Its new last day: yesterday. */
  oldEnd: string;
};

/**
 * Start my next period now (owner, Nov 28; Task D3): startEarlyOffer() with
 * the budget's transactions, and the next period's id. Outside the 5 days
 * before a payday it returns null without loading transactions. RLS limits
 * every query to the user's own rows.
 */
export async function loadStartEarly(
  supabase: SupabaseClient<Database>,
  budget: Budget,
  today: string,
): Promise<StartEarly | null> {
  const schedule = scheduleFromBudget(budget);
  const early = await loadEarlyStarts(supabase, budget.id);
  const [current, next] = nextPeriods(today, schedule, 2, early);
  const daysAway = differenceInCalendarDays(parseISO(next.start), parseISO(today));
  if (daysAway < 1 || daysAway > EARLY_PAY_DAYS) return null;

  const [rows, period] = await Promise.all([
    supabase.from("transactions").select("type, amount, card_id, date, deleted_at").is("deleted_at", null),
    supabase.from("budget_periods").select("id").eq("budget_id", budget.id).eq("start_date", next.start).maybeSingle(),
  ]);
  for (const result of [rows, period]) {
    if (result.error) throw new Error(`Couldn't load your periods: ${result.error.message}`, { cause: result.error });
  }
  // Early pay is saved in the next period, so it exists whenever there's an offer.
  if (!period.data) return null;
  const offer = startEarlyOffer(budget.opening_balance, rows.data!, schedule, today, early);
  return offer && { ...offer, periodId: period.data.id, oldStart: current.start, oldEnd: format(subDays(parseISO(today), 1), "yyyy-MM-dd") };
}
