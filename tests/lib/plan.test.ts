import { describe, expect, it } from "vitest";
import type { Period, PaySchedule } from "@/lib/periods";
import {
  billDueInPeriod,
  billRowStatus,
  budgetImpact,
  budgetBar,
  budgetLeft,
  categoryBudgets,
  debtItemToPay,
  dueList,
  editImpact,
  generatePlan,
  groupProgress,
  incomeStatus,
  isEmptyPlan,
  isTickable,
  itemDueOn,
  itemStatus,
  missingStarterItems,
  oneOffImpact,
  paidOnDate,
  paidThisPeriod,
  planCounts,
  planDone,
  periodIncome,
  planItemDetail,
  type PlanSources,
  payingPeriodStart,
  planSection,
  planSummary,
  planSync,
  potsDueLine,
  spendingActuals,
  stillDue,
  upcomingCounts,
  upcomingLine,
  plannablePeriods,
  resolvePlanStart,
  removeImpact,
  starterPlan,
  suggestedPeriodStart,
} from "@/lib/plan";

// 5b: generatePlan(), starterPlan() and planSummary() (week-5-tasks.md).

const SEMI: PaySchedule = { frequency: "semi_monthly", payDay1: 15, payDay2: 30 };
const WEEKLY: PaySchedule = { frequency: "weekly", payWeekday: 5 }; // Fridays
const MONTHLY: PaySchedule = { frequency: "monthly", payDay1: 1 };

const P = (start: string, end: string, paySlot: Period["paySlot"] = "payday_1"): Period => ({ start, end, paySlot });
const NOV_15 = P("2026-11-15", "2026-11-29", "payday_1");
const NOV_30 = P("2026-11-30", "2026-12-14", "payday_2");
const DEC_15 = P("2026-12-15", "2026-12-29", "payday_1");

const CATEGORIES = { income: "cat-income", savingsPot: "cat-pot", debtPayment: "cat-debt" };

const none: PlanSources = { categories: CATEGORIES, incomeSources: [], bills: [], pots: [], debts: [], spending: [] };
const sources = (extra: Partial<PlanSources>): PlanSources => ({ ...none, ...extra });

const income = (id: string, pay_slot: string, fields: Partial<PlanSources["incomeSources"][number]> = {}) => ({
  id, name: id, amount: 2_500_000, pay_slot, start_date: "2026-01-01", end_date: null, ...fields,
});
const bill = (id: string, due_day: number, pay_slot: string, fields: Partial<PlanSources["bills"][number]> = {}) => ({
  id, name: id, amount: 250_000, category_id: "cat-bills", frequency: "monthly" as const, due_day, first_due_month: null, pay_slot, ...fields,
});
const pot = (id: string, pay_slot: string, planned_contribution = 300_000) => ({ id, name: id, pay_slot, planned_contribution });
const debt = (id: string, fields: Partial<PlanSources["debts"][number]> = {}) => ({
  id,
  name: id,
  total_amount: 1_200_000,
  payment_type: "installments" as const,
  num_payments: 3,
  payment_amount: 400_000,
  first_due_date: "2026-11-25",
  paid: 0,
  paid_off_at: null,
  ...fields,
});

/** Just the parts a test cares about: "name amount". */
const short = (items: { name: string; planned_amount: number }[]) => items.map((i) => `${i.name} ${i.planned_amount}`);

describe("payingPeriodStart", () => {
  it("is the latest period of the bill's payday that starts on or before the due date", () => {
    expect(payingPeriodStart("2026-11-20", "payday_1", SEMI)).toBe("2026-11-15");
    // Due Dec 10, paid from the 15th: set aside on Nov 15, before it's due.
    expect(payingPeriodStart("2026-12-10", "payday_1", SEMI)).toBe("2026-11-15");
    expect(payingPeriodStart("2026-12-10", "payday_2", SEMI)).toBe("2026-11-30");
    expect(payingPeriodStart("2026-12-01", "payday_2", SEMI)).toBe("2026-11-30");
    // A due date on the payday itself is paid by that payday.
    expect(payingPeriodStart("2026-11-30", "payday_2", SEMI)).toBe("2026-11-30");
  });

  it("is the period containing the due date on one-payday budgets, whatever the slot", () => {
    expect(payingPeriodStart("2026-11-22", "every", WEEKLY)).toBe("2026-11-20");
    expect(payingPeriodStart("2026-11-22", "payday_2", WEEKLY)).toBe("2026-11-20");
    expect(payingPeriodStart("2026-12-20", "every", MONTHLY)).toBe("2026-12-01");
  });
});

describe("generatePlan: a 15th and a 30th period", () => {
  const all = sources({
    incomeSources: [income("Salary", "payday_1"), income("Freelance", "payday_2", { amount: 800_000 }), income("Allowance", "every", { amount: 200_000 })],
    bills: [bill("Meralco", 20, "payday_1"), bill("PLDT", 5, "payday_2", { amount: 169_900 })],
    pots: [pot("Emergency", "payday_1"), pot("Travel", "payday_2", 200_000), pot("Every", "every", 100_000), pot("Empty", "payday_1", 0)],
    spending: [
      { id: "cat-meals", name: "Meals", kind: "expense", system_key: null, default_budget: 600_000 },
      { id: "cat-fun", name: "Fun", kind: "expense", system_key: null, default_budget: null },
      { id: "cat-pot", name: "Savings pot", kind: "expense", system_key: "savings_pot", default_budget: 100_000 },
      { id: "cat-income", name: "Income", kind: "income", system_key: "income", default_budget: 100_000 },
    ],
  });

  it("the 15th gets payday 1 and every-payday items, in plan order", () => {
    expect(short(generatePlan(NOV_15, SEMI, all))).toEqual([
      "Salary 2500000",
      "Allowance 200000",
      "Meralco 250000",
      "Emergency 300000",
      "Every 100000",
      "Meals 600000",
    ]);
  });

  it("the 30th gets payday 2 and every-payday items", () => {
    expect(short(generatePlan(NOV_30, SEMI, all))).toEqual([
      "Freelance 800000",
      "Allowance 200000",
      "PLDT 169900",
      "Travel 200000",
      "Every 100000",
      "Meals 600000",
    ]);
  });

  it("fills in each item's category, link and origin", () => {
    const items = generatePlan(NOV_15, SEMI, all);
    const by = (name: string) => items.find((i) => i.name === name);
    const empty = { income_source_id: null, bill_id: null, pot_id: null, debt_id: null };
    expect(by("Salary")).toEqual({ ...empty, name: "Salary", planned_amount: 2_500_000, origin: "recurring", category_id: "cat-income", income_source_id: "Salary" });
    expect(by("Meralco")).toEqual({ ...empty, name: "Meralco", planned_amount: 250_000, origin: "recurring", category_id: "cat-bills", bill_id: "Meralco" });
    expect(by("Emergency")).toEqual({ ...empty, name: "Emergency", planned_amount: 300_000, origin: "recurring", category_id: "cat-pot", pot_id: "Emergency" });
    expect(by("Meals")).toEqual({ ...empty, name: "Meals", planned_amount: 600_000, origin: "recurring", category_id: "cat-meals" });
  });

  it("is empty with nothing set up", () => {
    expect(generatePlan(NOV_15, SEMI, none)).toEqual([]);
  });
});

describe("generatePlan: bills", () => {
  it("splits a split bill into two halves, the odd centavo on payday 2", () => {
    const s = sources({ bills: [bill("Rent", 5, "split", { amount: 1_500_001 })] });
    expect(short(generatePlan(NOV_15, SEMI, s))).toEqual(["Rent 750000"]);
    expect(short(generatePlan(NOV_30, SEMI, s))).toEqual(["Rent 750001"]);
  });

  it("puts a bill due before its payday in the month before (due Dec 10, paid from the 30th)", () => {
    const s = sources({ bills: [bill("Water", 10, "payday_2")] });
    expect(short(generatePlan(NOV_15, SEMI, s))).toEqual([]);
    expect(short(generatePlan(NOV_30, SEMI, s))).toEqual(["Water 250000"]);
  });

  it("puts a bill due on the 31st on the payday that falls on or before it, also in February", () => {
    const s = sources({ bills: [bill("Card", 31, "payday_2")] });
    expect(short(generatePlan(NOV_30, SEMI, s))).toEqual(["Card 250000"]);
    // Feb has no 30th or 31st: payday 2 and the due date are both Feb 28.
    expect(short(generatePlan(P("2027-02-28", "2027-03-14", "payday_2"), SEMI, s))).toEqual(["Card 250000"]);
    expect(short(generatePlan(P("2027-02-15", "2027-02-27", "payday_1"), SEMI, s))).toEqual([]);
  });

  it("only plans a quarterly bill in the periods that pay one of its due dates", () => {
    const s = sources({ bills: [bill("Insurance", 20, "payday_1", { frequency: "quarterly", first_due_month: 2, amount: 900_000 })] });
    expect(short(generatePlan(NOV_15, SEMI, s))).toEqual(["Insurance 900000"]); // Nov 20
    expect(short(generatePlan(DEC_15, SEMI, s))).toEqual([]);
    expect(short(generatePlan(P("2027-01-15", "2027-01-29"), SEMI, s))).toEqual([]);
    expect(short(generatePlan(P("2027-02-15", "2027-02-27"), SEMI, s))).toEqual(["Insurance 900000"]);
  });

  it("only plans a yearly bill once a year", () => {
    const s = sources({ bills: [bill("Car registration", 31, "payday_2", { frequency: "yearly", first_due_month: 12 })] });
    expect(short(generatePlan(P("2026-12-30", "2027-01-14", "payday_2"), SEMI, s))).toEqual(["Car registration 250000"]);
    expect(short(generatePlan(NOV_30, SEMI, s))).toEqual([]);
  });
});

describe("generatePlan: pots", () => {
  it("a pot that only contributes on the 30th", () => {
    const s = sources({ pots: [pot("Travel", "payday_2", 200_000)] });
    expect(short(generatePlan(NOV_15, SEMI, s))).toEqual([]);
    expect(short(generatePlan(NOV_30, SEMI, s))).toEqual(["Travel 200000"]);
  });
});

describe("generatePlan: income sources", () => {
  it("leaves out a source that has ended or hasn't started on the payday", () => {
    const s = sources({
      incomeSources: [
        income("Old job", "every", { end_date: "2026-11-20" }),
        income("New job", "every", { start_date: "2026-12-01" }),
      ],
    });
    expect(short(generatePlan(NOV_15, SEMI, s))).toEqual(["Old job 2500000"]);
    expect(short(generatePlan(NOV_30, SEMI, s))).toEqual([]);
    expect(short(generatePlan(DEC_15, SEMI, s))).toEqual(["New job 2500000"]);
  });
});

describe("generatePlan: debts", () => {
  it("plans each installment on the payday before its due date", () => {
    const s = sources({ debts: [debt("SPayLater")] }); // Nov 25, Dec 25, Jan 25
    expect(short(generatePlan(NOV_15, SEMI, s))).toEqual(["SPayLater 400000"]);
    expect(short(generatePlan(NOV_30, SEMI, s))).toEqual([]);
    expect(short(generatePlan(DEC_15, SEMI, s))).toEqual(["SPayLater 400000"]);
    expect(generatePlan(DEC_15, SEMI, s)[0]).toMatchObject({ category_id: "cat-debt", debt_id: "SPayLater", origin: "recurring" });
  });

  it("skips what's already paid and plans what's left of a part-paid payment", () => {
    expect(short(generatePlan(NOV_15, SEMI, sources({ debts: [debt("SPayLater", { paid: 400_000 })] })))).toEqual([]);
    expect(short(generatePlan(DEC_15, SEMI, sources({ debts: [debt("SPayLater", { paid: 600_000 })] })))).toEqual(["SPayLater 200000"]);
  });

  it("plans a one-time payment in full", () => {
    const s = sources({ debts: [debt("Loan from Ate", { payment_type: "one_time", num_payments: null, payment_amount: null, first_due_date: "2026-12-05", total_amount: 500_000 })] });
    expect(short(generatePlan(NOV_30, SEMI, s))).toEqual(["Loan from Ate 500000"]);
  });

  it("extra payments shrink the last payment, not the next one (debts.md §5)", () => {
    const s = sources({ debts: [debt("SPayLater", { paid: 200_000, extraPaid: 200_000 })] });
    expect(short(generatePlan(NOV_15, SEMI, s))).toEqual(["SPayLater 400000"]);
    expect(short(generatePlan(DEC_15, SEMI, s))).toEqual(["SPayLater 400000"]);
    expect(short(generatePlan(P("2027-01-15", "2027-01-29"), SEMI, s))).toEqual(["SPayLater 200000"]);
  });

  it("never plans a paid-off or \"When I can\" debt", () => {
    const s = sources({
      debts: [
        debt("Done", { paid_off_at: "2026-11-01T00:00:00Z" }),
        debt("Paid", { paid: 1_200_000 }),
        debt("Flexible", { payment_type: "flexible", num_payments: null, payment_amount: null, first_due_date: null }),
      ],
    });
    expect(generatePlan(NOV_15, SEMI, s)).toEqual([]);
  });
});

describe("generatePlan: weekly and monthly budgets", () => {
  const s = sources({
    incomeSources: [income("Salary", "every", { amount: 600_000 })],
    bills: [bill("Meralco", 22, "every"), bill("Water", 28, "every")],
    pots: [pot("Emergency", "every", 50_000)],
  });

  it("weekly: everything every week, and bills in the week they're due", () => {
    const week = P("2026-11-20", "2026-11-26", "every");
    expect(short(generatePlan(week, WEEKLY, s))).toEqual(["Salary 600000", "Meralco 250000", "Emergency 50000"]);
  });

  it("monthly: every bill once, in the month it's due", () => {
    const month = P("2026-12-01", "2026-12-31", "every");
    expect(short(generatePlan(month, MONTHLY, s))).toEqual(["Salary 600000", "Meralco 250000", "Water 250000", "Emergency 50000"]);
  });
});

describe("starterPlan", () => {
  const targets = { needs_pct: 50, wants_pct: 30, savings_debt_pct: 20 };

  it("splits this payday's income by the budget's percentages", () => {
    expect(starterPlan(2_500_000, targets)).toEqual([
      { name: "Needs", budget_group: "needs", planned_amount: 1_250_000, origin: "starter" },
      { name: "Wants", budget_group: "wants", planned_amount: 750_000, origin: "starter" },
      { name: "Savings & debt", budget_group: "savings_debt", planned_amount: 500_000, origin: "starter" },
    ]);
  });

  it("rounds Needs and Wants down to whole pesos and gives the rest to Savings & debt", () => {
    const items = starterPlan(2_500_050, targets);
    expect(items.map((i) => i.planned_amount)).toEqual([1_250_000, 750_000, 500_050]);
    expect(starterPlan(3_333_333, targets).reduce((sum, i) => sum + i.planned_amount, 0)).toBe(3_333_333);
  });

  it("uses the budget's own percentages and skips a ₱0 group", () => {
    expect(starterPlan(1_000_000, { needs_pct: 70, wants_pct: 30, savings_debt_pct: 0 }).map((i) => i.name)).toEqual(["Needs", "Wants"]);
  });

  it("is empty without income", () => {
    expect(starterPlan(0, targets)).toEqual([]);
  });
});

describe("planSection", () => {
  const item = (fields: Partial<Parameters<typeof planSection>[0]>) => ({
    origin: "one_off" as const, income_source_id: null, bill_id: null, pot_id: null, debt_id: null, group: "wants" as const, ...fields,
  });

  it("puts each item in its section", () => {
    expect(planSection(item({ origin: "recurring", income_source_id: "s", group: null }))).toBe("income");
    expect(planSection(item({ group: null }))).toBe("income"); // income whose source was deleted
    expect(planSection(item({ origin: "recurring", bill_id: "b", group: "needs" }))).toBe("bills");
    expect(planSection(item({ origin: "recurring", debt_id: "d", group: "needs" }))).toBe("debts");
    expect(planSection(item({ debt_id: "d", group: "savings_debt" }))).toBe("debts"); // an extra payment
    expect(planSection(item({ origin: "recurring", pot_id: "p", group: "savings_debt" }))).toBe("savings");
    expect(planSection(item({ origin: "recurring" }))).toBe("spending");
    expect(planSection(item({ origin: "starter", group: "needs" }))).toBe("spending");
    expect(planSection(item({}))).toBe("one_off");
  });
});

describe("planSummary", () => {
  const targets = { needs_pct: 50, wants_pct: 30, savings_debt_pct: 20 };
  const row = (planned_amount: number, fields: Partial<Parameters<typeof planSection>[0]>) => ({
    planned_amount, origin: "recurring" as const, income_source_id: null, bill_id: null, pot_id: null, debt_id: null, group: "needs" as const, ...fields,
  });
  // plan.md §1's example: ₱25,000 pay + ₱5,000 carried in, ₱21,200 planned.
  const items = [
    row(2_500_000, { income_source_id: "s", group: null }),
    row(270_000, { bill_id: "b" }),
    row(400_000, { debt_id: "d" }),
    row(500_000, { pot_id: "p", group: "savings_debt" }),
    row(600_000, {}),
    row(350_000, { group: "wants" }),
    row(250_000, { origin: "one_off", group: "wants" }),
  ];

  it("adds up money for the period, planned and not assigned yet, without the income items", () => {
    const s = planSummary({ items, income: 2_500_000, carriedIn: 500_000, targets });
    expect(s).toMatchObject({ moneyForPeriod: 3_000_000, planned: 2_370_000, notAssigned: 630_000 });
    expect(s.sections).toEqual({ bills: 270_000, debts: 400_000, savings: 500_000, spending: 950_000, one_off: 250_000 });
  });

  it("measures each group's planned share of this payday's income against its target", () => {
    const { split } = planSummary({ items, income: 2_500_000, carriedIn: 500_000, targets });
    expect(split.needs).toEqual({ planned: 1_270_000, share: 0.508, target: 0.5 });
    expect(split.wants).toEqual({ planned: 600_000, share: 0.24, target: 0.3 });
    expect(split.savings_debt).toEqual({ planned: 500_000, share: 0.2, target: 0.2 });
    expect(split.notAssignedShare).toBeCloseTo(0.052);
  });

  it("goes below zero when more is planned than there is, and handles no income", () => {
    const s = planSummary({ items: [row(500_000, {})], income: 0, carriedIn: 0, targets });
    expect(s).toMatchObject({ moneyForPeriod: 0, planned: 500_000, notAssigned: -500_000 });
    expect(s.split.needs.share).toBe(0);
    expect(s.split.notAssignedShare).toBe(0);
  });
});

describe("plannablePeriods (5c)", () => {
  const starts = (periods: Period[]) => periods.map((p) => p.start);

  it("runs from the current period to the last one starting within 3 months", () => {
    // Today Nov 25: up to Feb 25. Feb 15 starts in time; Feb 28 doesn't.
    expect(starts(plannablePeriods("2026-11-25", SEMI, "2026-11-15"))).toEqual([
      "2026-11-15", "2026-11-30", "2026-12-15", "2026-12-30", "2027-01-15", "2027-01-30", "2027-02-15",
    ]);
  });

  it("starts one period back, but never before the first period", () => {
    expect(starts(plannablePeriods("2026-11-25", SEMI, "2026-10-01")).slice(0, 2)).toEqual(["2026-10-30", "2026-11-15"]);
    expect(starts(plannablePeriods("2026-11-25", SEMI, "2026-11-15"))[0]).toBe("2026-11-15");
    // No first period yet: start from the current one.
    expect(starts(plannablePeriods("2026-11-25", SEMI, null))[0]).toBe("2026-11-15");
  });

  it("works for weekly and monthly budgets", () => {
    const weekly = plannablePeriods("2026-11-25", WEEKLY, "2026-01-02");
    expect(weekly[0]).toEqual({ start: "2026-11-13", end: "2026-11-19", paySlot: "every" });
    expect(starts(weekly).at(-1)).toBe("2027-02-19");
    expect(weekly).toHaveLength(15);
    expect(starts(plannablePeriods("2026-11-25", MONTHLY, "2026-01-01"))).toEqual([
      "2026-10-01", "2026-11-01", "2026-12-01", "2027-01-01", "2027-02-01",
    ]);
  });
});

describe("resolvePlanStart (5c)", () => {
  const periods = plannablePeriods("2026-11-25", SEMI, "2026-10-01");

  it("opens the period asked for when it's one of the plannable ones", () => {
    expect(resolvePlanStart("2027-02-15", periods, "2026-11-15")).toBe("2027-02-15");
    expect(resolvePlanStart("2026-10-30", periods, "2026-11-15")).toBe("2026-10-30");
  });

  it("falls back to the current period otherwise", () => {
    for (const asked of [undefined, "", "2026-11-16", "2027-02-28", "2026-10-15", "not-a-date", ["2026-11-30"]]) {
      expect(resolvePlanStart(asked, periods, "2026-11-15")).toBe("2026-11-15");
    }
  });
});

// 5d-1: the Plan screen's income and detail lines (plan.md §1, §3).

describe("periodIncome (5d-1)", () => {
  const items = [
    { income_source_id: "salary", planned_amount: 2_500_000 },
    { income_source_id: "sideline", planned_amount: 500_000 },
  ];

  it("counts what came in, plus what's still expected from sources not paid yet", () => {
    // Salary came in at ₱24,800 (a deduction); the sideline hasn't arrived.
    expect(periodIncome({ received: 2_480_000, items, receivedIds: new Set(["salary"]), ended: false })).toBe(2_980_000);
  });

  it("is the expected income when nothing has come in yet", () => {
    expect(periodIncome({ received: 0, items, receivedIds: new Set(), ended: false })).toBe(3_000_000);
  });

  it("counts one-time income on top of the expected pay", () => {
    expect(periodIncome({ received: 100_000, items, receivedIds: new Set(), ended: false })).toBe(3_100_000);
  });

  it("counts only what came in once the period has ended", () => {
    expect(periodIncome({ received: 2_480_000, items, receivedIds: new Set(["salary"]), ended: true })).toBe(2_480_000);
  });

  it("treats an income item with no source as still expected", () => {
    const loose = [{ income_source_id: null, planned_amount: 200_000 }];
    expect(periodIncome({ received: 0, items: loose, receivedIds: new Set(), ended: false })).toBe(200_000);
  });
});

describe("incomeStatus (5d-1)", () => {
  it("says Received, Expected today, or Expected on the payday", () => {
    expect(incomeStatus(true, "2026-11-15", "2026-11-20")).toEqual({ text: "Received", received: true });
    expect(incomeStatus(false, "2026-11-15", "2026-11-15")).toEqual({ text: "Expected today", received: false });
    expect(incomeStatus(false, "2026-11-30", "2026-11-20")).toEqual({ text: "Expected Nov 30", received: false });
    // Late pay still names the payday.
    expect(incomeStatus(false, "2026-11-15", "2026-11-20")).toEqual({ text: "Expected Nov 15", received: false });
  });
});

describe("planItemDetail (5d-1)", () => {
  const base = { origin: "recurring" as const, income_source_id: null, bill_id: null, pot_id: null, debt_id: null, needed_by: null };
  const ctx = { period: NOV_15, schedule: SEMI };

  it("gives a bill its due date this period pays, even after the period ends", () => {
    const item = { ...base, bill_id: "b", group: "needs" as const };
    expect(planItemDetail(item, { ...ctx, bill: bill("b", 22, "payday_1") })).toBe("Due Nov 22");
    // Due Dec 10, paid from the 15th → set aside on Nov 15.
    expect(planItemDetail(item, { ...ctx, bill: bill("b", 10, "payday_1") })).toBe("Due Dec 10");
  });

  it("says when a bill is split or not monthly", () => {
    const item = { ...base, bill_id: "b", group: "needs" as const };
    expect(planItemDetail(item, { ...ctx, bill: bill("b", 10, "split") })).toBe("Split · half each payday · Due Dec 10");
    const quarterly = bill("b", 20, "payday_1", { frequency: "quarterly", first_due_month: 11 });
    expect(planItemDetail(item, { ...ctx, bill: quarterly })).toBe("Quarterly · Due Nov 20");
    const yearly = bill("b", 20, "payday_1", { frequency: "yearly", first_due_month: 11 });
    expect(planItemDetail(item, { ...ctx, bill: yearly })).toBe("Yearly · Due Nov 20");
  });

  it("falls back to a plain line when the bill isn't due this period any more", () => {
    const item = { ...base, bill_id: "b", group: "needs" as const };
    expect(planItemDetail(item, { ...ctx, bill: bill("b", 5, "payday_2") })).toBe("Recurring bill");
    expect(planItemDetail(item, ctx)).toBe("Recurring bill");
  });

  it("numbers a debt installment and dates a one-time debt", () => {
    const item = { ...base, debt_id: "d", group: "needs" as const };
    // Payments Nov 25, Dec 25, Jan 25: Dec 25 is paid from Dec 15.
    expect(planItemDetail(item, { ...ctx, period: DEC_15, debt: debt("d") })).toBe("Payment 2 of 3 · Due Dec 25");
    const once = debt("d", { payment_type: "one_time", num_payments: null, payment_amount: null, first_due_date: "2026-11-20" });
    expect(planItemDetail(item, { ...ctx, debt: once })).toBe("Due Nov 20");
  });

  it("calls a planned debt or pot item that isn't recurring an extra", () => {
    expect(planItemDetail({ ...base, origin: "one_off", debt_id: "d", group: "savings_debt" }, ctx)).toBe("Extra payment");
    expect(planItemDetail({ ...base, origin: "assigned", pot_id: "p", group: "savings_debt" }, ctx)).toBe("Extra to savings");
  });

  it("says which payday a pot contribution lands on", () => {
    const item = { ...base, pot_id: "p", group: "savings_debt" as const };
    expect(planItemDetail(item, { ...ctx, pot: { pay_slot: "payday_1" } })).toBe("Every 15th");
    expect(planItemDetail(item, { ...ctx, period: NOV_30, pot: { pay_slot: "payday_2" } })).toBe("Every 30th");
    expect(planItemDetail(item, { ...ctx, pot: { pay_slot: "every" } })).toBe("Every payday");
    expect(planItemDetail(item, { period: P("2026-11-20", "2026-11-26", "every"), schedule: WEEKLY, pot: { pay_slot: "every" } })).toBe(
      "Every payday",
    );
  });

  it("gives spending budgets their group and one-offs their Needed by date", () => {
    expect(planItemDetail({ ...base, group: "wants" }, ctx)).toBe("Wants");
    expect(planItemDetail({ ...base, origin: "starter", group: "savings_debt" }, ctx)).toBe("Savings & debt");
    expect(planItemDetail({ ...base, origin: "one_off", group: "wants", needed_by: "2026-12-05" }, ctx)).toBe("Needed by Dec 5");
    expect(planItemDetail({ ...base, origin: "one_off", group: "wants" }, ctx)).toBe("One-off");
  });
});

// 5d-2: the empty plan and the desktop stat cards (plan.md §4, §5).

describe("isEmptyPlan (5d-2)", () => {
  it("is empty when only income is planned, since income is always generated", () => {
    expect(isEmptyPlan([])).toBe(true);
    expect(isEmptyPlan([{ section: "income" }, { section: "income" }])).toBe(true);
    expect(isEmptyPlan([{ section: "income" }, { section: "one_off" }])).toBe(false);
  });
});

describe("planCounts (5d-2)", () => {
  it("counts the items and groups, leaving out income", () => {
    const items = [
      { section: "income" as const },
      { section: "bills" as const },
      { section: "bills" as const },
      { section: "savings" as const },
    ];
    expect(planCounts(items)).toBe("3 items in 2 groups");
    expect(planCounts([{ section: "spending" }])).toBe("1 item in 1 group");
    expect(planCounts([{ section: "income" }])).toBe("Nothing planned yet");
  });
});

describe("planDone (5d-2)", () => {
  it("is money out as a share of what's planned, rounded", () => {
    expect(planDone(945_000, 2_120_000)).toBe("45% of plan done");
    expect(planDone(0, 2_120_000)).toBe("0% of plan done");
    // Spending more than the plan still says so.
    expect(planDone(2_500_000, 2_000_000)).toBe("125% of plan done");
  });

  it("has nothing to compare with when nothing is planned", () => {
    expect(planDone(50_000, 0)).toBe("Nothing planned to compare with");
  });
});

describe("editImpact (5e)", () => {
  const summary = { moneyForPeriod: 3_000_000, notAssigned: 880_000 };
  const meralco = { section: "bills" as const, received: false, planned_amount: 250_000 };

  it("moves Not assigned yet by the change in amount", () => {
    // ₱2,500 → ₱3,000 leaves ₱500 less to assign.
    expect(editImpact(summary, meralco, 300_000)).toEqual({ label: "Not assigned yet", before: 880_000, after: 830_000 });
    expect(editImpact(summary, meralco, 200_000)).toEqual({ label: "Not assigned yet", before: 880_000, after: 930_000 });
  });

  it("can go below ₱0 when too much is planned", () => {
    expect(editImpact(summary, meralco, 1_500_000)?.after).toBe(-370_000);
  });

  it("changes Money for this period for pay that hasn't come in", () => {
    const pay = { section: "income" as const, received: false, planned_amount: 2_500_000 };
    expect(editImpact(summary, pay, 2_000_000)).toEqual({
      label: "Money for this period",
      before: 3_000_000,
      after: 2_500_000,
    });
  });

  it("changes nothing for pay that already came in (what was logged counts)", () => {
    const pay = { section: "income" as const, received: true, planned_amount: 2_500_000 };
    expect(editImpact(summary, pay, 2_000_000)).toBeNull();
  });
});

describe("removeImpact (5e)", () => {
  const summary = { moneyForPeriod: 3_000_000, notAssigned: 880_000 };

  it("frees the item's amount", () => {
    const item = { section: "bills" as const, received: false, planned_amount: 250_000 };
    expect(removeImpact(summary, item)).toEqual({ label: "Not assigned yet", before: 880_000, after: 1_130_000 });
  });

  it("takes expected pay out of Money for this period", () => {
    const pay = { section: "income" as const, received: false, planned_amount: 2_500_000 };
    expect(removeImpact(summary, pay)).toEqual({ label: "Money for this period", before: 3_000_000, after: 500_000 });
  });
});

describe("missingStarterItems (5e)", () => {
  const starter = starterPlan(2_500_000, { needs_pct: 50, wants_pct: 30, savings_debt_pct: 20 });

  it("adds all three to a plan without starter items", () => {
    const items = [{ origin: "recurring" as const, budget_group: null }];
    expect(missingStarterItems(starter, items).map((s) => s.budget_group)).toEqual(["needs", "wants", "savings_debt"]);
  });

  it("skips groups that already have a starter item (a double tap or a second tab)", () => {
    const items = [{ origin: "starter" as const, budget_group: "wants" as const }];
    expect(missingStarterItems(starter, items).map((s) => s.budget_group)).toEqual(["needs", "savings_debt"]);
  });

  it("ignores a one-off or budget in the same group", () => {
    const items = [{ origin: "one_off" as const, budget_group: "needs" as const }];
    expect(missingStarterItems(starter, items)).toHaveLength(3);
  });
});

describe("suggestedPeriodStart (5f)", () => {
  const offered = [NOV_15, NOV_30, DEC_15];

  it("is the last period starting on or before Needed by", () => {
    expect(suggestedPeriodStart("2026-12-05", offered)).toBe("2026-11-30");
    expect(suggestedPeriodStart("2026-12-20", offered)).toBe("2026-12-15");
  });

  it("is the period itself when Needed by is its first day", () => {
    expect(suggestedPeriodStart("2026-11-30", offered)).toBe("2026-11-30");
  });

  it("is the first offered period when Needed by is earlier (already past)", () => {
    expect(suggestedPeriodStart("2026-11-10", offered)).toBe("2026-11-15");
  });

  it("is the last offered period when Needed by is beyond them", () => {
    expect(suggestedPeriodStart("2027-06-01", offered)).toBe("2026-12-15");
  });

  it("is empty when nothing is offered", () => {
    expect(suggestedPeriodStart("2026-12-05", [])).toBeNull();
  });
});

describe("oneOffImpact (5f)", () => {
  it("takes the amount from the period's Not assigned yet", () => {
    expect(oneOffImpact(2_320_000, 250_000)).toEqual({ before: 2_320_000, after: 2_070_000, over: 0 });
  });

  it("says how much more than the period has left", () => {
    expect(oneOffImpact(200_000, 250_000)).toEqual({ before: 200_000, after: -50_000, over: 50_000 });
  });

  it("counts from below ₱0 when the period is already over", () => {
    expect(oneOffImpact(-30_000, 20_000)).toEqual({ before: -30_000, after: -50_000, over: 50_000 });
  });
});

describe("budgetImpact (5g-1)", () => {
  it("takes a new budget from Not assigned yet", () => {
    expect(budgetImpact(880_000, null, 300_000)).toEqual({ before: 880_000, after: 580_000 });
  });

  it("only moves by the change when the category already has a budget", () => {
    // Food ₱2,000 → ₱3,000: ₱1,000 less to assign.
    expect(budgetImpact(880_000, 200_000, 300_000)).toEqual({ before: 880_000, after: 780_000 });
    expect(budgetImpact(880_000, 300_000, 200_000)).toEqual({ before: 880_000, after: 980_000 });
  });

  it("can go below ₱0", () => {
    expect(budgetImpact(100_000, null, 300_000).after).toBe(-200_000);
  });
});

describe("planSync (5h-1)", () => {
  type Existing = Parameters<typeof planSync>[1][number];
  const gen = (fields: Partial<GeneratedItemShape>) => ({
    name: "Meralco",
    category_id: "cat-bills",
    planned_amount: 250_000,
    origin: "recurring" as const,
    income_source_id: null,
    bill_id: null,
    pot_id: null,
    debt_id: null,
    ...fields,
  });
  type GeneratedItemShape = ReturnType<typeof generatePlan>[number];
  const row = (fields: Partial<Existing>): Existing => ({
    id: "row-1",
    origin: "recurring",
    name: "Meralco",
    category_id: "cat-bills",
    planned_amount: 250_000,
    edited: false,
    paid_at: null,
    deleted_at: null,
    income_source_id: null,
    bill_id: null,
    pot_id: null,
    debt_id: null,
    ...fields,
  });
  const meralco = { bill_id: "bill-1" };

  it("does nothing when the plan already matches", () => {
    expect(planSync([gen(meralco)], [row(meralco)])).toEqual({ insert: [], update: [], remove: [] });
  });

  it("updates an unedited item's amount and name", () => {
    expect(planSync([gen({ ...meralco, name: "Meralco (house)", planned_amount: 300_000 })], [row(meralco)]).update).toEqual([
      { id: "row-1", name: "Meralco (house)", planned_amount: 300_000, revive: false },
    ]);
  });

  it("adds an item for a new source", () => {
    const pot = gen({ name: "Travel", category_id: "cat-pot", pot_id: "pot-1", planned_amount: 200_000 });
    expect(planSync([gen(meralco), pot], [row(meralco)]).insert).toEqual([pot]);
  });

  it("takes out an unedited item that no longer belongs (bill moved to the other payday)", () => {
    expect(planSync([], [row(meralco)]).remove).toEqual(["row-1"]);
  });

  it("brings back an item the sync took out, with the new amount", () => {
    const removed = row({ ...meralco, deleted_at: "2026-11-26T00:00:00Z" });
    expect(planSync([gen({ ...meralco, planned_amount: 300_000 })], [removed])).toEqual({
      insert: [],
      update: [{ id: "row-1", name: "Meralco", planned_amount: 300_000, revive: true }],
      remove: [],
    });
  });

  it("never touches edited items, nor brings back ones you removed", () => {
    const edited = row({ ...meralco, edited: true, planned_amount: 280_000 });
    expect(planSync([gen({ ...meralco, planned_amount: 300_000 })], [edited])).toEqual({ insert: [], update: [], remove: [] });
    expect(planSync([], [edited]).remove).toEqual([]);
    const youRemoved = row({ ...meralco, edited: true, deleted_at: "2026-11-26T00:00:00Z" });
    expect(planSync([gen(meralco)], [youRemoved])).toEqual({ insert: [], update: [], remove: [] });
  });

  it("never touches paid items", () => {
    const paid = row({ ...meralco, paid_at: "2026-11-20T00:00:00Z" });
    expect(planSync([gen({ ...meralco, planned_amount: 300_000 })], [paid])).toEqual({ insert: [], update: [], remove: [] });
    expect(planSync([], [paid]).remove).toEqual([]);
  });

  it("ignores one-offs, starter items and extra debt payments", () => {
    const others = [
      row({ id: "a", origin: "one_off", category_id: "cat-gifts" }),
      row({ id: "b", origin: "starter", category_id: null }),
      row({ id: "c", origin: "one_off", debt_id: "debt-1", category_id: "cat-extra" }),
    ];
    expect(planSync([], others)).toEqual({ insert: [], update: [], remove: [] });
    // An extra payment doesn't stand in for the debt's scheduled one.
    const scheduled = gen({ name: "SPayLater", category_id: "cat-debt", debt_id: "debt-1" });
    expect(planSync([scheduled], others).insert).toEqual([scheduled]);
  });

  it("matches spending budgets by category, and leaves a this-period-only budget alone", () => {
    const food = gen({ name: "Food", category_id: "cat-food", planned_amount: 300_000 });
    expect(planSync([food], [row({ name: "Food", category_id: "cat-food", planned_amount: 200_000 })]).update).toHaveLength(1);
    const thisPeriodOnly = row({ name: "Food", category_id: "cat-food", planned_amount: 400_000, edited: true });
    expect(planSync([food], [thisPeriodOnly])).toEqual({ insert: [], update: [], remove: [] });
    // A cleared budget per payday takes out the unedited one.
    expect(planSync([], [row({ name: "Food", category_id: "cat-food" })]).remove).toEqual(["row-1"]);
  });
});

describe("categoryBudgets (5h-2)", () => {
  const categories = [
    { id: "food", default_budget: 300_000 },
    { id: "fun", default_budget: null },
    { id: "gifts", default_budget: 100_000 },
    { id: "pets", default_budget: 200_000 },
  ];
  const budgetItem = (category_id: string, planned_amount: number, deleted_at: string | null = null) => ({
    category_id,
    planned_amount,
    deleted_at,
  });

  it("uses this period's budget item, even one set for this period only", () => {
    const result = categoryBudgets(categories, [budgetItem("food", 400_000)], []);
    expect(result.food.budget).toBe(400_000);
  });

  it("has no budget once you removed it from this period", () => {
    const result = categoryBudgets(categories, [budgetItem("gifts", 100_000, "2026-11-20T00:00:00Z")], []);
    expect(result.gifts.budget).toBeNull();
  });

  it("uses the budget per payday before the period's plan is opened, and nothing without one", () => {
    const result = categoryBudgets(categories, [], []);
    expect(result.pets.budget).toBe(200_000);
    expect(result.fun.budget).toBeNull();
  });

  it("adds up this period's spending per category", () => {
    const expenses = [
      { category_id: "food", amount: 18_000 },
      { category_id: "food", amount: 24_000 },
      { category_id: "fun", amount: 50_000 },
    ];
    const result = categoryBudgets(categories, [], expenses);
    expect(result.food.spent).toBe(42_000);
    expect(result.fun.spent).toBe(50_000);
    expect(result.gifts.spent).toBe(0);
  });
});

describe("budgetLeft (5h-2)", () => {
  it("is what's left after this expense", () => {
    expect(budgetLeft(300_000, 24_000, 18_000)).toEqual({ kind: "left", amount: 258_000 });
    expect(budgetLeft(300_000, 282_000, 18_000)).toEqual({ kind: "left", amount: 0 });
  });

  it("says how much over", () => {
    expect(budgetLeft(300_000, 290_000, 22_000)).toEqual({ kind: "over", amount: 12_000 });
  });

  it("says when there's no budget", () => {
    expect(budgetLeft(null, 24_000, 18_000)).toEqual({ kind: "none" });
  });

  it("takes an edited expense's old amount out of what's spent first", () => {
    // ₱180 already counted in the ₱420 spent, changed to ₱250.
    expect(budgetLeft(300_000, 42_000, 25_000, 18_000)).toEqual({ kind: "left", amount: 251_000 });
  });
});

describe("billDueInPeriod (5h-3)", () => {
  it("is the due date the period pays", () => {
    // Due the 10th, paid from the 30th: Nov 30 pays Dec 10.
    expect(billDueInPeriod(bill("b", 10, "payday_2"), NOV_30, SEMI)).toBe("2026-12-10");
    // Due the 20th, paid from the 15th: Nov 15 pays Nov 20.
    expect(billDueInPeriod(bill("b", 20, "payday_1"), NOV_15, SEMI)).toBe("2026-11-20");
  });

  it("is empty when the period pays none of it", () => {
    expect(billDueInPeriod(bill("b", 20, "payday_1"), NOV_30, SEMI)).toBeNull();
  });

  it("finds a split bill's due date from either half", () => {
    expect(billDueInPeriod(bill("b", 10, "split"), NOV_30, SEMI)).toBe("2026-12-10");
    expect(billDueInPeriod(bill("b", 10, "split"), NOV_15, SEMI)).toBe("2026-12-10");
  });
});

describe("stillDue (5h-3)", () => {
  const bills = [bill("meralco", 20, "payday_1"), bill("netflix", 22, "payday_1")];

  it("adds up this period's unpaid bill items, and names the next one", () => {
    const items = [
      { bill_id: "netflix", name: "Netflix", planned_amount: 54_900 },
      { bill_id: "meralco", name: "Meralco", planned_amount: 250_000 },
    ];
    expect(stillDue(items, bills, NOV_15, SEMI)).toEqual({
      total: 304_900,
      next: { name: "Meralco", date: "2026-11-20" },
    });
  });

  it("is ₱0 with nothing next when every bill item is paid (or none is planned)", () => {
    expect(stillDue([], bills, NOV_15, SEMI)).toEqual({ total: 0, next: null });
  });
});

describe("potsDueLine (5h-3)", () => {
  const pot = (name: string, planned_amount: number) => ({ name, planned_amount });

  it("names the pots due this period", () => {
    expect(potsDueLine([pot("Travel", 200_000)])).toBe("Due this period: ₱2,000 to Travel");
    expect(potsDueLine([pot("Travel", 200_000), pot("Emergency Fund", 300_000)])).toBe(
      "Due this period: ₱2,000 to Travel and ₱3,000 to Emergency Fund",
    );
  });

  it("names two, then says how many more", () => {
    const four = [pot("Travel", 200_000), pot("Emergency Fund", 300_000), pot("Laptop", 100_000), pot("Gifts", 50_000)];
    expect(potsDueLine(four)).toBe("Due this period: ₱2,000 to Travel, ₱3,000 to Emergency Fund and 2 more");
  });

  it("is empty when nothing is due", () => {
    expect(potsDueLine([])).toBeNull();
  });
});

describe("upcomingCounts and upcomingLine (5h-3)", () => {
  it("counts each source's items", () => {
    expect(upcomingCounts(["meralco", "meralco", "netflix", null, "meralco"])).toEqual({ meralco: 3, netflix: 1 });
  });

  it("says how many upcoming paydays", () => {
    expect(upcomingLine(3)).toBe("Planned in 3 upcoming paydays. Those plan items are removed; paid ones stay.");
    expect(upcomingLine(1)).toBe("Planned in 1 upcoming payday. That plan item is removed; paid ones stay.");
    expect(upcomingLine(0)).toBeNull();
  });
});

describe("paidOnDate (6b-1)", () => {
  it("is today in the current period", () => {
    expect(paidOnDate("2026-11-26", NOV_15)).toBe("2026-11-26");
    expect(paidOnDate("2026-11-15", NOV_15)).toBe("2026-11-15");
  });

  it("is the period's last day for an earlier period that hasn't closed", () => {
    expect(paidOnDate("2026-12-02", NOV_15)).toBe("2026-11-29");
  });

  it("is empty for a future period: that money hasn't come in yet", () => {
    expect(paidOnDate("2026-11-26", NOV_30)).toBeNull();
  });
});

describe("isTickable (6b-1)", () => {
  it("is bills, debt payments, savings and one-offs", () => {
    for (const section of ["bills", "debts", "savings", "one_off"] as const) {
      expect(isTickable({ section })).toBe(true);
    }
  });

  it("isn't income (I got paid), spending budgets or starter lines (measured by spending)", () => {
    for (const section of ["income", "spending"] as const) {
      expect(isTickable({ section })).toBe(false);
    }
  });
});

describe("paidThisPeriod (6b-2)", () => {
  it("adds up what was actually paid for this period's bills", () => {
    const items = [
      { bill_id: "meralco", paid_at: "2026-11-20T00:00:00Z", paidAmount: 262_000 },
      { bill_id: "netflix", paid_at: null, paidAmount: null },
      // A pot isn't a bill.
      { bill_id: null, paid_at: "2026-11-15T00:00:00Z", paidAmount: 200_000 },
    ];
    expect(paidThisPeriod(items)).toBe(262_000);
    expect(paidThisPeriod([])).toBe(0);
  });
});

describe("billRowStatus (6b-2)", () => {
  const meralco = bill("meralco", 20, "payday_1");

  it("is Paid with the payment's date once this period's item is paid", () => {
    expect(billRowStatus(meralco, NOV_15, { paid_at: "2026-11-20T03:00:00Z", paidOn: "2026-11-20" })).toEqual({
      kind: "paid",
      date: "2026-11-20",
    });
  });

  it("is Due or Next otherwise, as before", () => {
    expect(billRowStatus(meralco, NOV_15, { paid_at: null, paidOn: null })).toEqual({ kind: "due", date: "2026-11-20" });
    expect(billRowStatus(meralco, NOV_15, undefined)).toEqual({ kind: "due", date: "2026-11-20" });
    expect(billRowStatus(meralco, NOV_30, undefined)).toEqual({ kind: "next", date: "2026-12-20" });
  });
});

describe("debtItemToPay (6b-2)", () => {
  const items = [
    { id: "a", debt_id: "spay", period_start: "2026-11-15", planned_amount: 400_000 },
    { id: "b", debt_id: "spay", period_start: "2026-11-30", planned_amount: 400_000 },
    { id: "c", debt_id: "other", period_start: "2026-11-15", planned_amount: 100_000 },
  ];

  it("is the item in the period whose payday pays the next payment", () => {
    // Due Nov 25: the Nov 15 period pays it.
    expect(debtItemToPay("spay", "2026-11-25", SEMI, items)?.id).toBe("a");
    // Due Dec 5: the Nov 30 period.
    expect(debtItemToPay("spay", "2026-12-05", SEMI, items)?.id).toBe("b");
  });

  it("is empty when that period has no payable item (not open, paid, or closed)", () => {
    expect(debtItemToPay("spay", "2026-12-25", SEMI, items)).toBeNull();
    expect(debtItemToPay("spay", null, SEMI, items)).toBeNull();
  });
});

describe("itemDueOn (6c)", () => {
  const none = { bill_id: null, debt_id: null, pot_id: null, needed_by: null, origin: "recurring" as const };

  it("is a bill's due date this period pays", () => {
    const meralco = bill("meralco", 20, "payday_1");
    expect(itemDueOn({ ...none, bill_id: "meralco" }, { period: NOV_15, schedule: SEMI, bill: meralco })).toBe("2026-11-20");
  });

  it("is a scheduled debt payment's due date in this period", () => {
    const debt = { total_amount: 1_200_000, payment_type: "installments" as const, num_payments: 3, payment_amount: 400_000, first_due_date: "2026-11-25" };
    expect(itemDueOn({ ...none, debt_id: "d" }, { period: NOV_15, schedule: SEMI, debt })).toBe("2026-11-25");
    expect(itemDueOn({ ...none, debt_id: "d" }, { period: NOV_30, schedule: SEMI, debt })).toBeNull();
  });

  it("is a one-off's Needed by, and nothing for a pot", () => {
    expect(itemDueOn({ ...none, origin: "one_off", needed_by: "2026-11-28" }, { period: NOV_15, schedule: SEMI })).toBe("2026-11-28");
    expect(itemDueOn({ ...none, pot_id: "p" }, { period: NOV_15, schedule: SEMI })).toBeNull();
  });
});

describe("dueList (6c)", () => {
  const row = (id: string, dueOn: string | null, paidOn: string | null = null) => ({
    id,
    dueOn,
    paid_at: paidOn ? `${paidOn}T00:00:00Z` : null,
    paidOn,
  });

  it("lists unpaid items by due date (undated ones after), then paid ones", () => {
    const items = [row("pot", null), row("debt", "2026-11-25"), row("paid", "2026-11-18", "2026-11-18"), row("bill", "2026-11-22")];
    expect(dueList(items).map((i) => i.id)).toEqual(["bill", "debt", "pot", "paid"]);
  });

  it("shows at most five", () => {
    const items = Array.from({ length: 7 }, (_, n) => row(`b${n}`, `2026-11-2${n}`));
    expect(dueList(items)).toHaveLength(5);
  });
});

describe("spendingActuals (6e)", () => {
  const groupOf = { food: "needs", fun: "wants", rent: "needs", bills: "needs" } as const;
  const items = [
    { id: "food-budget", origin: "recurring" as const, category_id: "food", budget_group: null },
    { id: "needs-line", origin: "starter" as const, category_id: null, budget_group: "needs" as const },
    { id: "wants-line", origin: "starter" as const, category_id: null, budget_group: "wants" as const },
  ];
  const expenses = [
    { category_id: "food", amount: 18_000, plan_item_id: null },
    { category_id: "food", amount: 24_000, plan_item_id: null },
    { category_id: "rent", amount: 500_000, plan_item_id: null },
    { category_id: "fun", amount: 30_000, plan_item_id: null },
    // Paid through a plan item (Mark paid on a bill): counted there, not here.
    { category_id: "bills", amount: 54_900, plan_item_id: "netflix-item" },
  ];

  it("a budget's spent is its category's spending, not plan-item payments", () => {
    expect(spendingActuals(items, expenses, groupOf)["food-budget"]).toBe(42_000);
  });

  it("a starter line's spent is its group's categories without a budget of their own", () => {
    const actuals = spendingActuals(items, expenses, groupOf);
    // Needs: rent only (food has its own budget; the bill was paid through its item).
    expect(actuals["needs-line"]).toBe(500_000);
    expect(actuals["wants-line"]).toBe(30_000);
  });
});

describe("budgetBar (6e)", () => {
  it("is green with what's left under 90%", () => {
    expect(budgetBar(600_000, 324_000)).toEqual({ share: 0.54, tone: "ok", text: "₱2,760 left" });
  });

  it("is gold from 90% to 100%", () => {
    expect(budgetBar(600_000, 588_000)).toMatchObject({ tone: "near", text: "₱120 left" });
    expect(budgetBar(600_000, 600_000)).toMatchObject({ tone: "near", text: "₱0 left", share: 1 });
  });

  it("is red over 100%, says how much over, and the bar stops at full", () => {
    expect(budgetBar(600_000, 634_000)).toEqual({ share: 1, tone: "over", text: "₱340 over" });
  });
});

describe("groupProgress (6e)", () => {
  it("adds up actual of planned", () => {
    expect(groupProgress([{ planned_amount: 170_000, actual: 170_000 }, { planned_amount: 100_000, actual: 0 }])).toEqual({
      actual: 170_000,
      planned: 270_000,
    });
  });
});

describe("itemStatus (6e)", () => {
  const today = "2026-11-26";
  it("is Paid with its date, Late after the due date, Due before it, or Planned without one", () => {
    expect(itemStatus({ paid_at: "x", paidOn: "2026-11-20", dueOn: "2026-11-22" }, today)).toEqual({ kind: "paid", date: "2026-11-20" });
    expect(itemStatus({ paid_at: null, paidOn: null, dueOn: "2026-11-25" }, today)).toEqual({ kind: "late", days: 1 });
    expect(itemStatus({ paid_at: null, paidOn: null, dueOn: "2026-11-28" }, today)).toEqual({ kind: "due", date: "2026-11-28" });
    expect(itemStatus({ paid_at: null, paidOn: null, dueOn: null }, today)).toEqual({ kind: "planned" });
  });
});
