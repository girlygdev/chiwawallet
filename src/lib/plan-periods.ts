import type { SupabaseClient } from "@supabase/supabase-js";
import { addDays, format, parseISO } from "date-fns";
import type { BillFrequency } from "@/lib/bills";
import { type BudgetPeriod, getOrCreatePeriod } from "@/lib/budget-periods";
import type { Budget } from "@/lib/current-budget";
import { type DebtTerms, debtLeft, debtPaidFor } from "@/lib/debts";
import { receivedSourceIds } from "@/lib/income";
import { dashboardNumbers } from "@/lib/money";
import { formatPeriodRange, formatShortDate, getPeriod, type Period, type PaySlot, scheduleFromBudget } from "@/lib/periods";
import { potBalance } from "@/lib/pots";
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
  budgetBar,
  carryOver,
  debtAssignCap,
  groupProgress,
  isTickable,
  itemDueOn,
  itemStatus,
  spendingActuals,
  paidOnDate,
  planSummary,
  periodsToClose,
  planSync,
  plannablePeriods,
  potAssignCap,
  resolvePlanStart,
  starterPlan,
} from "@/lib/plan";
import type { Database, Tables } from "@/lib/supabase/types";
import { type BudgetGroup, cashOnHand } from "@/lib/transactions";

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
  /** Bills, debt payments, savings and one-offs get a tick button (6b-1). */
  tickable: boolean;
  /** Paid: the payment's date ("Paid Nov 15"); empty while due. */
  paidOn: string | null;
  /** A bill whose amount changes: Mark paid asks for the real amount. */
  varies: boolean;
  /** When it's due this period (itemDueOn()); empty for pots and budgets. */
  dueOn: string | null;
  /**
   * What actually happened (6e): the payment for a ticked item (0 until
   * paid), what's been spent for a budget or starter line. Empty for income
   * and in future periods, which show planned amounts only.
   */
  actual: number | null;
  /** Spending budgets and starter lines: the bar (budgetBar()); empty in future periods. */
  bar: ReturnType<typeof budgetBar> | null;
  /** Ticked items: Paid, Late, Due or Planned (itemStatus()). */
  status: ReturnType<typeof itemStatus> | null;
};

export type OpenedPlan = {
  /** The period shown, created if it didn't exist yet. */
  period: BudgetPeriod;
  /** Each group's "₱1,700 of ₱2,700 paid" (or spent) (6e); empty in future periods. */
  progress: Partial<Record<PlanSection, { actual: number; planned: number }>> | null;
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
  /**
   * The date Mark paid uses here (6b-1): today, or the last day of an earlier
   * period that hasn't closed; empty for a future or closed period.
   */
  payOn: string | null;
  /** Plan a debt payment's choices (5g-2): debts not paid off, with what's left, oldest first. */
  debts: PlanDebt[];
};

export type PlanDebt = { id: string; name: string; left: number; flexible: boolean };

type Client = SupabaseClient<Database>;

const fail = (what: string, error: { message: string }): never => {
  throw new Error(`Couldn't ${what}: ${error.message}`, { cause: error });
};

const dayAfter = (date: string) => format(addDays(parseISO(date), 1), "yyyy-MM-dd");
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

  // Each paid item's payment, for "Paid Nov 15" (the payment's own date).
  const paidIds = items!.filter((i) => i.paid_at != null).map((i) => i.id);
  const { data: payments, error: paymentsError } = paidIds.length
    ? await supabase.from("transactions").select("plan_item_id, date, amount").in("plan_item_id", paidIds).is("deleted_at", null)
    : { data: [], error: null };
  if (paymentsError) fail("load this period's payments", paymentsError);
  const paidOnOf = new Map(payments!.map((p) => [p.plan_item_id, p.date]));
  const paidAmountOf = new Map(payments!.map((p) => [p.plan_item_id, p.amount]));

  const groupOf = new Map(sources.categoryGroups);
  // What's been spent against each budget and starter line (6e).
  const spent = spendingActuals(
    // Spending budgets and starter lines: recurring or starter, with no source.
    items!
      .filter(
        (i) =>
          (i.origin === "recurring" || i.origin === "starter") &&
          !i.income_source_id &&
          !i.bill_id &&
          !i.pot_id &&
          !i.debt_id,
      )
      .map((i) => ({
        id: i.id,
        origin: i.origin as PlanOrigin,
        category_id: i.category_id,
        budget_group: i.budget_group as BudgetGroup | null,
      })),
    money.period
      .filter((t) => t.type === "expense")
      .map((t) => ({ category_id: t.category_id, amount: t.amount, plan_item_id: t.plan_item_id })),
    Object.fromEntries(sources.categoryGroups),
  );
  const rows: PlanRow[] = items!.map((item) => {
    const group = ((item.category_id ? groupOf.get(item.category_id) : item.budget_group) ?? null) as BudgetGroup | null;
    // The generated types say `string` for origin; its check constraint allows only these.
    const shaped = { ...item, origin: item.origin as PlanOrigin, group };
    const section = planSection(shaped);
    if (section === "income") {
      const received = item.income_source_id != null && receivedIds.has(item.income_source_id);
      return {
        ...item,
        section,
        group,
        received,
        detail: incomeStatus(received, period.start, today).text,
        tickable: false,
        paidOn: null,
        varies: false,
        dueOn: null,
        actual: null,
        bar: null,
        status: null,
      };
    }
    const bill = sources.bills.find((b) => b.id === item.bill_id);
    const debt = sources.debts.find((d) => d.id === item.debt_id);
    const detail = planItemDetail(shaped, {
      period,
      schedule,
      bill,
      pot: sources.pots.find((p) => p.id === item.pot_id),
      debt,
    });
    const paidOn = item.paid_at != null ? (paidOnOf.get(item.id) ?? null) : null;
    const tickable = isTickable({ section });
    const dueOn = tickable ? itemDueOn(shaped, { period, schedule, bill, debt }) : null;
    // Ticked items: what was paid. Budgets and starter lines: spent, below.
    const actual = future ? null : tickable ? (item.paid_at != null ? (paidAmountOf.get(item.id) ?? 0) : 0) : (spent[item.id] ?? 0);
    return {
      ...item,
      section,
      group,
      received: false,
      // "Paid Nov 15" replaces the detail line once paid (plan.md §3).
      detail: paidOn ? `Paid ${formatShortDate(paidOn)}` : detail,
      tickable,
      paidOn,
      varies: bill?.amount_varies ?? false,
      dueOn,
      actual,
      bar: actual != null && !tickable ? budgetBar(item.planned_amount, actual) : null,
      status: tickable ? itemStatus({ paid_at: item.paid_at, paidOn, dueOn }, today) : null,
    };
  });

  // "₱1,700 of ₱2,700 paid" per group (6e); none for future periods.
  const progress = future
    ? null
    : Object.fromEntries(
        (["bills", "debts", "savings", "spending", "one_off"] as const).map((key) => [
          key,
          groupProgress(rows.filter((r) => r.section === key).map((r) => ({ planned_amount: r.planned_amount, actual: r.actual ?? 0 }))),
        ]),
      );

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
    payOn: row.closed_at != null ? null : paidOnDate(today, period),
    progress,
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

/** A current-period item as Bills, Savings and Debts use it (5h-3, 6b-2). */
export type CurrentItem = {
  id: string;
  name: string;
  planned_amount: number;
  bill_id: string | null;
  pot_id: string | null;
  debt_id: string | null;
  paid_at: string | null;
  /** Paid: the payment's date and actual amount. */
  paidOn: string | null;
  paidAmount: number | null;
  /** Its Plan section, and whether it's ticked off (bills, savings, debts, one-offs; 6c). */
  section: PlanSection;
  tickable: boolean;
  /** When it's due this period (itemDueOn()); empty for pots. */
  dueOn: string | null;
  /** A bill whose amount changes: Mark paid asks for the amount. */
  varies: boolean;
};

/**
 * The current period's live items, paid ones with their payment (6b-2), for
 * Bills' "still due" and "Paid this period" and Savings' "Due this period" (5h-3). Opens the period the way
 * the Plan does: created if needed and synced, so its items exist and are up
 * to date even if the Plan wasn't opened this payday. A failed sync is
 * logged and the items are read as they are.
 */
export async function openCurrentPlan(
  supabase: Client,
  budget: Budget,
  today: string,
): Promise<{ period: Period; items: CurrentItem[] }> {
  const row = await getOrCreatePeriod(supabase, budget, today);
  const period: Period = { start: row.start_date, end: row.end_date, paySlot: row.pay_slot as PaySlot };
  const schedule = scheduleFromBudget(budget);
  let sources: Awaited<ReturnType<typeof loadSources>> | null = null;
  try {
    sources = await loadSources(supabase, budget);
    await syncPeriods(supabase, [{ id: row.id, period }], schedule, sources);
  } catch (error) {
    console.error("plan: couldn't sync the current period", error);
  }
  const { data, error } = await supabase
    .from("plan_items")
    .select("id, name, planned_amount, bill_id, pot_id, debt_id, income_source_id, category_id, budget_group, origin, needed_by, paid_at")
    .eq("period_id", row.id)
    .is("deleted_at", null)
    .order("created_at");
  if (error) fail("load this period's plan", error);

  const paidIds = data!.filter((i) => i.paid_at != null).map((i) => i.id);
  const { data: payments, error: paymentsError } = paidIds.length
    ? await supabase.from("transactions").select("plan_item_id, date, amount").in("plan_item_id", paidIds).is("deleted_at", null)
    : { data: [], error: null };
  if (paymentsError) fail("load this period's payments", paymentsError);
  const paymentOf = new Map(payments!.map((p) => [p.plan_item_id, p]));
  const groupOf = new Map(sources?.categoryGroups ?? []);
  const items = data!.map((i) => {
    const payment = i.paid_at != null ? paymentOf.get(i.id) : undefined;
    // The generated types say `string`; the check constraints allow only these.
    const origin = i.origin as PlanOrigin;
    const group = ((i.category_id ? groupOf.get(i.category_id) : i.budget_group) ?? null) as BudgetGroup | null;
    const section = planSection({ ...i, origin, group });
    const bill = sources?.bills.find((b) => b.id === i.bill_id);
    const debt = sources?.debts.find((d) => d.id === i.debt_id);
    return {
      ...i,
      paidOn: payment?.date ?? null,
      paidAmount: payment?.amount ?? null,
      section,
      tickable: isTickable({ section }),
      dueOn: itemDueOn({ ...i, origin }, { period, schedule, bill, debt }),
      varies: bill?.amount_varies ?? false,
    };
  });
  return { period, items };
}

/** A place Give leftover a job can send money (6f): a pot or an active debt. */
export type AssignDestination =
  | { key: string; kind: "pot"; id: string; name: string; balance: number; target: number | null; cap: number | null }
  | { key: string; kind: "debt"; id: string; name: string; left: number; cap: number };

/**
 * Give leftover a job's destinations for an opened period (6f): each pot
 * with its balance and cap (its target, less what it has and what's
 * planned for it this period), and each active debt with what's owed and
 * its cap (less its unpaid planned payments in open periods). Plus the
 * next period's dates, for "Carries over to Nov 30 – Dec 14".
 */
export async function loadAssignData(
  supabase: Client,
  budget: Budget,
  plan: OpenedPlan,
  today: string,
): Promise<{ destinations: AssignDestination[]; next: string }> {
  const [pots, savings, periods] = await Promise.all([
    supabase.from("savings_pots").select("id, name, starting_balance, target_amount").order("created_at"),
    supabase.from("transactions").select("pot_id, amount, deleted_at").eq("type", "savings").not("pot_id", "is", null).is("deleted_at", null),
    supabase.from("budget_periods").select("id").eq("budget_id", budget.id).gte("end_date", today),
  ]);
  for (const result of [pots, savings, periods]) {
    if (result.error) fail("load pots and debts", result.error);
  }
  const { data: debtItems, error } = await supabase
    .from("plan_items")
    .select("debt_id, planned_amount")
    .in(
      "period_id",
      periods.data!.map((p) => p.id),
    )
    .not("debt_id", "is", null)
    .is("deleted_at", null)
    .is("paid_at", null);
  if (error) fail("load planned debt payments", error);

  const sum = (rows: { planned_amount: number }[]) => rows.reduce((t, r) => t + r.planned_amount, 0);
  const destinations: AssignDestination[] = [
    ...pots.data!.map((p) => {
      const balance = potBalance(p, savings.data!.filter((r) => r.pot_id === p.id));
      const planned = sum(plan.items.filter((i) => i.pot_id === p.id && i.paid_at == null));
      return {
        key: `pot:${p.id}`,
        kind: "pot" as const,
        id: p.id,
        name: p.name,
        balance,
        target: p.target_amount,
        cap: potAssignCap(p.target_amount, balance, planned),
      };
    }),
    ...plan.debts.map((d) => ({
      key: `debt:${d.id}`,
      kind: "debt" as const,
      id: d.id,
      name: d.name,
      left: d.left,
      cap: debtAssignCap(d.left, sum(debtItems!.filter((i) => i.debt_id === d.id))),
    })),
  ];
  const next = getPeriod(format(addDays(parseISO(plan.period.end_date), 1), "yyyy-MM-dd"), scheduleFromBudget(budget));
  return { destinations, next: formatPeriodRange(next.start, next.end) };
}

/**
 * Closes the periods that have ended (payday-rollover.md §1, 6h-1), on a
 * Dashboard or Plan visit. Each one, oldest first:
 * 1. the next period (created if needed) gets `carried_in`: the leftover,
 *    from carryOver() (a record; carry-in itself is worked out from
 *    transactions, 6g);
 * 2. the period gets `closed_at` and `leftover_choice = "carry"`.
 * With Ask on payday on, the most recent one waits for the payday screen
 * (`awaiting`; 6h-2). Running it again changes nothing: only periods with
 * no `closed_at` are touched. If step 2 fails, the next visit redoes both.
 */
export async function closeEndedPeriods(supabase: Client, budget: Budget, today: string): Promise<{ awaiting: string | null }> {
  const { data: periods, error } = await supabase
    .from("budget_periods")
    .select("id, start_date, end_date, closed_at")
    .eq("budget_id", budget.id);
  if (error) fail("load periods", error);
  const { close, awaiting } = periodsToClose(periods!, today, budget.ask_on_payday);
  if (close.length === 0 && awaiting == null) return { awaiting: null };

  if (close.length > 0) {
    // Every transaction up to the last period being closed, for the leftovers.
    const lastEnd = periods!.filter((p) => close.includes(p.id)).reduce((end, p) => (p.end_date > end ? p.end_date : end), "");
    const { data: rows, error: rowsError } = await supabase
      .from("transactions")
      .select("type, amount, deleted_at, date")
      .lte("date", lastEnd)
      .is("deleted_at", null);
    if (rowsError) fail("load transactions to close periods", rowsError);
    type Row = Parameters<typeof cashOnHand>[1][number] & { date: string };
    // The generated types say `string` for type; its check constraint allows only the four.
    const all = rows as Row[];

    for (const id of close) {
      const period = periods!.find((p) => p.id === id)!;
      const carriedIn = cashOnHand(budget.opening_balance, all.filter((r) => r.date < period.start_date));
      const { leftover } = carryOver(
        carriedIn,
        all.filter((r) => r.date >= period.start_date && r.date <= period.end_date),
      );
      const next = await getOrCreatePeriod(supabase, budget, dayAfter(period.end_date));
      const { error: carryError } = await supabase.from("budget_periods").update({ carried_in: leftover }).eq("id", next.id);
      if (carryError) fail("carry the leftover", carryError);
      const { error: closeError } = await supabase
        .from("budget_periods")
        .update({ closed_at: new Date().toISOString(), leftover_choice: "carry" })
        .eq("id", id)
        .is("closed_at", null);
      if (closeError) fail("close the period", closeError);
    }
  }

  // The waiting period's own carry-in, so its record is right too.
  if (awaiting) {
    const period = periods!.find((p) => p.id === awaiting)!;
    const { data: rows, error: rowsError } = await supabase
      .from("transactions")
      .select("type, amount, deleted_at")
      .lt("date", period.start_date)
      .is("deleted_at", null);
    if (rowsError) fail("load transactions", rowsError);
    const carriedIn = cashOnHand(budget.opening_balance, rows as Parameters<typeof cashOnHand>[1]);
    const { error: carryError } = await supabase.from("budget_periods").update({ carried_in: carriedIn }).eq("id", awaiting);
    if (carryError) fail("record the carry-in", carryError);
  }
  return { awaiting };
}

/**
 * closeEndedPeriods() for a page load: a failure is logged, never shown.
 * The page still works, and the next visit tries again.
 */
export async function closeEndedPeriodsOnVisit(supabase: Client, budget: Budget, today: string): Promise<{ awaiting: string | null }> {
  try {
    return await closeEndedPeriods(supabase, budget, today);
  } catch (error) {
    console.error("plan: couldn't close ended periods", error);
    return { awaiting: null };
  }
}

/**
 * The pot and debt the presets and shortcuts use (owner, Nov 26): the first
 * pot with a target that isn't full, else the first pot; the earliest
 * active debt with room left.
 */
export function assignTargets(destinations: AssignDestination[]): {
  pot: Extract<AssignDestination, { kind: "pot" }> | null;
  debt: Extract<AssignDestination, { kind: "debt" }> | null;
} {
  const pots = destinations.filter((d): d is Extract<AssignDestination, { kind: "pot" }> => d.kind === "pot");
  const debts = destinations.filter((d): d is Extract<AssignDestination, { kind: "debt" }> => d.kind === "debt");
  return {
    pot: pots.find((d) => d.target != null && (d.cap ?? 0) > 0) ?? pots[0] ?? null,
    debt: debts.find((d) => d.cap > 0) ?? null,
  };
}

/**
 * Debts' Mark paid (6b-2): the unpaid scheduled debt items in periods that
 * have started and aren't closed, with their period's start, so
 * debtItemToPay() can find the one that pays a debt's next payment. Opens
 * the current period first (like the Plan), so its items exist.
 */
export async function payableDebtItems(
  supabase: Client,
  budget: Budget,
  today: string,
): Promise<{ id: string; name: string; planned_amount: number; debt_id: string | null; period_start: string }[]> {
  await openCurrentPlan(supabase, budget, today);
  const { data: periods, error } = await supabase
    .from("budget_periods")
    .select("id, start_date")
    .eq("budget_id", budget.id)
    .lte("start_date", today)
    .is("closed_at", null);
  if (error) fail("load open periods", error);
  if (!periods?.length) return [];
  const startOf = new Map(periods.map((p) => [p.id, p.start_date]));
  const { data, error: itemsError } = await supabase
    .from("plan_items")
    .select("id, name, planned_amount, debt_id, period_id")
    .in("period_id", [...startOf.keys()])
    .eq("origin", "recurring")
    .not("debt_id", "is", null)
    .is("deleted_at", null)
    .is("paid_at", null);
  if (itemsError) fail("load debt payments to make", itemsError);
  return data!.map(({ period_id, ...i }) => ({ ...i, period_start: startOf.get(period_id)! }));
}

/**
 * Unpaid items in every period that hasn't ended: what deleting a bill or
 * pot takes out (delete-pattern.md §4, "Planned in N upcoming paydays").
 */
export async function upcomingItems(
  supabase: Client,
  budget: Budget,
  today: string,
): Promise<{ bill_id: string | null; pot_id: string | null }[]> {
  const { data: periods, error } = await supabase
    .from("budget_periods")
    .select("id")
    .eq("budget_id", budget.id)
    .gte("end_date", today);
  if (error) fail("load open periods", error);
  if (!periods?.length) return [];
  const { data, error: itemsError } = await supabase
    .from("plan_items")
    .select("bill_id, pot_id")
    .in(
      "period_id",
      periods.map((p) => p.id),
    )
    .is("deleted_at", null)
    .is("paid_at", null);
  if (itemsError) fail("load upcoming plan items", itemsError);
  return data!;
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
      .select("id, name, amount, amount_varies, category_id, frequency, due_day, first_due_month, pay_slot")
      .eq("budget_id", budget.id),
    supabase.from("savings_pots").select("id, name, pay_slot, planned_contribution"),
    supabase
      .from("debts")
      .select("id, name, total_amount, payment_type, num_payments, payment_amount, first_due_date, paid_off_at")
      .order("created_at"),
    // Every live debt payment, for what's been paid (never stored).
    supabase
      .from("transactions")
      .select("debt_id, amount, deleted_at, category:categories(system_key)")
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
      // Total paid, and the extra payments that shrink the last payments (debts.md §5).
      ...debtPaidFor(payments.data!, d.id),
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
      .select("type, amount, deleted_at, income_source_id, category_id, plan_item_id")
      .eq("period_id", row.id)
      .is("deleted_at", null),
    supabase.from("transactions").select("type, amount, deleted_at").lt("date", row.start_date).is("deleted_at", null),
  ]);
  for (const result of [period, earlier]) {
    if (result.error) fail("load this period's money", result.error);
  }
  // The generated types say `string` for type; its check constraint allows only the four types.
  return {
    period: period.data as (MoneyRows[number] & {
      income_source_id: string | null;
      category_id: string;
      plan_item_id: string | null;
    })[],
    earlier: earlier.data as MoneyRows,
  };
}
