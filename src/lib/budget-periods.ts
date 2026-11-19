import type { SupabaseClient } from "@supabase/supabase-js";
import { type BudgetScheduleFields, getPeriod, scheduleFromBudget } from "@/lib/periods";
import type { Database, Tables } from "@/lib/supabase/types";

export type BudgetPeriod = Tables<"budget_periods">;

/**
 * The budget's period that contains `date` ("YYYY-MM-DD", usually
 * todayInManila()). Creates the row the first time the period is opened.
 *
 * Safe to call on every page load and from two tabs at once: the insert does
 * nothing when the period already exists (unique budget_id + start_date), and
 * the row is then read back either way. RLS and the owner-tied foreign key
 * stop it from creating periods on someone else's budget.
 */
export async function getOrCreatePeriod(
  supabase: SupabaseClient<Database>,
  budget: BudgetScheduleFields & { id: string },
  date: string,
): Promise<BudgetPeriod> {
  const period = getPeriod(date, scheduleFromBudget(budget));

  // ignoreDuplicates turns this into INSERT ... ON CONFLICT DO NOTHING, so it
  // never changes an existing period. user_id defaults to the logged-in user.
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
