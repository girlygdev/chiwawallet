import { describe, expect, it } from "vitest";
import { anonClient, signUpUser, type TestUser } from "./helpers";

// add_plan_items() (5c): adds generated items once, skipping any already there.

const PERMISSION_DENIED = "42501";
const FOREIGN_KEY_VIOLATION = "23503";
const CHECK_VIOLATION = "23514";

type Setup = { user: TestUser; periodId: string; billId: string; potId: string; category: Record<string, string> };

// A user with a budget, one period (Jan 15–29, 2027), a bill and their default categories and pots.
async function setUp(): Promise<Setup> {
  const user = await signUpUser();
  const insert = async (table: string, row: Record<string, unknown>) => {
    const { data, error } = await user.client.from(table).insert(row).select("id").single();
    if (error) throw new Error(`Couldn't create ${table}: ${error.message}`);
    return data.id as string;
  };
  const budgetId = await insert("budgets", { name: "Main budget", frequency: "semi_monthly", pay_day_1: 15, pay_day_2: 30 });
  const periodId = await insert("budget_periods", { budget_id: budgetId, start_date: "2027-01-15", end_date: "2027-01-29", pay_slot: "payday_1" });
  const { data: categories } = await user.client.from("categories").select("id, name");
  const category = Object.fromEntries(categories!.map((c) => [c.name, c.id]));
  const billId = await insert("recurring_bills", {
    budget_id: budgetId, name: "Meralco", amount: 250_000, category_id: category.Bills, frequency: "monthly", due_day: 20, pay_slot: "payday_1",
  });
  const { data: pot } = await user.client.from("savings_pots").select("id").eq("name", "Emergency Fund").single();
  return { user, periodId, billId, potId: pot!.id, category };
}

// Shaped like generatePlan()'s items.
const generated = (s: Setup) => [
  { name: "Meralco", category_id: s.category.Bills, planned_amount: 250_000, income_source_id: null, bill_id: s.billId, pot_id: null, debt_id: null },
  { name: "Emergency Fund", category_id: s.category["Savings pot"], planned_amount: 300_000, income_source_id: null, bill_id: null, pot_id: s.potId, debt_id: null },
  { name: "Meals", category_id: s.category.Meals, planned_amount: 600_000, income_source_id: null, bill_id: null, pot_id: null, debt_id: null },
];

const addItems = (s: Setup, items: unknown[], period = s.periodId) =>
  s.user.client.rpc("add_plan_items", { target_period: period, items });

async function names(s: Setup) {
  const { data } = await s.user.client.from("plan_items").select("name, origin, user_id").eq("period_id", s.periodId).order("name");
  return data!;
}

describe("add_plan_items", () => {
  it("adds the items as recurring, owned by the caller, and says how many", async () => {
    const s = await setUp();
    const { data, error } = await addItems(s, generated(s));
    expect(error).toBeNull();
    expect(data).toBe(3);
    expect(await names(s)).toEqual(
      ["Emergency Fund", "Meals", "Meralco"].map((name) => ({ name, origin: "recurring", user_id: s.user.id })),
    );
  });

  it("adds nothing the second time", async () => {
    const s = await setUp();
    await addItems(s, generated(s));
    const { data, error } = await addItems(s, generated(s));
    expect(error).toBeNull();
    expect(data).toBe(0);
    expect(await names(s)).toHaveLength(3);
  });

  it("adds only what's new, like a bill added later", async () => {
    const s = await setUp();
    await addItems(s, generated(s).slice(0, 1));
    const { data } = await addItems(s, generated(s));
    expect(data).toBe(2);
  });

  it("never brings back an item that was deleted", async () => {
    const s = await setUp();
    await addItems(s, generated(s));
    await s.user.client.from("plan_items").update({ deleted_at: new Date().toISOString() }).eq("name", "Meals");
    const { data } = await addItems(s, generated(s));
    expect(data).toBe(0);
    const { data: live } = await s.user.client.from("plan_items").select("name").is("deleted_at", null);
    expect(live!.map((i) => i.name).sort()).toEqual(["Emergency Fund", "Meralco"]);
  });

  it("does nothing with an empty list", async () => {
    const s = await setUp();
    expect((await addItems(s, [])).data).toBe(0);
  });

  it("still applies the table's checks", async () => {
    const s = await setUp();
    const { error } = await addItems(s, [{ ...generated(s)[0], planned_amount: 0 }]);
    expect(error?.code).toBe(CHECK_VIOLATION);
  });
});

describe("RLS: user A can't use add_plan_items on user B", () => {
  it("can't add items to B's period", async () => {
    const a = await setUp();
    const b = await setUp();
    const { error } = await addItems(a, generated(a), b.periodId);
    expect(error?.code).toBe(FOREIGN_KEY_VIOLATION);
    expect(await names(b)).toEqual([]);
  });

  it("can't link B's bill or category", async () => {
    const a = await setUp();
    const b = await setUp();
    const { error } = await addItems(a, [{ ...generated(a)[0], bill_id: b.billId }]);
    expect(error?.code).toBe(FOREIGN_KEY_VIOLATION);
    const { error: categoryError } = await addItems(a, [{ ...generated(a)[2], category_id: b.category.Meals }]);
    expect(categoryError?.code).toBe(FOREIGN_KEY_VIOLATION);
  });
});

describe("logged-out visitors", () => {
  it("can't call it", async () => {
    const s = await setUp();
    const { error } = await anonClient().rpc("add_plan_items", { target_period: s.periodId, items: generated(s) });
    expect(error?.code).toBe(PERMISSION_DENIED);
  });
});
