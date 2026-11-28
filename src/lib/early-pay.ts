import type { SupabaseClient } from "@supabase/supabase-js";
import type { Budget } from "@/lib/current-budget";
import { earlyPay } from "@/lib/income";
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
 * a row being edited, so its own source still counts as not logged. RLS
 * limits both queries to the user's own rows.
 */
export async function loadEarlyPay(
  supabase: SupabaseClient<Database>,
  budget: Budget,
  today: string,
  excludeId: string | null = null,
): Promise<EarlyPay | null> {
  const schedule = scheduleFromBudget(budget);
  const [, next] = nextPeriods(today, schedule, 2);
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
  const early = earlyPay(
    sources.data!,
    rows.data!.filter((r) => r.id !== excludeId),
    schedule,
    today,
  );
  return early && { payday: early.payday, sources: early.sources.map((s) => ({ id: s.id, name: s.name, amount: s.amount })) };
}
