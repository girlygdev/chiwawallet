import type { SupabaseClient } from "@supabase/supabase-js";
import type { BillFrequency } from "@/lib/bills";
import { type BudgetPeriod, getOrCreatePeriod } from "@/lib/budget-periods";
import type { Budget } from "@/lib/current-budget";
import { type DebtTerms, debtPaid } from "@/lib/debts";
import { getPeriod, type Period, type PaySchedule, type PaySlot, scheduleFromBudget } from "@/lib/periods";
import { generatePlan, type PlanSources, plannablePeriods, resolvePlanStart } from "@/lib/plan";
import type { Database, Tables } from "@/lib/supabase/types";

// Opening a period on the Plan (week-5-tasks.md 5c). Server only: it reads
// and writes with the logged-in user's client, so RLS limits everything to
// their own rows.

export type PlanItem = Tables<"plan_items">;

export type OpenedPlan = {
  /** The period shown, created if it didn't exist yet. */
  period: BudgetPeriod;
  /** Every period the picker offers, oldest first. */
  periods: Period[];
  /** The current period's start, for the "Now" chip. */
  currentStart: string;
  /** The period's live items, oldest first. */
  items: PlanItem[];
};

type Client = SupabaseClient<Database>;

const fail = (what: string, error: { message: string }): never => {
  throw new Error(`Couldn't ${what}: ${error.message}`, { cause: error });
};

/**
 * Opens the period `/plan?start=…` asks for (or the current one), creating it
 * the first time. A period that hasn't ended gets its generated items: the
 * first time, everything; after that, only what's new (a bill added since),
 * because add_plan_items() skips items already there, deleted ones included.
 * Past periods are never generated.
 */
export async function openPlanPeriod(supabase: Client, budget: Budget, requested: unknown, today: string): Promise<OpenedPlan> {
  const schedule = scheduleFromBudget(budget);

  // The budget's first period: the picker never goes back before it.
  const { data: first, error: firstError } = await supabase
    .from("budget_periods")
    .select("start_date")
    .eq("budget_id", budget.id)
    .order("start_date")
    .limit(1)
    .maybeSingle();
  if (firstError) fail("load your periods", firstError);

  const periods = plannablePeriods(today, schedule, first?.start_date ?? null);
  const currentStart = getPeriod(today, schedule).start;
  const start = resolvePlanStart(requested, periods, currentStart);

  const period = await getOrCreatePeriod(supabase, budget, start);
  if (period.end_date >= today) {
    await addGeneratedItems(supabase, budget, period, schedule);
  }

  const { data: items, error } = await supabase
    .from("plan_items")
    .select("*")
    .eq("period_id", period.id)
    .is("deleted_at", null)
    .order("created_at")
    .order("id");
  if (error) fail("load the plan", error);

  return { period, periods, currentStart, items: items! };
}

/** Runs generatePlan() for the period and adds whatever isn't there yet. */
async function addGeneratedItems(supabase: Client, budget: Budget, row: BudgetPeriod, schedule: PaySchedule) {
  const [sources, bills, pots, debts, payments, categories] = await Promise.all([
    supabase.from("income_sources").select("id, name, amount, pay_slot, start_date, end_date").eq("budget_id", budget.id),
    supabase
      .from("recurring_bills")
      .select("id, name, amount, category_id, frequency, due_day, first_due_month, pay_slot")
      .eq("budget_id", budget.id),
    supabase.from("savings_pots").select("id, name, pay_slot, planned_contribution"),
    supabase
      .from("debts")
      .select("id, name, total_amount, payment_type, num_payments, payment_amount, first_due_date, paid_off_at"),
    // Every live debt payment, for what's been paid (never stored).
    supabase
      .from("transactions")
      .select("debt_id, amount, deleted_at")
      .eq("type", "debt_payment")
      .not("debt_id", "is", null)
      .is("deleted_at", null),
    supabase.from("categories").select("id, name, kind, system_key, default_budget"),
  ]);
  for (const result of [sources, bills, pots, debts, payments, categories]) {
    if (result.error) fail("load what the plan is made from", result.error);
  }

  // The system categories generated items use; every account has them.
  const systemId = (key: string) => {
    const id = categories.data!.find((c) => c.system_key === key)?.id;
    if (!id) throw new Error(`The ${key} system category is missing.`);
    return id;
  };

  const planSources: PlanSources = {
    categories: { income: systemId("income"), savingsPot: systemId("savings_pot"), debtPayment: systemId("debt_payment") },
    incomeSources: sources.data!,
    // The check constraints allow only these values.
    bills: bills.data!.map((b) => ({ ...b, frequency: b.frequency as BillFrequency })),
    pots: pots.data!,
    debts: debts.data!.map((d) => ({
      ...d,
      payment_type: d.payment_type as DebtTerms["payment_type"],
      paid: debtPaid(payments.data!.filter((p) => p.debt_id === d.id)),
    })),
    spending: categories.data!,
  };

  const period: Period = { start: row.start_date, end: row.end_date, paySlot: row.pay_slot as PaySlot };
  const items = generatePlan(period, schedule, planSources);
  if (items.length === 0) return;

  const { error } = await supabase.rpc("add_plan_items", { target_period: row.id, items });
  if (error) fail("add the plan's items", error);
}
