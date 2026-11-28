import type { SupabaseClient } from "@supabase/supabase-js";
import { addDays, format, parseISO } from "date-fns";
import { chargedFor, loadCardCharges } from "@/lib/card-charges";
import type { BillFrequency } from "@/lib/bills";
import { type BudgetPeriod, firstDayOf, getOrCreatePeriod, loadEarlyStarts, periodOf } from "@/lib/budget-periods";
import type { Budget } from "@/lib/current-budget";
import { type DebtTerms, debtLeft, debtLeftAfter, debtPaidFor } from "@/lib/debts";
import { receivedSourceIds } from "@/lib/income";
import { dashboardNumbers } from "@/lib/money";
import {
  actualPeriod,
  formatPeriodRange,
  formatShortDate,
  getPeriod,
  type Period,
  type PaySchedule,
  type PaySlot,
  periodAt,
  scheduleFromBudget,
  todayInManila,
} from "@/lib/periods";
import { potBalance } from "@/lib/pots";
import {
  generatePlan,
  incomeStatus,
  nextPeriodSummary,
  overviewPeriods,
  overviewTotal,
  type PaydayTotals,
  paydayTotals,
  type PlanOrigin,
  type PlanSection,
  type SectionItem,
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
  paydayWins,
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
import { type BudgetGroup, cashOnHand, periodTotals } from "@/lib/transactions";

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
  /** A bill charged to a card (Nov 28): not in Safe to spend while unpaid. */
  on_card: boolean;
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

/**
 * A pot as Plan savings offers it: its balance and, when it has a target,
 * the most that still fits (`cap`, empty for no target).
 */
export type PlanPot = { id: string; name: string; balance: number; target: number | null; cap: number | null };

type Client = SupabaseClient<Database>;

const fail = (what: string, error: { message: string }): never => {
  throw new Error(`Couldn't ${what}: ${error.message}`, { cause: error });
};

const dayAfter = (date: string) => format(addDays(parseISO(date), 1), "yyyy-MM-dd");
const dayBefore = (date: string) => format(addDays(parseISO(date), -1), "yyyy-MM-dd");

/**
 * The period after the one whose payday is `start`, payday to payday. Not
 * from the day after a row's end_date: that day is still the same payday's
 * period when the next one started early (Task D2).
 */
const paydayAfter = (start: string, schedule: PaySchedule) => getPeriod(dayAfter(getPeriod(start, schedule).end), schedule);

/** A period being closed: started_early_on moves its first day (Task D2); missing means none. */
type OldPeriod = { id: string; start_date: string; end_date: string; started_early_on?: string | null };

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

  // Periods that started early (Task D2): one is current from its first day.
  const early = await loadEarlyStarts(supabase, budget.id);
  const periods = plannablePeriods(today, schedule, first?.start_date ?? null, early);
  const currentStart = periodAt(today, schedule, early).start;
  const start = resolvePlanStart(requested, periods, currentStart);

  const row = await getOrCreatePeriod(supabase, budget, start);
  const period = periodOf(row);
  const ended = row.end_date < today;
  // A period that started early has begun, though its payday hasn't come.
  const future = period.firstDay > today;

  const [sources, money] = await Promise.all([loadSources(supabase, budget, today), loadMoney(supabase, row, future)]);

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
        on_card: false,
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
    // A bill on a card (Nov 28): "Due Dec 10 · BPI card".
    const card = billCard(bill, sources.debts);
    const line = paidOn ? `Paid ${formatShortDate(paidOn)}` : detail;
    return {
      ...item,
      section,
      group,
      received: false,
      // "Paid Nov 15" replaces the detail line once paid (plan.md §3).
      detail: card ? `${line} · ${card.name}` : line,
      tickable,
      paidOn,
      // A card's payment varies (8b-4): Mark paid asks how much.
      varies: (bill?.amount_varies ?? false) || debt?.payment_type === "card",
      on_card: card != null,
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
  const isCard = (debtId: string | null) => sources.debts.some((d) => d.id === debtId && d.payment_type === "card");
  const summary = planSummary({
    // Card payments are in Planned but not the 50/30/20 split (8b-4).
    items: rows.map((r) => ({ ...r, origin: r.origin as PlanOrigin, card: isCard(r.debt_id) })),
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
    // Payday to payday, then with its real last day (shorter if this one started early).
    previous: actualPeriod(getPeriod(dayBefore(period.start), schedule), schedule, early),
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
    const sources = await loadSources(supabase, budget, today);
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
  /** A budget's category (7a); empty for starter lines. */
  category_id: string | null;
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
  /** A bill charged to a card (Nov 28): not in Safe to spend while unpaid. */
  on_card: boolean;
  /** Spending budgets and starter lines (7a): spent so far and the bar, as on the Plan (6e). */
  spent: number | null;
  bar: ReturnType<typeof budgetBar> | null;
  /** An unpaid debt payment (7c): what the debt will owe after it, for "₱4,000 left after this". */
  leftAfter: number | null;
};

/** The Dashboard's Next period card (7d-2): the next period and what it holds. */
export type NextPreview = { period: Period; expected: number; names: string[] };

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
  /** withNext: also preview the next period, for the Dashboard (7d-2). */
  options: { withNext?: boolean } = {},
): Promise<{ period: Period; items: CurrentItem[]; next: NextPreview | null }> {
  const row = await getOrCreatePeriod(supabase, budget, today);
  const period: Period = periodOf(row);
  const schedule = scheduleFromBudget(budget);
  let sources: Awaited<ReturnType<typeof loadSources>> | null = null;
  try {
    sources = await loadSources(supabase, budget, today);
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

  // What's been spent against each budget and starter line, as on the Plan (6e).
  const { data: expenses, error: expensesError } = await supabase
    .from("transactions")
    .select("category_id, amount, plan_item_id")
    .eq("period_id", row.id)
    .eq("type", "expense")
    .is("deleted_at", null);
  if (expensesError) fail("load this period's spending", expensesError);
  const spentOf = spendingActuals(
    data!
      .filter((i) => (i.origin === "recurring" || i.origin === "starter") && !i.income_source_id && !i.bill_id && !i.pot_id && !i.debt_id)
      .map((i) => ({ id: i.id, origin: i.origin as PlanOrigin, category_id: i.category_id, budget_group: i.budget_group as BudgetGroup | null })),
    expenses!,
    Object.fromEntries(sources?.categoryGroups ?? []),
  );

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
      varies: (bill?.amount_varies ?? false) || debt?.payment_type === "card",
      on_card: billCard(bill, sources?.debts ?? []) != null,
      spent: section === "spending" ? (spentOf[i.id] ?? 0) : null,
      bar: section === "spending" ? budgetBar(i.planned_amount, spentOf[i.id] ?? 0) : null,
      leftAfter: debt && i.paid_at == null ? debtLeftAfter(debtLeft(debt), i.planned_amount) : null,
    };
  });
  const next = options.withNext ? await previewNextPeriod(supabase, budget, period, sources, groupOf) : null;
  return { period, items, next };
}

/**
 * The period after `current` for the Next period card (7d-2), without
 * opening it. Already open (visited on the Plan): its live items, with any
 * edits and one-offs. Not open yet: what generatePlan() would make today,
 * from the sources already loaded. None if those failed to load.
 */
async function previewNextPeriod(
  supabase: Client,
  budget: Budget,
  current: Period,
  sources: Awaited<ReturnType<typeof loadSources>> | null,
  groupOf: Map<string, string | null>,
): Promise<NextPreview | null> {
  const schedule = scheduleFromBudget(budget);
  const period = paydayAfter(current.start, schedule);
  const { data: row, error } = await supabase
    .from("budget_periods")
    .select("id")
    .eq("budget_id", budget.id)
    .eq("start_date", period.start)
    .maybeSingle();
  if (error) fail("load the next period", error);

  type Row = Omit<SectionItem, "group"> & { name: string; planned_amount: number; category_id: string | null; budget_group: string | null };
  let rows: Row[];
  if (row) {
    const { data, error: itemsError } = await supabase
      .from("plan_items")
      .select("name, planned_amount, origin, income_source_id, bill_id, pot_id, debt_id, category_id, budget_group")
      .eq("period_id", row.id)
      .is("deleted_at", null)
      .order("created_at");
    if (itemsError) fail("load the next period's plan", itemsError);
    // The check constraint allows only the plan origins.
    rows = data!.map((i) => ({ ...i, origin: i.origin as PlanOrigin }));
  } else if (sources) {
    rows = generatePlan(period, schedule, sources).map((i) => ({ ...i, budget_group: null }));
  } else {
    return null;
  }

  const summary = nextPeriodSummary(
    rows.map((i) => ({
      name: i.name,
      planned_amount: i.planned_amount,
      section: planSection({ ...i, group: ((i.category_id ? groupOf.get(i.category_id) : i.budget_group) ?? null) as BudgetGroup | null }),
    })),
  );
  return { period, ...summary };
}

/** A place Give leftover a job can send money (6f): a pot or an active debt. */
export type AssignDestination =
  | { key: string; kind: "pot"; id: string; name: string; balance: number; target: number | null; cap: number | null; locked: boolean }
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
    supabase.from("savings_pots").select("id, name, starting_balance, target_amount, is_locked").order("created_at"),
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
        locked: p.is_locked,
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
  const next = paydayAfter(plan.period.start_date, scheduleFromBudget(budget));
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
export async function closeEndedPeriods(
  supabase: Client,
  budget: Budget,
  today: string,
): Promise<{ awaiting: { id: string; start: string } | null }> {
  const { data: periods, error } = await supabase
    .from("budget_periods")
    .select("id, start_date, end_date, closed_at, started_early_on")
    .eq("budget_id", budget.id);
  if (error) fail("load periods", error);
  const { close, awaiting } = periodsToClose(periods!, today, budget.ask_on_payday);
  for (const id of close) {
    await closePeriod(supabase, budget, periods!.find((p) => p.id === id)!, "carry");
  }
  if (!awaiting) return { awaiting: null };

  // The waiting period's own carry-in, so its record is right too.
  const period = periods!.find((p) => p.id === awaiting)!;
  const { data: rows, error: rowsError } = await supabase
    .from("transactions")
    .select("type, amount, deleted_at, card_id")
    .lt("date", firstDayOf(period))
    .is("deleted_at", null);
  if (rowsError) fail("load transactions", rowsError);
  const carriedIn = cashOnHand(budget.opening_balance, rows as Parameters<typeof cashOnHand>[1]);
  const { error: carryError } = await supabase.from("budget_periods").update({ carried_in: carriedIn }).eq("id", awaiting);
  if (carryError) fail("record the carry-in", carryError);
  return { awaiting: { id: awaiting, start: period.start_date } };
}

/**
 * Closes one period (6h-1, 6h-2): the next period (created if needed)
 * records the leftover as `carried_in`, worked out with carryOver() from
 * every transaction up to the period's end (so a payday choice's deposit or
 * payment, dated its last day, counts); then the period gets `closed_at`
 * and its `leftover_choice`. Only if it isn't closed yet.
 */
export async function closePeriod(
  supabase: Client,
  budget: Budget,
  period: OldPeriod,
  choice: "carry" | "pot" | "debt" | "split",
): Promise<void> {
  const { data: rows, error } = await supabase
    .from("transactions")
    .select("type, amount, deleted_at, card_id, date")
    .lte("date", period.end_date)
    .is("deleted_at", null);
  if (error) fail("load transactions to close the period", error);
  type Row = Parameters<typeof cashOnHand>[1][number] & { date: string };
  // The generated types say `string` for type; its check constraint allows only the four.
  const all = rows as Row[];
  // From the day it began (earlier if it started early, Task D2).
  const firstDay = firstDayOf(period);
  const carriedIn = cashOnHand(budget.opening_balance, all.filter((r) => r.date < firstDay));
  const { leftover } = carryOver(carriedIn, all.filter((r) => r.date >= firstDay));

  // The day after its last day is in the next period, even one that started early.
  const next = await getOrCreatePeriod(supabase, budget, dayAfter(period.end_date));
  const { error: carryError } = await supabase.from("budget_periods").update({ carried_in: leftover }).eq("id", next.id);
  if (carryError) fail("carry the leftover", carryError);
  const { error: closeError } = await supabase
    .from("budget_periods")
    .update({ closed_at: new Date().toISOString(), leftover_choice: choice })
    .eq("id", period.id)
    .is("closed_at", null);
  if (closeError) fail("close the period", closeError);
}

/** What the payday screen shows (payday-rollover.md §2–3, 6h-2). */
export type PaydayData = {
  old: { id: string; start: string; end: string };
  /** The period that just started. */
  current: { start: string; end: string; paySlot: PaySlot };
  /** The old period's money, what it used, and its leftover (carryOver()). */
  review: ReturnType<typeof carryOver>;
  wins: { title: string; detail: string }[];
  /** The new period's expected income, and its plan so far (excluding income). */
  expected: number;
  incomeRows: { name: string; amount: number; detail: string }[];
  planned: number;
  plannedRows: { name: string; detail: string; amount: number }[];
  /** The leftover choices' pot and debt; pots that can cover an overspend. */
  pot: { id: string; name: string; balance: number; target: number | null } | null;
  debt: { id: string; name: string; left: number } | null;
  coverPots: { id: string; name: string; balance: number }[];
};

/**
 * Everything the payday screen needs for the waiting period `old`: how it
 * went (leftover, wins), the pot and debt the choices offer, and the new
 * period's preview (opened like the Plan, so it's generated and synced).
 */
export async function loadPaydayData(
  supabase: Client,
  budget: Budget,
  old: OldPeriod,
  today: string,
): Promise<PaydayData> {
  const [{ data: rows, error }, oldPlan, currentPlan] = await Promise.all([
    supabase
      .from("transactions")
      .select("type, amount, deleted_at, card_id, date, pot_id, pot:savings_pots(name)")
      .lte("date", old.end_date)
      .is("deleted_at", null),
    openPlanPeriod(supabase, budget, old.start_date, today),
    openPlanPeriod(supabase, budget, undefined, today),
  ]);
  if (error) fail("load transactions", error);
  type Row = Parameters<typeof cashOnHand>[1][number] & { date: string; pot_id: string | null; pot: unknown };
  // The generated types say `string` for type; its check constraint allows only the four.
  const all = rows as Row[];
  const oldFirstDay = firstDayOf(old);
  const inOld = all.filter((r) => r.date >= oldFirstDay);
  const review = carryOver(cashOnHand(budget.opening_balance, all.filter((r) => r.date < oldFirstDay)), inOld);

  // The wins: payments made (on time?), spending under plan, savings.
  const ticked = oldPlan.period.start_date === old.start_date ? oldPlan.items.filter((i) => i.tickable) : [];
  const paid = ticked.filter((i) => i.paid_at != null);
  const spending = oldPlan.period.start_date === old.start_date ? oldPlan.items.filter((i) => i.section === "spending") : [];
  const deposits = inOld.filter((r) => r.type === "savings" && r.amount > 0);
  const wins = paydayWins({
    payments: { made: paid.length, total: ticked.length, onTime: paid.every((i) => !i.dueOn || !i.paidOn || i.paidOn <= i.dueOn) },
    spending: {
      planned: spending.reduce((t, i) => t + i.planned_amount, 0),
      spent: spending.reduce((t, i) => t + (i.actual ?? 0), 0),
    },
    saved: {
      amount: periodTotals(inOld).toSavings,
      pots: [...new Set(deposits.map((r) => (r.pot as { name: string } | null)?.name).filter((n): n is string => !!n))],
    },
  });

  const { destinations } = await loadAssignData(supabase, budget, currentPlan, today);
  const { pot, debt } = assignTargets(destinations);
  const incomeRows = currentPlan.items.filter((i) => i.section === "income");
  return {
    old: { id: old.id, start: old.start_date, end: old.end_date },
    current: {
      start: currentPlan.period.start_date,
      end: currentPlan.period.end_date,
      paySlot: currentPlan.period.pay_slot as PaySlot,
    },
    review,
    wins,
    expected: currentPlan.pay,
    incomeRows: incomeRows.map((i) => ({ name: i.name, amount: i.planned_amount, detail: i.detail })),
    planned: currentPlan.summary.planned,
    plannedRows: currentPlan.items
      .filter((i) => i.section !== "income")
      .map((i) => ({ name: i.name, detail: i.detail, amount: i.planned_amount })),
    pot: pot && { id: pot.id, name: pot.name, balance: pot.balance, target: pot.target },
    debt: debt && { id: debt.id, name: debt.name, left: debt.left },
    coverPots: destinations
      .filter((d): d is Extract<AssignDestination, { kind: "pot" }> => d.kind === "pot" && !d.locked && d.balance > 0)
      .map((d) => ({ id: d.id, name: d.name, balance: d.balance })),
  };
}

/**
 * closeEndedPeriods() for a page load: a failure is logged, never shown.
 * The page still works, and the next visit tries again.
 */
export async function closeEndedPeriodsOnVisit(
  supabase: Client,
  budget: Budget,
  today: string,
): Promise<{ awaiting: { id: string; start: string } | null }> {
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

/**
 * Plan savings' choices (owner, Nov 28): every pot, oldest first, with its
 * balance and cap. The cap is potAssignCap(), the same rule as Give leftover
 * a job: the target less the balance and less what's planned for the pot
 * and not yet paid in periods that haven't ended. RLS limits it all to the
 * user's own rows.
 */
export async function loadPlanPots(supabase: Client, budget: Budget, today: string): Promise<PlanPot[]> {
  const [pots, savings, periods] = await Promise.all([
    supabase.from("savings_pots").select("id, name, starting_balance, target_amount").order("created_at"),
    supabase.from("transactions").select("pot_id, amount, deleted_at").eq("type", "savings").not("pot_id", "is", null).is("deleted_at", null),
    supabase.from("budget_periods").select("id").eq("budget_id", budget.id).gte("end_date", today),
  ]);
  for (const result of [pots, savings, periods]) {
    if (result.error) fail("load pots", result.error);
  }
  const { data: planned, error } = await supabase
    .from("plan_items")
    .select("pot_id, planned_amount")
    .in(
      "period_id",
      periods.data!.map((p) => p.id),
    )
    .not("pot_id", "is", null)
    .is("deleted_at", null)
    .is("paid_at", null);
  if (error) fail("load planned savings", error);

  return pots.data!.map((p) => {
    const balance = potBalance(p, savings.data!.filter((r) => r.pot_id === p.id));
    const unpaid = planned!.filter((i) => i.pot_id === p.id).reduce((t, i) => t + i.planned_amount, 0);
    return { id: p.id, name: p.name, balance, target: p.target_amount, cap: potAssignCap(p.target_amount, balance, unpaid) };
  });
}

/**
 * The card a bill is charged to (Nov 28), or nothing for Cash. Closing a
 * card empties its bills' card_id in the database, so a found card is open.
 */
function billCard<D extends { id: string; name: string }>(bill: { card_id?: string | null } | undefined, debts: D[]): D | undefined {
  return bill?.card_id ? debts.find((d) => d.id === bill.card_id) : undefined;
}

/** Everything generatePlan() and the detail lines are made from. */
async function loadSources(supabase: Client, budget: Budget, today: string) {
  const [sources, bills, pots, debts, payments, categories, charges] = await Promise.all([
    supabase.from("income_sources").select("id, name, amount, pay_slot, start_date, end_date").eq("budget_id", budget.id),
    supabase
      .from("recurring_bills")
      .select("id, name, amount, amount_varies, category_id, frequency, due_day, first_due_month, pay_slot, card_id")
      .eq("budget_id", budget.id),
    supabase.from("savings_pots").select("id, name, pay_slot, planned_contribution"),
    supabase
      .from("debts")
      .select("id, name, total_amount, payment_type, num_payments, payment_amount, first_due_date, due_day, pay_slot, paid_off_at, created_at")
      .order("created_at"),
    // Every live debt payment, for what's been paid (never stored).
    supabase
      .from("transactions")
      .select("debt_id, amount, deleted_at, category:categories(system_key)")
      .eq("type", "debt_payment")
      .not("debt_id", "is", null)
      .is("deleted_at", null),
    supabase.from("categories").select("id, name, kind, system_key, default_budget, budget_group"),
    // A card's purchases, for its balance (8b-2).
    loadCardCharges(supabase),
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
      charged: chargedFor(d, charges),
      // A card's due date before it was added is never late (8b-4).
      added_on: todayInManila(new Date(d.created_at)),
    })),
    spending: categories.data!,
    // A card's payment goes on the payday that pays its next due date (8b-4).
    today,
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
      .select("type, amount, deleted_at, card_id, income_source_id, category_id, plan_item_id")
      .eq("period_id", row.id)
      .is("deleted_at", null),
    // Before its first day: earlier than its payday if it started early (Task D2).
    supabase.from("transactions").select("type, amount, deleted_at, card_id").lt("date", firstDayOf(row)).is("deleted_at", null),
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

// ---------------------------------------------------------------------------
// Paydays overview (week-7-tasks.md 7g-1)
// ---------------------------------------------------------------------------

/** One row of the Paydays overview. */
export type OverviewRow = {
  period: Period;
  /** Closed; Open (the period exists, so its own items); Preview (worked out, not opened). */
  status: "closed" | "open" | "preview";
  /** The Plan can open it (plannablePeriods()), so the row links there. */
  plannable: boolean;
  totals: PaydayTotals;
};

/**
 * Each payday from the first period to 6 months ahead. Read only: periods
 * that exist use their live plan items (edits and one-offs included; open
 * ones are kept in step with their sources by the actions that change them);
 * the rest use generatePlan() from today's sources, exactly what opening them
 * would create. Nothing is created.
 */
export async function loadPaydaysOverview(
  supabase: Client,
  budget: Budget,
  today: string,
): Promise<{ rows: OverviewRow[]; total: PaydayTotals }> {
  const schedule = scheduleFromBudget(budget);
  const { data: periodRows, error } = await supabase
    .from("budget_periods")
    .select("id, start_date, closed_at")
    .eq("budget_id", budget.id)
    .order("start_date");
  if (error) fail("load your periods", error);

  const firstStart = periodRows![0]?.start_date ?? null;
  const periods = overviewPeriods(firstStart, today, schedule);
  const plannable = new Set(plannablePeriods(today, schedule, firstStart).map((p) => p.start));
  const rowOf = new Map(periodRows!.map((r) => [r.start_date, r]));
  const ids = periods.flatMap((p) => rowOf.get(p.start)?.id ?? []);

  const [sources, items] = await Promise.all([
    loadSources(supabase, budget, today),
    ids.length
      ? supabase
          .from("plan_items")
          .select("period_id, planned_amount, origin, income_source_id, bill_id, pot_id, debt_id, category_id, budget_group")
          .in("period_id", ids)
          .is("deleted_at", null)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (items.error) fail("load your plans", items.error);

  // Each item's group, as on the Plan: its category's, or a starter line's own.
  const groupOf = new Map(sources.categoryGroups);
  const groupFor = (i: { category_id: string | null; budget_group: string | null }) =>
    ((i.category_id ? groupOf.get(i.category_id) : i.budget_group) ?? null) as BudgetGroup | null;

  const rows = periods.map((period): OverviewRow => {
    const row = rowOf.get(period.start);
    const planItems = row
      ? items.data!.filter((i) => i.period_id === row.id).map((i) => ({ ...i, origin: i.origin as PlanOrigin, group: groupFor(i) }))
      : generatePlan(period, schedule, sources).map((i) => ({ ...i, group: groupFor({ ...i, budget_group: null }) }));
    return {
      period,
      status: row ? (row.closed_at ? "closed" : "open") : "preview",
      plannable: plannable.has(period.start),
      totals: paydayTotals(planItems),
    };
  });
  return { rows, total: overviewTotal(rows.map((r) => r.totals)) };
}
