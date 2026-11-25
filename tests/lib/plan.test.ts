import { describe, expect, it } from "vitest";
import type { Period, PaySchedule } from "@/lib/periods";
import {
  generatePlan,
  type PlanSources,
  payingPeriodStart,
  planSection,
  planSummary,
  starterPlan,
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
