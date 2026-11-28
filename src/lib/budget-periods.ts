import type { SupabaseClient } from "@supabase/supabase-js";
import {
  type ActualPeriod,
  type BudgetScheduleFields,
  type EarlyStarts,
  type PaySlot,
  periodAt,
  scheduleFromBudget,
} from "@/lib/periods";
import type { Database, Tables } from "@/lib/supabase/types";

export type BudgetPeriod = Tables<"budget_periods">;

type Client = SupabaseClient<Database>;

/**
 * The budget's periods that started early (Task D2): payday → the day each
 * one began, for periodAt() and the other early-aware helpers. Usually empty
 * or a row or two, so it's one small query.
 */
export async function loadEarlyStarts(supabase: Client, budgetId: string): Promise<EarlyStarts> {
  const { data, error } = await supabase
    .from("budget_periods")
    .select("start_date, started_early_on")
    .eq("budget_id", budgetId)
    .not("started_early_on", "is", null);
  if (error) {
    throw new Error(`Couldn't load your periods: ${error.message}`, { cause: error });
  }
  return Object.fromEntries(data.map((r) => [r.start_date, r.started_early_on!]));
}

/** The day a period row actually began: started_early_on, else its payday. */
export function firstDayOf(row: { start_date: string; started_early_on?: string | null }): string {
  return row.started_early_on ?? row.start_date;
}

/** A period row as the period helpers take it, with its real first day. */
export function periodOf(row: Pick<BudgetPeriod, "start_date" | "end_date" | "pay_slot" | "started_early_on">): ActualPeriod {
  // The column's check constraint allows only the three pay slots.
  return { start: row.start_date, end: row.end_date, paySlot: row.pay_slot as PaySlot, firstDay: firstDayOf(row) };
}

/**
 * The period that contains `date` now, counting early starts, without
 * creating its row: for pages that only need its dates.
 */
export async function currentPeriod(
  supabase: Client,
  budget: BudgetScheduleFields & { id: string },
  date: string,
): Promise<ActualPeriod> {
  return periodAt(date, scheduleFromBudget(budget), await loadEarlyStarts(supabase, budget.id));
}

/**
 * The budget's period that contains `date` ("YYYY-MM-DD", usually
 * todayInManila()). Creates the row the first time the period is opened.
 * Counts early starts (Task D2): from the day a period started early, its
 * days belong to it.
 *
 * Safe to call on every page load and from two tabs at once: the insert does
 * nothing when the period already exists (unique budget_id + start_date), and
 * the row is then read back either way. RLS and the owner-tied foreign key
 * stop it from creating periods on someone else's budget.
 */
export async function getOrCreatePeriod(
  supabase: Client,
  budget: BudgetScheduleFields & { id: string },
  date: string,
): Promise<BudgetPeriod> {
  const period = periodAt(date, scheduleFromBudget(budget), await loadEarlyStarts(supabase, budget.id));

  // ignoreDuplicates turns this into INSERT ... ON CONFLICT DO NOTHING, so it
  // never changes an existing period. user_id defaults to the logged-in user.
  // A period that started early always exists already, so a new row is
  // always a plain payday-to-payday one.
  const { error: insertError } = await supabase.from("budget_periods").upsert(
    {
      budget_id: budget.id,
      start_date: period.start,
      end_date: period.end,
      pay_slot: period.paySlot,
    },
    { onConflict: "budget_id,start_date", ignoreDuplicates: true },
  );
  if (insertError) {
    throw new Error(`Couldn't create the period: ${insertError.message}`, { cause: insertError });
  }

  const { data, error } = await supabase
    .from("budget_periods")
    .select("*")
    .eq("budget_id", budget.id)
    .eq("start_date", period.start)
    .single();
  if (error) {
    throw new Error(`Couldn't load the period: ${error.message}`, { cause: error });
  }
  return data;
}
