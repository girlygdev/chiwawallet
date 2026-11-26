import { addDays, addMonths, format, parseISO, subDays } from "date-fns";
import { billDueDates, type BillFrequency, type BillTiming, splitHalves } from "@/lib/bills";
import { type DebtTerms, debtSchedule, paydayFor } from "@/lib/debts";
import { isActiveOn } from "@/lib/income";
import { formatPeso } from "@/lib/money";
import { formatShortDate, getPeriod, type PaySchedule, type Period, type PaySlot, paydayLabel } from "@/lib/periods";
import type { BudgetGroup } from "@/lib/transactions";

// Plan math (plan.md §1 and §5, week-5-tasks.md 5b): pure functions, no
// React, no database. Amounts are integer centavos; dates "YYYY-MM-DD".

export type PlanOrigin = "recurring" | "one_off" | "starter" | "assigned";

/** A generated item, shaped like a plan_items row (without period and owner). */
export type GeneratedItem = {
  name: string;
  category_id: string;
  planned_amount: number;
  origin: "recurring";
  income_source_id: string | null;
  bill_id: string | null;
  pot_id: string | null;
  debt_id: string | null;
};

/** What generatePlan() builds from. The caller loads these for the budget. */
export type PlanSources = {
  /** The system categories generated items use (Income, Savings pot, Debt payment). */
  categories: { income: string; savingsPot: string; debtPayment: string };
  incomeSources: { id: string; name: string; amount: number; pay_slot: string; start_date: string; end_date: string | null }[];
  bills: {
    id: string;
    name: string;
    amount: number;
    category_id: string;
    frequency: BillFrequency;
    due_day: number;
    first_due_month: number | null;
    pay_slot: string;
  }[];
  pots: { id: string; name: string; pay_slot: string; planned_contribution: number }[];
  /** `paid`: the debt's payments so far (debtPaid()). */
  debts: (DebtTerms & { id: string; name: string; paid: number; paid_off_at: string | null })[];
  /** The user's categories; only expense ones with a budget per payday become items. */
  spending: { id: string; name: string; kind: string; system_key: string | null; default_budget: number | null }[];
};

const ISO_DATE = "yyyy-MM-dd";
const shift = (date: string, days: number) => format(addDays(parseISO(date), days), ISO_DATE);

/**
 * Which payday pays a bill due on `due` (owner, Nov 25): the latest period of
 * the bill's payday that starts on or before the due date, so the money is
 * set aside before it's due. Due Dec 10, paid from the 15th → Nov 15.
 * On weekly and monthly budgets (one payday), and for `every`, it's simply
 * the period containing the due date, like debts' paydayFor().
 */
export function payingPeriodStart(due: string, slot: string, schedule: PaySchedule): string {
  let period = getPeriod(due, schedule);
  if (schedule.frequency !== "semi_monthly" || (slot !== "payday_1" && slot !== "payday_2")) {
    return period.start;
  }
  // Step back one period at a time (at most once on a twice-a-month budget).
  while (period.paySlot !== slot) {
    period = getPeriod(format(subDays(parseISO(period.start), 1), ISO_DATE), schedule);
  }
  return period.start;
}

// Does a payday pay into this pot or bring this income? "every" lands on
// every payday, and on a one-payday budget every period is "every".
const landsOn = (slot: string, periodSlot: PaySlot) => slot === "every" || periodSlot === "every" || slot === periodSlot;

const item = (fields: Partial<GeneratedItem> & Pick<GeneratedItem, "name" | "category_id" | "planned_amount">): GeneratedItem => ({
  origin: "recurring",
  income_source_id: null,
  bill_id: null,
  pot_id: null,
  debt_id: null,
  ...fields,
});

/** What a bill puts in this period: the sum of its shares of each due date this period pays. */
function billAmount(bill: PlanSources["bills"][number], period: Period, schedule: PaySchedule): number {
  // A bill is paid at most about a month before it's due, so due dates up to
  // a month after the period ends are enough to look at.
  const dues = billDueDates(bill, period.start, shift(period.end, 31));
  const split = bill.pay_slot === "split" && schedule.frequency === "semi_monthly";
  let total = 0;
  for (const due of dues) {
    if (split) {
      // Each half is paid by its own payday (the odd centavo on payday 2).
      const halves = splitHalves(bill.amount);
      for (const slot of ["payday_1", "payday_2"] as const) {
        if (payingPeriodStart(due, slot, schedule) === period.start) total += halves[slot];
      }
    } else if (payingPeriodStart(due, bill.pay_slot, schedule) === period.start) {
      total += bill.amount;
    }
  }
  return total;
}

/** What's still to pay of a debt's payments in this period, after what's been paid. */
function debtAmount(debt: PlanSources["debts"][number], period: Period, schedule: PaySchedule): number {
  if (debt.payment_type === "flexible" || debt.paid_off_at != null || debt.paid >= debt.total_amount) return 0;
  let total = 0;
  let paidUpTo = 0; // the running total of the schedule
  for (const payment of debtSchedule(debt)) {
    const before = paidUpTo;
    paidUpTo += payment.amount;
    // Payments are covered oldest first: what's paid so far fills them in order.
    const left = Math.min(payment.amount, paidUpTo - Math.max(debt.paid, before));
    if (left > 0 && paydayFor(payment.due, schedule) === period.start) total += left;
  }
  return total;
}

/**
 * The recurring items for one period (mvp-brief.md, Week 5), in the Plan
 * screen's order: income, bills, debt payments, savings, spending budgets.
 * - Income sources active on the payday, for that payday.
 * - Bills whose due date this period pays; split bills in two halves.
 * - Installment and one-time debt payments due in this period, less what's
 *   paid; never paid-off or "When I can" debts.
 * - Pot contributions above ₱0 for that payday.
 * - Spending budgets: expense categories with a budget per payday.
 * Items that come to ₱0 are left out.
 */
export function generatePlan(period: Period, schedule: PaySchedule, sources: PlanSources): GeneratedItem[] {
  const { categories } = sources;
  const items: GeneratedItem[] = [];

  for (const s of sources.incomeSources) {
    if (isActiveOn(s, period.start) && landsOn(s.pay_slot, period.paySlot)) {
      items.push(item({ name: s.name, category_id: categories.income, planned_amount: s.amount, income_source_id: s.id }));
    }
  }
  for (const b of sources.bills) {
    const amount = billAmount(b, period, schedule);
    if (amount > 0) items.push(item({ name: b.name, category_id: b.category_id, planned_amount: amount, bill_id: b.id }));
  }
  for (const d of sources.debts) {
    const amount = debtAmount(d, period, schedule);
    if (amount > 0) items.push(item({ name: d.name, category_id: categories.debtPayment, planned_amount: amount, debt_id: d.id }));
  }
  for (const p of sources.pots) {
    if (p.planned_contribution > 0 && landsOn(p.pay_slot, period.paySlot)) {
      items.push(item({ name: p.name, category_id: categories.savingsPot, planned_amount: p.planned_contribution, pot_id: p.id }));
    }
  }
  for (const c of sources.spending) {
    if (c.kind === "expense" && c.system_key == null && c.default_budget != null && c.default_budget > 0) {
      items.push(item({ name: c.name, category_id: c.id, planned_amount: c.default_budget }));
    }
  }
  return items;
}

// ---------------------------------------------------------------------------
// Which periods can be opened (plan.md §2, owner Nov 25)
// ---------------------------------------------------------------------------

/**
 * The periods the Plan can open, oldest first: one before the current one
 * (never before `firstStart`, the budget's first period), the current one,
 * and every period starting within 3 months of today. `firstStart` is empty
 * when no period exists yet.
 */
export function plannablePeriods(today: string, schedule: PaySchedule, firstStart: string | null): Period[] {
  const current = getPeriod(today, schedule);
  const periods: Period[] = [];
  const previous = getPeriod(shift(current.start, -1), schedule);
  if (firstStart != null && previous.start >= firstStart) periods.push(previous);

  const last = format(addMonths(parseISO(today), 3), ISO_DATE);
  // The day after a period ends is the next one's first day.
  for (let period = current; period.start <= last; period = getPeriod(shift(period.end, 1), schedule)) {
    periods.push(period);
  }
  return periods;
}

/**
 * The start of the period to open for `/plan?start=…`: the one asked for if
 * it's plannable, otherwise the current period. `requested` is whatever came
 * in the URL, so it may be missing, repeated or not a date.
 */
export function resolvePlanStart(requested: unknown, periods: Period[], currentStart: string): string {
  return typeof requested === "string" && periods.some((p) => p.start === requested) ? requested : currentStart;
}

// ---------------------------------------------------------------------------
// Starter plan (plan.md §5)
// ---------------------------------------------------------------------------

export type Targets = { needs_pct: number; wants_pct: number; savings_debt_pct: number };

export type StarterItem = { name: string; budget_group: BudgetGroup; planned_amount: number; origin: "starter" };

/**
 * The 50/30/20 starter plan: three items using the budget's percentages of
 * this payday's income (not the carry-in). Needs and Wants are rounded down
 * to whole pesos and Savings & debt gets the rest, so the three always add
 * up to the income (owner, Nov 25). A group that comes to ₱0 is left out.
 */
export function starterPlan(income: number, targets: Targets): StarterItem[] {
  if (income <= 0) return [];
  const wholePesos = (pct: number) => Math.floor((income * pct) / 100 / 100) * 100;
  const needs = wholePesos(targets.needs_pct);
  const wants = wholePesos(targets.wants_pct);
  const items: StarterItem[] = [
    { name: "Needs", budget_group: "needs", planned_amount: needs, origin: "starter" },
    { name: "Wants", budget_group: "wants", planned_amount: wants, origin: "starter" },
    { name: "Savings & debt", budget_group: "savings_debt", planned_amount: income - needs - wants, origin: "starter" },
  ];
  return items.filter((i) => i.planned_amount > 0);
}

// ---------------------------------------------------------------------------
// The Plan screen's numbers (plan.md §1, §4)
// ---------------------------------------------------------------------------

export type PlanSection = "income" | "bills" | "debts" | "savings" | "spending" | "one_off";

/** What decides an item's section. `group` is its category's group, or a starter item's own; empty for income. */
export type SectionItem = {
  origin: PlanOrigin;
  income_source_id: string | null;
  bill_id: string | null;
  pot_id: string | null;
  debt_id: string | null;
  group: BudgetGroup | null;
};

/**
 * Which Plan section an item shows in: MONEY IN, BILLS, DEBT PAYMENTS,
 * SAVINGS, SPENDING BUDGETS or ONE-OFF ITEMS. An item whose bill or pot was
 * deleted has no link any more and becomes a one-off.
 */
export function planSection(item: SectionItem): PlanSection {
  if (item.income_source_id != null || item.group == null) return "income";
  if (item.bill_id != null) return "bills";
  if (item.debt_id != null) return "debts";
  if (item.pot_id != null) return "savings";
  if (item.origin === "recurring" || item.origin === "starter") return "spending";
  return "one_off";
}

type GroupSplit = { planned: number; share: number; target: number };

export type PlanSummary = {
  /** Income (received, or expected if not yet in) + carried in. */
  moneyForPeriod: number;
  /** Every item except income. */
  planned: number;
  /** Money for this period − planned; below 0 when too much is planned. */
  notAssigned: number;
  sections: Record<Exclude<PlanSection, "income">, number>;
  /**
   * "Planned split of income" (plan.md §4): each group's planned amount as a
   * share (0–1) of this payday's income, next to its target. Planned debt
   * payments count as Needs and extra ones as Savings & debt, through their
   * categories.
   */
  split: Record<BudgetGroup, GroupSplit> & { notAssignedShare: number };
};

export function planSummary({
  items,
  income,
  carriedIn,
  targets,
}: {
  items: (SectionItem & { planned_amount: number })[];
  income: number;
  carriedIn: number;
  targets: Targets;
}): PlanSummary {
  const sections = { bills: 0, debts: 0, savings: 0, spending: 0, one_off: 0 };
  const groups = { needs: 0, wants: 0, savings_debt: 0 };
  for (const i of items) {
    const section = planSection(i);
    if (section === "income" || i.group == null) continue;
    sections[section] += i.planned_amount;
    groups[i.group] += i.planned_amount;
  }
  const planned = Object.values(sections).reduce((sum, n) => sum + n, 0);
  const moneyForPeriod = income + carriedIn;
  const share = (n: number) => (income > 0 ? n / income : 0);
  const group = (key: BudgetGroup, pct: number): GroupSplit => ({ planned: groups[key], share: share(groups[key]), target: pct / 100 });

  return {
    moneyForPeriod,
    planned,
    notAssigned: moneyForPeriod - planned,
    sections,
    split: {
      needs: group("needs", targets.needs_pct),
      wants: group("wants", targets.wants_pct),
      savings_debt: group("savings_debt", targets.savings_debt_pct),
      notAssignedShare: share(Math.max(0, income - planned)),
    },
  };
}

// ---------------------------------------------------------------------------
// The Plan screen's rows (plan.md §1 and §3, week-5-tasks.md 5d-1)
// ---------------------------------------------------------------------------

/**
 * This period's income for "Money for this period": what has come in (all
 * income, one-time included) plus the income items whose source hasn't paid
 * yet, at their planned amount ("received, or expected if not yet in").
 * Once the period has ended, only what came in counts.
 */
export function periodIncome({
  received,
  items,
  receivedIds,
  ended,
}: {
  received: number;
  items: { income_source_id: string | null; planned_amount: number }[];
  receivedIds: Set<string>;
  ended: boolean;
}): number {
  if (ended) return received;
  const stillExpected = items
    .filter((i) => i.income_source_id == null || !receivedIds.has(i.income_source_id))
    .reduce((sum, i) => sum + i.planned_amount, 0);
  return received + stillExpected;
}

/** An income row's tag: "Received", "Expected today" or "Expected Nov 30" (the payday). */
export function incomeStatus(received: boolean, payday: string, today: string): { text: string; received: boolean } {
  if (received) return { text: "Received", received };
  return { text: payday === today ? "Expected today" : `Expected ${formatShortDate(payday)}`, received };
}

export type DetailContext = {
  period: Period;
  schedule: PaySchedule;
  /** The item's bill, pot or debt, when it has one. */
  bill?: (BillTiming & { pay_slot: string }) | null;
  pot?: { pay_slot: string } | null;
  debt?: DebtTerms | null;
};

const GROUP_NAMES: Record<BudgetGroup, string> = { needs: "Needs", wants: "Wants", savings_debt: "Savings & debt" };

/**
 * The due date a period pays for a bill, by the same rule as generatePlan()
 * (a split bill: either half). Empty when the period pays none of it.
 */
export function billDueInPeriod(bill: BillTiming & { pay_slot: string }, period: Period, schedule: PaySchedule): string | null {
  const split = bill.pay_slot === "split" && schedule.frequency === "semi_monthly";
  const slots = split ? ["payday_1", "payday_2"] : [bill.pay_slot];
  const due = billDueDates(bill, period.start, shift(period.end, 31)).find((d) =>
    slots.some((slot) => payingPeriodStart(d, slot, schedule) === period.start),
  );
  return due ?? null;
}

/**
 * A tick row's detail line (plan.md §3 "Detail lines"): "Due Dec 10",
 * "Split · half each payday · Due Dec 10", "Payment 2 of 3 · Due Dec 25",
 * "Every 15th", "Needed by Dec 5". Spending budgets get their group.
 */
export function planItemDetail(item: SectionItem & { needed_by: string | null }, ctx: DetailContext): string {
  const { period, schedule } = ctx;
  const recurring = item.origin === "recurring";

  switch (planSection(item)) {
    case "bills": {
      const bill = ctx.bill;
      if (!bill) return "Recurring bill";
      const split = bill.pay_slot === "split" && schedule.frequency === "semi_monthly";
      const due = billDueInPeriod(bill, period, schedule);
      if (!due) return "Recurring bill";
      const prefix = split ? "Split · half each payday · " : bill.frequency === "monthly" ? "" : `${bill.frequency === "quarterly" ? "Quarterly" : "Yearly"} · `;
      return `${prefix}Due ${formatShortDate(due)}`;
    }
    case "debts": {
      if (!recurring) return "Extra payment";
      const schedulePayments = ctx.debt ? debtSchedule(ctx.debt) : [];
      const payment = schedulePayments.find((p) => paydayFor(p.due, schedule) === period.start);
      if (!payment) return "Debt payment";
      const due = `Due ${formatShortDate(payment.due)}`;
      return schedulePayments.length > 1 ? `Payment ${payment.number} of ${schedulePayments.length} · ${due}` : due;
    }
    case "savings": {
      if (!recurring) return "Extra to savings";
      const slot = ctx.pot?.pay_slot;
      if (!slot || slot === "every" || schedule.frequency !== "semi_monthly") return "Every payday";
      return `Every ${paydayLabel(schedule, slot as PaySlot)}`;
    }
    case "spending":
      return GROUP_NAMES[item.group!];
    case "one_off":
      return item.needed_by ? `Needed by ${formatShortDate(item.needed_by)}` : "One-off";
    case "income":
      return "";
  }
}

// ---------------------------------------------------------------------------
// The empty plan and the desktop stat cards (plan.md §4, §5; 5d-2)
// ---------------------------------------------------------------------------

/**
 * Whether to show the empty plan (`PlanEmpty`): nothing planned but income.
 * Income items are generated for every open period, so "no items at all"
 * would almost never happen.
 */
export function isEmptyPlan(items: { section: PlanSection }[]): boolean {
  return items.every((i) => i.section === "income");
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/** The Planned stat card's line: "9 items in 4 groups" (income left out). */
export function planCounts(items: { section: PlanSection }[]): string {
  const planned = items.filter((i) => i.section !== "income");
  if (planned.length === 0) return "Nothing planned yet";
  return `${plural(planned.length, "item")} in ${plural(new Set(planned.map((i) => i.section)).size, "group")}`;
}

/** The Paid or spent card's line: money out so far as a share of what's planned. */
export function planDone(moneyOut: number, planned: number): string {
  if (planned <= 0) return "Nothing planned to compare with";
  return `${Math.round((moneyOut / planned) * 100)}% of plan done`;
}

// ---------------------------------------------------------------------------
// Edit and remove items, and the starter plan button (plan.md §3, §5; 5e)
// ---------------------------------------------------------------------------

/** A before → after line under a form: "Not assigned yet: ₱8,800 → ₱8,300". */
export type ImpactLine = { label: "Not assigned yet" | "Money for this period"; before: number; after: number };

type ImpactItem = { section: PlanSection; received: boolean; planned_amount: number };

/**
 * What changing an item's amount to `amount` does to the summary. Planned
 * items move Not assigned yet. Pay that hasn't come in moves Money for this
 * period instead (it's counted at its planned amount, periodIncome()); pay
 * that came in is counted as logged, so editing it changes nothing (null).
 */
export function editImpact(
  summary: Pick<PlanSummary, "moneyForPeriod" | "notAssigned">,
  item: ImpactItem,
  amount: number,
): ImpactLine | null {
  const change = amount - item.planned_amount;
  if (item.section === "income") {
    if (item.received) return null;
    return { label: "Money for this period", before: summary.moneyForPeriod, after: summary.moneyForPeriod + change };
  }
  return { label: "Not assigned yet", before: summary.notAssigned, after: summary.notAssigned - change };
}

/** What removing an item from the plan does: the same as editing it to ₱0. */
export function removeImpact(summary: Pick<PlanSummary, "moneyForPeriod" | "notAssigned">, item: ImpactItem): ImpactLine | null {
  return editImpact(summary, item, 0);
}

/**
 * The starter items still to add: the groups with no live starter item yet.
 * Makes "Use this starter plan" safe to tap twice or from two tabs (the
 * database's plan_items_starter_key is the last line of defence).
 */
export function missingStarterItems(
  starter: StarterItem[],
  items: { origin: PlanOrigin; budget_group: BudgetGroup | null }[],
): StarterItem[] {
  const have = new Set(items.filter((i) => i.origin === "starter").map((i) => i.budget_group));
  return starter.filter((s) => !have.has(s.budget_group));
}

// ---------------------------------------------------------------------------
// Add one-off item (plan.md §6, 5f)
// ---------------------------------------------------------------------------

/**
 * The payday to suggest for something needed by `neededBy`: the last offered
 * period that starts on or before it ("the payday just before Dec 5"). A
 * date before every period gets the first; one beyond them gets the last.
 * `periods` are oldest first; empty when none is offered.
 */
export function suggestedPeriodStart(neededBy: string, periods: { start: string }[]): string | null {
  if (periods.length === 0) return null;
  const before = periods.filter((p) => p.start <= neededBy);
  return (before.at(-1) ?? periods[0]).start;
}

/**
 * The impact box: the chosen period's Not assigned yet before and after the
 * one-off, and `over`, how much more than the period has left (0 when it fits).
 */
export function oneOffImpact(notAssigned: number, amount: number): { before: number; after: number; over: number } {
  const after = notAssigned - amount;
  return { before: notAssigned, after, over: Math.max(0, -after) };
}

// ---------------------------------------------------------------------------
// Set a budget (plan.md fix #2, 5g-1)
// ---------------------------------------------------------------------------

/**
 * Setting a category's budget in a period to `amount`: Not assigned yet
 * before and after. `current` is the category's budget already in that
 * period (null if none), so only the change counts.
 */
export function budgetImpact(notAssigned: number, current: number | null, amount: number): { before: number; after: number } {
  return { before: notAssigned, after: notAssigned + (current ?? 0) - amount };
}

// ---------------------------------------------------------------------------
// Keeping open periods in sync with their sources (5h-1)
// ---------------------------------------------------------------------------

/** A period's plan item, removed ones included, as planSync() compares it. */
export type SyncRow = {
  id: string;
  origin: PlanOrigin;
  name: string;
  category_id: string | null;
  planned_amount: number;
  edited: boolean;
  paid_at: string | null;
  deleted_at: string | null;
  income_source_id: string | null;
  bill_id: string | null;
  pot_id: string | null;
  debt_id: string | null;
};

export type PlanSyncChanges = {
  /** New sources' items. */
  insert: GeneratedItem[];
  /** New amount or name; `revive` brings back an item the sync took out. */
  update: { id: string; name: string; planned_amount: number; revive: boolean }[];
  /** Items that no longer belong in the period: soft-deleted. */
  remove: string[];
};

/**
 * What generated an item, matching the unique indexes from 5a: its income
 * source, bill, pot or debt, or for a spending budget its category.
 */
function sourceKey(i: Pick<SyncRow, "income_source_id" | "bill_id" | "pot_id" | "debt_id" | "category_id">): string {
  if (i.income_source_id) return `income:${i.income_source_id}`;
  if (i.bill_id) return `bill:${i.bill_id}`;
  if (i.pot_id) return `pot:${i.pot_id}`;
  if (i.debt_id) return `debt:${i.debt_id}`;
  return `budget:${i.category_id}`;
}

/**
 * How to bring one period's generated items in line with `generated`, what
 * generatePlan() makes now (week-5-tasks.md 5h). Only `recurring` items the
 * sync manages change: unpaid and not edited by hand. An unedited removed
 * item was taken out by the sync, so it comes back if it belongs again;
 * one you removed is marked edited (5e) and stays removed. One-offs,
 * starter items and extra debt payments are never touched.
 */
export function planSync(generated: GeneratedItem[], existing: SyncRow[]): PlanSyncChanges {
  const byKey = new Map(existing.filter((r) => r.origin === "recurring").map((r) => [sourceKey(r), r]));
  const managed = (r: SyncRow) => !r.edited && r.paid_at == null;
  const changes: PlanSyncChanges = { insert: [], update: [], remove: [] };
  const wanted = new Set<string>();

  for (const g of generated) {
    const key = sourceKey(g);
    wanted.add(key);
    const row = byKey.get(key);
    if (!row) {
      changes.insert.push(g);
    } else if (managed(row)) {
      const revive = row.deleted_at != null;
      if (revive || row.name !== g.name || row.planned_amount !== g.planned_amount) {
        changes.update.push({ id: row.id, name: g.name, planned_amount: g.planned_amount, revive });
      }
    }
  }
  for (const [key, row] of byKey) {
    if (!wanted.has(key) && row.deleted_at == null && managed(row)) changes.remove.push(row.id);
  }
  return changes;
}

// ---------------------------------------------------------------------------
// The add sheet's "budget left" line (activity.md §3, 5h-2)
// ---------------------------------------------------------------------------

export type CategoryBudget = { budget: number | null; spent: number };

/**
 * Each category's budget and spending in the current period. The budget is
 * the period's spending budget item for the category (a "this period only"
 * one included). Removed from this period: no budget. No item at all: the
 * period's plan hasn't been opened yet, so the budget per payday it will get.
 * `items` are the period's spending budget items, removed ones included;
 * `expenses` its live expenses. Starter lines and one-offs don't count.
 */
export function categoryBudgets(
  categories: { id: string; default_budget: number | null }[],
  items: { category_id: string | null; planned_amount: number; deleted_at: string | null }[],
  expenses: { category_id: string; amount: number }[],
): Record<string, CategoryBudget> {
  const result: Record<string, CategoryBudget> = {};
  for (const c of categories) {
    const item = items.find((i) => i.category_id === c.id);
    const budget = item ? (item.deleted_at == null ? item.planned_amount : null) : (c.default_budget ?? null);
    const spent = expenses.filter((e) => e.category_id === c.id).reduce((sum, e) => sum + e.amount, 0);
    result[c.id] = { budget, spent };
  }
  return result;
}

/**
 * "₱2,580 left after this", "₱120 over", or no budget to compare with.
 * `replaced`: editing an expense already counted in `spent` (its old amount).
 */
export function budgetLeft(
  budget: number | null,
  spent: number,
  amount: number,
  replaced = 0,
): { kind: "left" | "over"; amount: number } | { kind: "none" } {
  if (budget == null) return { kind: "none" };
  const left = budget - (spent - replaced) - amount;
  return left >= 0 ? { kind: "left", amount: left } : { kind: "over", amount: -left };
}

// ---------------------------------------------------------------------------
// Bills and Savings (bills.md §1–3, savings.md §2, delete-pattern.md §4; 5h-3)
// ---------------------------------------------------------------------------

/**
 * "₱1,000 still due this period" and the next bill ("Subscriptions · Nov 22"):
 * the current period's unpaid bill items (the caller passes only those).
 */
export function stillDue(
  items: { bill_id: string | null; name: string; planned_amount: number }[],
  bills: (BillTiming & { id: string; pay_slot: string })[],
  period: Period,
  schedule: PaySchedule,
): { total: number; next: { name: string; date: string } | null } {
  let next: { name: string; date: string } | null = null;
  let total = 0;
  for (const item of items) {
    total += item.planned_amount;
    const bill = bills.find((b) => b.id === item.bill_id);
    const date = bill ? billDueInPeriod(bill, period, schedule) : null;
    if (date && (next == null || date < next.date)) next = { name: item.name, date };
  }
  return { total, next };
}

/**
 * YOUR POTS' reminder (savings.md §2): "Due this period: ₱2,000 to Travel",
 * naming up to two pots, then "and 2 more". Empty when nothing is due.
 */
export function potsDueLine(items: { name: string; planned_amount: number }[]): string | null {
  if (items.length === 0) return null;
  const named = items.slice(0, 2).map((i) => `${formatPeso(i.planned_amount)} to ${i.name}`);
  const more = items.length - named.length;
  const list = more > 0 ? `${named.join(", ")} and ${more} more` : named.join(" and ");
  return `Due this period: ${list}`;
}

/** How many items each bill or pot has (ids, one per item; empty links skipped). */
export function upcomingCounts(ids: (string | null)[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const id of ids) if (id) counts[id] = (counts[id] ?? 0) + 1;
  return counts;
}

/** Delete bill and Delete pot's effect line (delete-pattern.md §4); empty for 0. */
export function upcomingLine(count: number): string | null {
  if (count <= 0) return null;
  return count === 1
    ? "Planned in 1 upcoming payday. That plan item is removed; paid ones stay."
    : `Planned in ${count} upcoming paydays. Those plan items are removed; paid ones stay.`;
}

// ---------------------------------------------------------------------------
// Mark paid (plan.md §3 "Tick row", 6b-1)
// ---------------------------------------------------------------------------

/**
 * The date a payment from the Plan gets: today in the current period, the
 * last day of an earlier period that hasn't closed (never after its end,
 * owner Nov 26), and none for a future period, which can't be paid yet.
 */
export function paidOnDate(today: string, period: { start: string; end: string }): string | null {
  if (today < period.start) return null;
  return today > period.end ? period.end : today;
}

/**
 * Whether an item gets a tick button: bills, debt payments, savings and
 * one-offs. Income has I got paid; spending budgets and starter lines are
 * measured by what's spent. The same rule as mark_plan_item_paid() (6a).
 */
export function isTickable(item: { section: PlanSection }): boolean {
  return item.section !== "income" && item.section !== "spending";
}
