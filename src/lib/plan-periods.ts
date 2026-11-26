import type { SupabaseClient } from "@supabase/supabase-js";
import { addDays, format, parseISO } from "date-fns";
import type { BillFrequency } from "@/lib/bills";
import { type BudgetPeriod, getOrCreatePeriod } from "@/lib/budget-periods";
import type { Budget } from "@/lib/current-budget";
import { type DebtTerms, debtLeft, debtPaid } from "@/lib/debts";
import { receivedSourceIds } from "@/lib/income";
import { dashboardNumbers } from "@/lib/money";
import { getPeriod, type Period, type PaySlot, scheduleFromBudget } from "@/lib/periods";
import {
  generatePlan,
  incomeStatus,
  type PlanOrigin,
  type PlanSection,
  type PlanSources,
  type PlanSummary,
  type StarterItem,
  type SyncRow,
  periodIncome,
  planItemDetail,
  planSection,
  planSummary,
  planSync,
  plannablePeriods,
  resolvePlanStart,
  starterPlan,
} from "@/lib/plan";
import type { Database, Tables } from "@/lib/supabase/types";
import type { BudgetGroup } from "@/lib/transactions";

// Opening a period on the Plan (week-5-tasks.md 5c, 5d-1). Server only: it
// reads and writes with the logged-in user's client, so RLS limits
// everything to their own rows. All the Plan's numbers are worked out here
// with lib/plan.ts, so the components only lay them out.

export type PlanItem = Tables<"plan_items">;

/** A plan item ready to show: its section, group and detail line. */
export type PlanRow = PlanItem & {
  section: PlanSection;
  /** The category's group, or a starter item's own; empty for income. */
  group: BudgetGroup | null;
  /** "Due Dec 10", "Every 15th"; for income, "Received" or "Expected Nov 30". */
  detail: string;
  /** Income rows only: whether the pay came in. */
  received: boolean;
};

export type OpenedPlan = {
  /** The period shown, created if it didn't exist yet. */
  period: BudgetPeriod;
  /** Every period the picker offers, oldest first. */
  periods: Period[];
  /** The current period's start, for the "Now" chip. */
  currentStart: string;
  /** The period's live items, in generation order (oldest first). */
  items: PlanRow[];
  /** Received income, plus what's still expected while the period is open. */
  income: number;
  /** Cash at the start of the period; empty for future periods (plan.md §1: "—"). */
  carriedIn: number | null;
  /** The period before, for "Left over from Oct 30 – Nov 14". */
  previous: Period;
  summary: PlanSummary;
  /** The budget's first period: carry-in is the starting balance from setup. */
  isFirst: boolean;
  /** Starts after today: expected income only, no carry-in, nothing paid yet. */
  future: boolean;
  /** Ended before today: its plan is read-only (5e), and closing it comes in Week 6. */
  ended: boolean;
  /** Money out so far (Paid or spent); empty for future periods. */
  moneyOut: number | null;
  /** The empty plan's starter tiles: the budget's split of this payday's expected pay (not the carry-in). */
  starter: StarterItem[];
  /** This payday's expected pay, for "a 50/30/20 split of your ₱25,000 pay". */
  pay: number;
  /** Plan a debt payment's choices (5g-2): debts not paid off, with what's left, oldest first. */
  debts: PlanDebt[];
};

export type PlanDebt = { id: string; name: string; left: number; flexible: boolean };

type Client = SupabaseClient<Database>;

const fail = (what: string, error: { message: string }): never => {
  throw new Error(`Couldn't ${what}: ${error.message}`, { cause: error });
};

const dayBefore = (date: string) => format(addDays(parseISO(date), -1), "yyyy-MM-dd");

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

  const row = await getOrCreatePeriod(supabase, budget, start);
  const period: Period = { start: row.start_date, end: row.end_date, paySlot: row.pay_slot as PaySlot };
  const ended = row.end_date < today;
  const future = row.start_date > today;

  const [sources, money] = await Promise.all([loadSources(supabase, budget), loadMoney(supabase, row, future)]);

  // A period that hasn't ended follows its sources (5h-1); past ones never change.
  if (!ended) await syncPeriods(supabase, [{ id: row.id, period }], schedule, sources);

  const { data: items, error } = await supabase
    .from("plan_items")
    .select("*")
    .eq("period_id", row.id)
    .is("deleted_at", null)
    .order("created_at")
    .order("id");
  if (error) fail("load the plan", error);

  // Carry-in and what came in, the Dashboard's way. A future period has no
  // transactions and its carry-in isn't known until the one before closes.
  const numbers = future ? null : dashboardNumbers(budget.opening_balance, money.earlier, money.period);
  const receivedIds = future
    ? new Set<string>()
    : receivedSourceIds(money.period, { start: period.start, paySlot: period.paySlot, first_pay_received: row.first_pay_received }, sources.incomeSources, schedule);

  const groupOf = new Map(sources.categoryGroups);
  const rows: PlanRow[] = items!.map((item) => {
    const group = ((item.category_id ? groupOf.get(item.category_id) : item.budget_group) ?? null) as BudgetGroup | null;
    // The generated types say `string` for origin; its check constraint allows only these.
    const shaped = { ...item, origin: item.origin as PlanOrigin, group };
    const section = planSection(shaped);
    if (section === "income") {
      const received = item.income_source_id != null && receivedIds.has(item.income_source_id);
      return { ...item, section, group, received, detail: incomeStatus(received, period.start, today).text };
    }
    const detail = planItemDetail(shaped, {
      period,
      schedule,
      bill: sources.bills.find((b) => b.id === item.bill_id),
      pot: sources.pots.find((p) => p.id === item.pot_id),
      debt: sources.debts.find((d) => d.id === item.debt_id),
    });
    return { ...item, section, group, received: false, detail };
  });

  const income = periodIncome({
    received: numbers?.income ?? 0,
    items: rows.filter((r) => r.section === "income"),
    receivedIds,
    ended,
  });
  const carriedIn = numbers?.carryIn ?? null;
  const pay = rows.filter((r) => r.section === "income").reduce((sum, r) => sum + r.planned_amount, 0);
  const summary = planSummary({
    items: rows.map((r) => ({ ...r, origin: r.origin as PlanOrigin })),
    income,
    carriedIn: carriedIn ?? 0,
    targets: budget,
  });

  return {
    period: row,
    periods,
    currentStart,
    items: rows,
    income,
    carriedIn,
    previous: getPeriod(dayBefore(period.start), schedule),
    summary,
    // No period before it existed when this one opened, or this is the oldest.
    isFirst: first == null || row.start_date <= first.start_date,
    future,
    ended,
    moneyOut: numbers?.moneyOut ?? null,
    starter: starterPlan(pay, budget),
    pay,
    debts: sources.debts
      .map((d) => ({ id: d.id, name: d.name, left: debtLeft(d), flexible: d.payment_type === "flexible" }))
      .filter((d) => d.left > 0),
  };
}

/**
 * Brings every open period (not ended) of the budget in line with its
 * sources: called after saving a bill, pot, income source, debt or category
 * budget (week-5-tasks.md 5h). Periods that don't exist yet get their items
 * when first opened. A failure is logged, not thrown: the save itself
 * worked, and the period catches up the next time it opens.
 */
export async function syncOpenPeriods(supabase: Client, budget: Budget, today: string): Promise<void> {
  try {
    const { data: rows, error } = await supabase
      .from("budget_periods")
      .select("id, start_date, end_date, pay_slot")
      .eq("budget_id", budget.id)
      .gte("end_date", today);
    if (error) fail("load open periods", error);
    if (!rows?.length) return;
    const sources = await loadSources(supabase, budget);
    const periods = rows.map((r) => ({
      id: r.id,
      // The column's check constraint allows only the three pay slots.
      period: { start: r.start_date, end: r.end_date, paySlot: r.pay_slot as PaySlot },
    }));
    await syncPeriods(supabase, periods, scheduleFromBudget(budget), sources);
  } catch (error) {
    console.error("plan: couldn't sync open periods", error);
  }
}

/**
 * Applies planSync() to each period: new items through add_plan_items()
 * (skips any another tab just added), then the updates and removals. Each
 * write also checks the item is still unedited and unpaid, so a hand edit
 * made meanwhile is never overwritten.
 */
async function syncPeriods(
  supabase: Client,
  periods: { id: string; period: Period }[],
  schedule: ReturnType<typeof scheduleFromBudget>,
  sources: Awaited<ReturnType<typeof loadSources>>,
): Promise<void> {
  const { data: existing, error } = await supabase
    .from("plan_items")
    .select("id, period_id, origin, name, category_id, planned_amount, edited, paid_at, deleted_at, income_source_id, bill_id, pot_id, debt_id")
    .in(
      "period_id",
      periods.map((p) => p.id),
    );
  if (error) fail("load the plans to sync", error);

  const now = new Date().toISOString();
  for (const { id, period } of periods) {
    // The generated types say `string` for origin; its check constraint allows only these.
    const rows = existing!.filter((r) => r.period_id === id) as SyncRow[];
    const changes = planSync(generatePlan(period, schedule, sources), rows);

    if (changes.insert.length > 0) {
      const { error: insertError } = await supabase.rpc("add_plan_items", { target_period: id, items: changes.insert });
      if (insertError) fail("add the plan's items", insertError);
    }
    for (const u of changes.update) {
      const { error: updateError } = await supabase
        .from("plan_items")
        .update({ name: u.name, planned_amount: u.planned_amount, ...(u.revive ? { deleted_at: null } : {}) })
        .eq("id", u.id)
        .eq("edited", false)
        .is("paid_at", null);
      if (updateError) fail("update the plan's items", updateError);
    }
    if (changes.remove.length > 0) {
      const { error: removeError } = await supabase
        .from("plan_items")
        .update({ deleted_at: now })
        .in("id", changes.remove)
        .eq("edited", false)
        .is("paid_at", null)
        .is("deleted_at", null);
      if (removeError) fail("take out the plan's items", removeError);
    }
  }
}

/** Everything generatePlan() and the detail lines are made from. */
async function loadSources(supabase: Client, budget: Budget) {
  const [sources, bills, pots, debts, payments, categories] = await Promise.all([
    supabase.from("income_sources").select("id, name, amount, pay_slot, start_date, end_date").eq("budget_id", budget.id),
    supabase
      .from("recurring_bills")
      .select("id, name, amount, category_id, frequency, due_day, first_due_month, pay_slot")
      .eq("budget_id", budget.id),
    supabase.from("savings_pots").select("id, name, pay_slot, planned_contribution"),
    supabase
      .from("debts")
      .select("id, name, total_amount, payment_type, num_payments, payment_amount, first_due_date, paid_off_at")
      .order("created_at"),
    // Every live debt payment, for what's been paid (never stored).
    supabase
      .from("transactions")
      .select("debt_id, amount, deleted_at")
      .eq("type", "debt_payment")
      .not("debt_id", "is", null)
      .is("deleted_at", null),
    supabase.from("categories").select("id, name, kind, system_key, default_budget, budget_group"),
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

  return {
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
    /** Each category's group (empty for income), for the sections and the split. */
    categoryGroups: categories.data!.map((c) => [c.id, c.budget_group] as const),
  } satisfies PlanSources & { categoryGroups: unknown };
}

type MoneyRows = Parameters<typeof dashboardNumbers>[1];

/** The period's transactions and every earlier one, for income and carry-in (not needed for future periods). */
async function loadMoney(supabase: Client, row: BudgetPeriod, future: boolean) {
  if (future) return { period: [], earlier: [] };
  const [period, earlier] = await Promise.all([
    supabase
      .from("transactions")
      .select("type, amount, deleted_at, income_source_id")
      .eq("period_id", row.id)
      .is("deleted_at", null),
    supabase.from("transactions").select("type, amount, deleted_at").lt("date", row.start_date).is("deleted_at", null),
  ]);
  for (const result of [period, earlier]) {
    if (result.error) fail("load this period's money", result.error);
  }
  // The generated types say `string` for type; its check constraint allows only the four types.
  return {
    period: period.data as (MoneyRows[number] & { income_source_id: string | null })[],
    earlier: earlier.data as MoneyRows,
  };
}
