import { beforeAll, describe, expect, it } from "vitest";
import { anonClient, signUpUser, type TestUser } from "./helpers";

// Postgres error codes the tests expect.
const PERMISSION_DENIED = "42501";
const CHECK_VIOLATION = "23514";
const FOREIGN_KEY_VIOLATION = "23503";
const UNIQUE_VIOLATION = "23505";

const semiMonthly = { name: "Main budget", frequency: "semi_monthly", pay_day_1: 15, pay_day_2: 30 };

async function createBudget(user: TestUser, fields: Record<string, unknown> = {}) {
  const { data, error } = await user.client
    .from("budgets")
    .insert({ ...semiMonthly, ...fields })
    .select()
    .single();
  if (error) throw new Error(`Couldn't create budget: ${error.message}`);
  return data;
}

async function createIncome(user: TestUser, budgetId: string, fields: Record<string, unknown> = {}) {
  const { data, error } = await user.client
    .from("income_sources")
    .insert({
      budget_id: budgetId,
      name: "Salary",
      amount: 2_500_000,
      pay_slot: "payday_1",
      start_date: "2026-11-15",
      ...fields,
    })
    .select()
    .single();
  if (error) throw new Error(`Couldn't create income source: ${error.message}`);
  return data;
}

async function createPeriod(user: TestUser, budgetId: string, fields: Record<string, unknown> = {}) {
  const { data, error } = await user.client
    .from("budget_periods")
    .insert({
      budget_id: budgetId,
      start_date: "2026-11-15",
      end_date: "2026-11-29",
      pay_slot: "payday_1",
      ...fields,
    })
    .select()
    .single();
  if (error) throw new Error(`Couldn't create period: ${error.message}`);
  return data;
}

describe("budgets: owner's own rows", () => {
  it("fills in user_id and the defaults", async () => {
    const user = await signUpUser();
    const budget = await createBudget(user);
    expect(budget).toMatchObject({
      user_id: user.id,
      opening_balance: null,
      carry_over: true,
      ask_on_payday: true,
      budget_model: "50_30_20",
      needs_pct: 50,
      wants_pct: 30,
      savings_debt_pct: 20,
    });
  });

  it.each([
    ["empty", null],
    ["₱0", 0],
    ["negative", -150_000],
  ])("allows an %s opening balance", async (_label, opening_balance) => {
    const user = await signUpUser();
    const budget = await createBudget(user, { opening_balance });
    expect(budget.opening_balance).toBe(opening_balance);
  });

  it("accepts weekly and monthly schedules", async () => {
    const user = await signUpUser();
    await createBudget(user, { frequency: "weekly", pay_day_1: null, pay_day_2: null, pay_weekday: 0 });
    await createBudget(user, { frequency: "monthly", pay_day_1: 31, pay_day_2: null });
  });

  it("lets the owner update and delete their budget", async () => {
    const user = await signUpUser();
    const budget = await createBudget(user);

    const { data: updated } = await user.client
      .from("budgets")
      .update({ name: "Renamed", opening_balance: 500_000 })
      .eq("id", budget.id)
      .select()
      .single();
    expect(updated).toMatchObject({ name: "Renamed", opening_balance: 500_000 });
    expect(updated!.updated_at > budget.updated_at).toBe(true);

    const { error } = await user.client.from("budgets").delete().eq("id", budget.id);
    expect(error).toBeNull();
    const { data: left } = await user.client.from("budgets").select("id");
    expect(left).toEqual([]);
  });

  it("deleting a budget deletes its income sources and periods", async () => {
    const user = await signUpUser();
    const budget = await createBudget(user);
    await createIncome(user, budget.id);
    await createPeriod(user, budget.id);

    await user.client.from("budgets").delete().eq("id", budget.id);

    const { data: income } = await user.client.from("income_sources").select("id");
    const { data: periods } = await user.client.from("budget_periods").select("id");
    expect(income).toEqual([]);
    expect(periods).toEqual([]);
  });
});

describe("budgets: checks reject bad data", () => {
  let user: TestUser;
  beforeAll(async () => {
    user = await signUpUser();
  });

  it.each([
    ["semi-monthly without payday 2", { pay_day_2: null }],
    ["semi-monthly with payday 2 before payday 1", { pay_day_1: 25, pay_day_2: 10 }],
    ["semi-monthly with payday 1 after the 27th", { pay_day_1: 28, pay_day_2: 30 }],
    ["semi-monthly with a weekday", { pay_weekday: 1 }],
    ["monthly with payday 2", { frequency: "monthly", pay_day_1: 15, pay_day_2: 30 }],
    ["monthly with no payday", { frequency: "monthly", pay_day_1: null, pay_day_2: null }],
    ["monthly on the 32nd", { frequency: "monthly", pay_day_1: 32, pay_day_2: null }],
    ["weekly without a weekday", { frequency: "weekly", pay_day_1: null, pay_day_2: null }],
    ["weekly on day 7", { frequency: "weekly", pay_day_1: null, pay_day_2: null, pay_weekday: 7 }],
    ["weekly with a pay day", { frequency: "weekly", pay_day_2: null, pay_weekday: 1 }],
    ["an unknown frequency", { frequency: "biweekly" }],
    ["percentages that don't add up to 100", { needs_pct: 50, wants_pct: 30, savings_debt_pct: 30 }],
    ["an empty name", { name: "   " }],
    ["a name over 40 characters", { name: "a".repeat(41) }],
  ])("rejects %s", async (_label, fields) => {
    const { error } = await user.client.from("budgets").insert({ ...semiMonthly, ...fields });
    expect(error?.code).toBe(CHECK_VIOLATION);
  });
});

describe("income_sources and budget_periods: checks reject bad data", () => {
  let user: TestUser;
  let budgetId: string;
  beforeAll(async () => {
    user = await signUpUser();
    budgetId = (await createBudget(user)).id;
  });

  it.each([
    ["a ₱0 amount", { amount: 0 }],
    ["a negative amount", { amount: -100 }],
    ["an unknown pay slot", { pay_slot: "payday_3" }],
    ["an end date before the start", { start_date: "2026-11-15", end_date: "2026-11-14" }],
  ])("income: rejects %s", async (_label, fields) => {
    const { error } = await user.client.from("income_sources").insert({
      budget_id: budgetId,
      name: "Salary",
      amount: 2_500_000,
      pay_slot: "payday_1",
      start_date: "2026-11-15",
      ...fields,
    });
    expect(error?.code).toBe(CHECK_VIOLATION);
  });

  it("income: keeps an end date for a job that stops", async () => {
    const income = await createIncome(user, budgetId, { end_date: "2026-12-31", amount_varies: true });
    expect(income).toMatchObject({ end_date: "2026-12-31", amount_varies: true, user_id: user.id });
  });

  it("periods: rejects an end date before the start", async () => {
    const { error } = await user.client.from("budget_periods").insert({
      budget_id: budgetId,
      start_date: "2026-11-15",
      end_date: "2026-11-14",
      pay_slot: "payday_1",
    });
    expect(error?.code).toBe(CHECK_VIOLATION);
  });

  it("periods: one per budget and start date", async () => {
    const period = await createPeriod(user, budgetId, { start_date: "2026-12-15", end_date: "2026-12-29" });
    expect(period).toMatchObject({ carried_in: 0, first_pay_received: false, leftover_choice: null });

    const { error } = await user.client.from("budget_periods").insert({
      budget_id: budgetId,
      start_date: "2026-12-15",
      end_date: "2026-12-29",
      pay_slot: "payday_1",
    });
    expect(error?.code).toBe(UNIQUE_VIOLATION);
  });

  it("periods: the owner can record the mid-period answer, but not move the dates", async () => {
    const period = await createPeriod(user, budgetId, { start_date: "2027-01-15", end_date: "2027-01-29" });

    const { data } = await user.client
      .from("budget_periods")
      .update({ first_pay_received: true })
      .eq("id", period.id)
      .select("first_pay_received")
      .single();
    expect(data?.first_pay_received).toBe(true);

    const { error } = await user.client
      .from("budget_periods")
      .update({ start_date: "2027-01-01" })
      .eq("id", period.id);
    expect(error?.code).toBe(PERMISSION_DENIED);
  });
});

describe("RLS: user A can't reach user B's rows", () => {
  let a: TestUser;
  let b: TestUser;
  let bBudget: { id: string };
  let bIncome: { id: string };
  let bPeriod: { id: string };

  beforeAll(async () => {
    [a, b] = await Promise.all([signUpUser(), signUpUser()]);
    bBudget = await createBudget(b);
    bIncome = await createIncome(b, bBudget.id);
    bPeriod = await createPeriod(b, bBudget.id);
  });

  const tables = () =>
    [
      ["budgets", bBudget.id],
      ["income_sources", bIncome.id],
      ["budget_periods", bPeriod.id],
    ] as const;

  it("can't read them", async () => {
    for (const [table, id] of tables()) {
      const { data, error } = await a.client.from(table).select("id").eq("id", id);
      expect(error, table).toBeNull();
      expect(data, table).toEqual([]);
    }
  });

  it("can't change them", async () => {
    // RLS hides the rows, so the update matches nothing.
    const updates = [
      a.client.from("budgets").update({ name: "Hacked" }).eq("id", bBudget.id).select(),
      a.client.from("income_sources").update({ amount: 1 }).eq("id", bIncome.id).select(),
      a.client.from("budget_periods").update({ carried_in: 1 }).eq("id", bPeriod.id).select(),
    ];
    for (const { data } of await Promise.all(updates)) expect(data).toEqual([]);

    const { data: budget } = await b.client.from("budgets").select("name").eq("id", bBudget.id).single();
    expect(budget?.name).toBe("Main budget");
  });

  it("can't delete them", async () => {
    for (const [table, id] of tables()) {
      await a.client.from(table).delete().eq("id", id);
      const { data } = await b.client.from(table).select("id").eq("id", id);
      expect(data, table).toHaveLength(1);
    }
  });

  it("can't create rows owned by B", async () => {
    const { error } = await a.client.from("budgets").insert({ ...semiMonthly, user_id: b.id });
    expect(error?.code).toBe(PERMISSION_DENIED);
  });

  it("can't attach income sources or periods to B's budget", async () => {
    // user_id defaults to A, so (B's budget, A) doesn't match any budget.
    const { error: incomeError } = await a.client.from("income_sources").insert({
      budget_id: bBudget.id,
      name: "Sneaky",
      amount: 100,
      pay_slot: "every",
      start_date: "2026-11-15",
    });
    expect(incomeError?.code).toBe(FOREIGN_KEY_VIOLATION);

    const { error: periodError } = await a.client.from("budget_periods").insert({
      budget_id: bBudget.id,
      start_date: "2027-03-15",
      end_date: "2027-03-29",
      pay_slot: "payday_1",
    });
    expect(periodError?.code).toBe(FOREIGN_KEY_VIOLATION);
  });

  it("can't move their own budget to B", async () => {
    const aBudget = await createBudget(a);
    const { error } = await a.client.from("budgets").update({ user_id: b.id }).eq("id", aBudget.id);
    expect(error?.code).toBe(PERMISSION_DENIED);
  });
});

describe("logged-out visitors", () => {
  it("can't read or add anything", async () => {
    const anon = anonClient();
    for (const table of ["budgets", "income_sources", "budget_periods"] as const) {
      const { error } = await anon.from(table).select("id");
      expect(error?.code, table).toBe(PERMISSION_DENIED);
    }
    const { error } = await anon.from("budgets").insert(semiMonthly);
    expect(error?.code).toBe(PERMISSION_DENIED);
  });
});
