import { describe, expect, it } from "vitest";
import { anonClient, signUpUser, type TestUser } from "./helpers";

// mark_plan_item_paid() and the trigger that keeps paid_at in step with the
// payment (week-6-tasks.md 6a).

const GONE = "P0002";
const NOT_PAYABLE = "22023";
const NOT_NOW = "55000";
const CHECK_VIOLATION = "23514";
const PERMISSION_DENIED = "42501";

type Setup = {
  user: TestUser;
  /** Jan 15–29, 2027: open. */
  periodId: string;
  /** Jan 30 – Feb 14, 2027: closed. */
  closedId: string;
  category: Record<string, string>;
  ids: { source: string; bill: string; pot: string; debt: string };
};

// A user with a twice-a-month budget, an open and a closed period, their
// default categories, and one income source, bill, pot and debt.
async function setUp(): Promise<Setup> {
  const user = await signUpUser();
  const insert = async (table: string, row: Record<string, unknown>) => {
    const { data, error } = await user.client.from(table).insert(row).select("id").single();
    if (error) throw new Error(`Couldn't create ${table}: ${error.message}`);
    return data.id as string;
  };
  const budgetId = await insert("budgets", { name: "Main budget", frequency: "semi_monthly", pay_day_1: 15, pay_day_2: 30 });
  const periodId = await insert("budget_periods", { budget_id: budgetId, start_date: "2027-01-15", end_date: "2027-01-29", pay_slot: "payday_1" });
  const closedId = await insert("budget_periods", { budget_id: budgetId, start_date: "2027-01-30", end_date: "2027-02-14", pay_slot: "payday_2" });
  await user.client.from("budget_periods").update({ closed_at: new Date().toISOString() }).eq("id", closedId);
  const { data: categories } = await user.client.from("categories").select("id, name");
  const category = Object.fromEntries(categories!.map((c) => [c.name, c.id]));
  const ids = {
    source: await insert("income_sources", { budget_id: budgetId, name: "Salary", amount: 2_500_000, pay_slot: "payday_1", start_date: "2026-01-15" }),
    bill: await insert("recurring_bills", {
      budget_id: budgetId, name: "Meralco", amount: 250_000, category_id: category.Bills, frequency: "monthly", due_day: 20, pay_slot: "payday_1",
    }),
    pot: await insert("savings_pots", { name: "Laptop fund", icon: "laptop", color: "blue", planned_contribution: 200_000, pay_slot: "payday_1" }),
    debt: await insert("debts", {
      name: "SPayLater", total_amount: 1_200_000, payment_type: "installments", num_payments: 3, payment_amount: 400_000, first_due_date: "2027-01-20",
    }),
  };
  return { user, periodId, closedId, category, ids };
}

async function addItem(s: Setup, row: Record<string, unknown>) {
  const { data, error } = await s.user.client
    .from("plan_items")
    .insert({ period_id: s.periodId, ...row })
    .select("id")
    .single();
  if (error) throw new Error(`Couldn't add the plan item: ${error.message}`);
  return data.id as string;
}

const items = {
  bill: (s: Setup) => ({ name: "Meralco", category_id: s.category.Bills, planned_amount: 250_000, origin: "recurring", bill_id: s.ids.bill }),
  pot: (s: Setup) => ({ name: "Laptop fund", category_id: s.category["Savings pot"], planned_amount: 200_000, origin: "recurring", pot_id: s.ids.pot }),
  debt: (s: Setup) => ({ name: "SPayLater", category_id: s.category["Debt payment"], planned_amount: 400_000, origin: "recurring", debt_id: s.ids.debt }),
  extraDebt: (s: Setup) => ({ name: "SPayLater", category_id: s.category["Extra debt payment"], planned_amount: 100_000, origin: "one_off", debt_id: s.ids.debt }),
  oneOff: (s: Setup) => ({ name: "Dad's birthday gift", category_id: s.category.Gifts, planned_amount: 250_000, origin: "one_off" }),
  income: (s: Setup) => ({ name: "Salary", category_id: s.category.Income, planned_amount: 2_500_000, origin: "recurring", income_source_id: s.ids.source }),
  budget: (s: Setup) => ({ name: "Meals", category_id: s.category.Meals, planned_amount: 300_000, origin: "recurring" }),
  starter: () => ({ name: "Needs", budget_group: "needs", planned_amount: 1_250_000, origin: "starter" }),
};

const markPaid = (s: Setup, item: string, paid_on = "2027-01-20", paid_amount = 250_000, client = s.user.client) =>
  client.rpc("mark_plan_item_paid", { target_item: item, paid_on, paid_amount });

const paidAt = async (s: Setup, item: string) =>
  (await s.user.client.from("plan_items").select("paid_at").eq("id", item).single()).data!.paid_at;

const payments = async (s: Setup, item: string) =>
  (await s.user.client.from("transactions").select("*").eq("plan_item_id", item)).data!;

describe("mark_plan_item_paid: what it creates", () => {
  it("pays a bill: an expense in its category, linked to the item, which is ticked", async () => {
    const s = await setUp();
    const item = await addItem(s, items.bill(s));
    const { data: transactionId, error } = await markPaid(s, item, "2027-01-20", 260_000);
    expect(error).toBeNull();
    const [payment] = await payments(s, item);
    expect(payment).toMatchObject({
      id: transactionId, type: "expense", category_id: s.category.Bills, amount: 260_000, date: "2027-01-20", period_id: s.periodId,
      plan_item_id: item, deleted_at: null,
    });
    expect(await paidAt(s, item)).not.toBeNull();
  });

  it("pays a pot: a savings deposit to that pot", async () => {
    const s = await setUp();
    const item = await addItem(s, items.pot(s));
    expect((await markPaid(s, item, "2027-01-15", 200_000)).error).toBeNull();
    expect((await payments(s, item))[0]).toMatchObject({ type: "savings", pot_id: s.ids.pot, category_id: s.category["Savings pot"], amount: 200_000 });
  });

  it("pays a scheduled debt payment as Debt payment, and an extra one as Extra debt payment", async () => {
    const s = await setUp();
    const scheduled = await addItem(s, items.debt(s));
    const extra = await addItem(s, items.extraDebt(s));
    expect((await markPaid(s, scheduled, "2027-01-20", 400_000)).error).toBeNull();
    expect((await markPaid(s, extra, "2027-01-21", 100_000)).error).toBeNull();
    expect((await payments(s, scheduled))[0]).toMatchObject({ type: "debt_payment", debt_id: s.ids.debt, category_id: s.category["Debt payment"] });
    expect((await payments(s, extra))[0]).toMatchObject({ type: "debt_payment", debt_id: s.ids.debt, category_id: s.category["Extra debt payment"] });
  });

  it("pays a one-off: an expense in its category", async () => {
    const s = await setUp();
    const item = await addItem(s, items.oneOff(s));
    expect((await markPaid(s, item)).error).toBeNull();
    expect((await payments(s, item))[0]).toMatchObject({ type: "expense", category_id: s.category.Gifts });
  });
});

describe("mark_plan_item_paid: what it refuses", () => {
  it("income, spending budgets and starter lines (they aren't ticked)", async () => {
    const s = await setUp();
    for (const row of [items.income(s), items.budget(s), items.starter()]) {
      const item = await addItem(s, row);
      expect((await markPaid(s, item)).error?.code).toBe(NOT_PAYABLE);
    }
  });

  it("an item already paid, or in a closed period", async () => {
    const s = await setUp();
    const item = await addItem(s, items.bill(s));
    await markPaid(s, item);
    expect((await markPaid(s, item)).error?.code).toBe(NOT_NOW);
    const closed = await addItem(s, { ...items.oneOff(s), period_id: s.closedId });
    expect((await markPaid(s, closed, "2027-02-01")).error?.code).toBe(NOT_NOW);
  });

  it("a removed item, and one that isn't there", async () => {
    const s = await setUp();
    const item = await addItem(s, items.oneOff(s));
    await s.user.client.from("plan_items").update({ deleted_at: new Date().toISOString() }).eq("id", item);
    expect((await markPaid(s, item)).error?.code).toBe(GONE);
    expect((await markPaid(s, crypto.randomUUID())).error?.code).toBe(GONE);
  });

  it("₱0 or less", async () => {
    const s = await setUp();
    const item = await addItem(s, items.oneOff(s));
    expect((await markPaid(s, item, "2027-01-20", 0)).error?.code).toBe(NOT_PAYABLE);
  });

  it("a date outside the period, and leaves the item unpaid (nothing half-done)", async () => {
    const s = await setUp();
    const item = await addItem(s, items.bill(s));
    expect((await markPaid(s, item, "2027-02-01")).error?.code).toBe(CHECK_VIOLATION);
    expect(await paidAt(s, item)).toBeNull();
    expect(await payments(s, item)).toEqual([]);
  });
});

describe("paid_at follows the payment", () => {
  it("deleting the payment un-ticks the item; restoring it ticks it again", async () => {
    const s = await setUp();
    const item = await addItem(s, items.bill(s));
    const { data: transactionId } = await markPaid(s, item);
    await s.user.client.from("transactions").update({ deleted_at: new Date().toISOString() }).eq("id", transactionId);
    expect(await paidAt(s, item)).toBeNull();
    await s.user.client.from("transactions").update({ deleted_at: null }).eq("id", transactionId);
    expect(await paidAt(s, item)).not.toBeNull();
    // Paid again after an undo: allowed, since it's due again.
    await s.user.client.from("transactions").update({ deleted_at: new Date().toISOString() }).eq("id", transactionId);
    expect((await markPaid(s, item)).error).toBeNull();
  });
});

describe("mark_plan_item_paid: other users", () => {
  it("can't pay someone else's item, and anonymous callers can't call it", async () => {
    const a = await setUp();
    const b = await signUpUser();
    const item = await addItem(a, items.bill(a));
    expect((await markPaid(a, item, "2027-01-20", 250_000, b.client)).error?.code).toBe(GONE);
    expect(await paidAt(a, item)).toBeNull();
    expect((await markPaid(a, item, "2027-01-20", 250_000, anonClient())).error?.code).toBe(PERMISSION_DENIED);
  });
});
