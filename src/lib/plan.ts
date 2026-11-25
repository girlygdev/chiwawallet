import { addDays, addMonths, format, parseISO, subDays } from "date-fns";
import { billDueDates, type BillFrequency, type BillTiming, splitHalves } from "@/lib/bills";
import { type DebtTerms, debtSchedule, paydayFor } from "@/lib/debts";
import { isActiveOn } from "@/lib/income";
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
      // The due date this period pays, by the same rule as generatePlan().
      const due = billDueDates(bill, period.start, shift(period.end, 31)).find((d) =>
        (split ? ["payday_1", "payday_2"] : [bill.pay_slot]).some((slot) => payingPeriodStart(d, slot, schedule) === period.start),
      );
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
