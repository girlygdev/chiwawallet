import { describe, expect, it } from "vitest";
import { anonClient, signUpUser, type TestUser } from "./helpers";

// recurring_bills (4a-1): checks, the category rule, RLS and permissions.

const PERMISSION_DENIED = "42501";
const CHECK_VIOLATION = "23514";
const FOREIGN_KEY_VIOLATION = "23503";

type Setup = { user: TestUser; budgetId: string; category: Record<string, string> };

// A user with a twice-a-month budget and their default categories.
async function setUp(): Promise<Setup> {
  const user = await signUpUser();
  const { data: budget, error } = await user.client
    .from("budgets")
    .insert({ name: "Main budget", frequency: "semi_monthly", pay_day_1: 15, pay_day_2: 30 })
    .select("id")
    .single();
  if (error) throw new Error(`Couldn't create budget: ${error.message}`);
  const { data: categories } = await user.client.from("categories").select("id, name");
  return { user, budgetId: budget.id, category: Object.fromEntries(categories!.map((c) => [c.name, c.id])) };
}

function bill(s: Setup, fields: Record<string, unknown> = {}) {
  return {
    budget_id: s.budgetId,
    name: "Meralco",
    amount: 250_000,
    category_id: s.category.Bills,
    frequency: "monthly",
    due_day: 20,
    pay_slot: "payday_1",
    ...fields,
  };
}

async function createBill(s: Setup, fields: Record<string, unknown> = {}) {
  const { data, error } = await s.user.client.from("recurring_bills").insert(bill(s, fields)).select().single();
  if (error) throw new Error(`Couldn't create bill: ${error.message}`);
  return data;
}

describe("recurring_bills: owner's own rows", () => {
  it("adds a monthly bill with defaults and fills in user_id", async () => {
    const s = await setUp();
    const row = await createBill(s);
    expect(row).toMatchObject({
      user_id: s.user.id,
      amount_varies: false,
      remind: true,
      first_due_month: null,
    });
  });

  it("adds quarterly and yearly bills with their first month", async () => {
    const s = await setUp();
    await createBill(s, { frequency: "quarterly", first_due_month: 2, pay_slot: "split" });
    await createBill(s, { name: "Car insurance", frequency: "yearly", first_due_month: 11, due_day: 31 });
  });

  it("allows every pay slot, including every and split", async () => {
    const s = await setUp();
    for (const [i, pay_slot] of ["payday_1", "payday_2", "split", "every"].entries()) {
      await createBill(s, { name: `Bill ${i}`, pay_slot });
    }
  });

  it("edits a bill", async () => {
    const s = await setUp();
    const row = await createBill(s);
    const { data, error } = await s.user.client
      .from("recurring_bills")
      .update({ amount: 300_000, amount_varies: true, category_id: s.category.Rent, remind: false })
      .eq("id", row.id)
      .select()
      .single();
    expect(error).toBeNull();
    expect(data).toMatchObject({ amount: 300_000, amount_varies: true, category_id: s.category.Rent, remind: false });
    expect(data!.updated_at > row.updated_at).toBe(true);
  });

  it("deletes a bill", async () => {
    const s = await setUp();
    const row = await createBill(s);
    await s.user.client.from("recurring_bills").delete().eq("id", row.id);
    const { data } = await s.user.client.from("recurring_bills").select("id").eq("id", row.id);
    expect(data).toEqual([]);
  });

  it("can't change the owner, budget or timestamps", async () => {
    const s = await setUp();
    const row = await createBill(s);
    for (const fields of [{ user_id: s.user.id }, { budget_id: s.budgetId }, { created_at: new Date().toISOString() }]) {
      const { error } = await s.user.client.from("recurring_bills").update(fields).eq("id", row.id);
      expect(error?.code).toBe(PERMISSION_DENIED);
    }
  });
});

describe("recurring_bills: checks reject bad data", () => {
  it.each([
    ["an empty name", { name: "  " }],
    ["a 41-character name", { name: "a".repeat(41) }],
    ["a zero amount", { amount: 0 }],
    ["a negative amount", { amount: -100 }],
    ["an unknown frequency", { frequency: "weekly" }],
    ["due day 0", { due_day: 0 }],
    ["due day 32", { due_day: 32 }],
    ["an unknown pay slot", { pay_slot: "payday_3" }],
    ["a monthly bill with a first month", { first_due_month: 3 }],
    ["a quarterly bill without a first month", { frequency: "quarterly" }],
    ["a yearly bill with month 13", { frequency: "yearly", first_due_month: 13 }],
  ])("rejects %s", async (_label, fields) => {
    const s = await setUp();
    const { error } = await s.user.client.from("recurring_bills").insert(bill(s, fields));
    expect(error?.code).toBe(CHECK_VIOLATION);
  });

  it.each([["Income"], ["Savings pot"], ["Extra debt payment"]])("rejects the %s category", async (name) => {
    const s = await setUp();
    const { error } = await s.user.client.from("recurring_bills").insert(bill(s, { category_id: s.category[name] }));
    expect(error?.code).toBe(CHECK_VIOLATION);
  });

  it("rejects moving a bill to a system category", async () => {
    const s = await setUp();
    const row = await createBill(s);
    const { error } = await s.user.client
      .from("recurring_bills")
      .update({ category_id: s.category["Savings pot"] })
      .eq("id", row.id);
    expect(error?.code).toBe(CHECK_VIOLATION);
  });

  it("a category with a bill can't be deleted directly", async () => {
    const s = await setUp();
    const { data: pet } = await s.user.client
      .from("categories")
      .insert({ name: "Pet", kind: "expense", budget_group: "needs", icon: "dog", color: "orange" })
      .select("id")
      .single();
    await createBill(s, { category_id: pet!.id });
    const { error } = await s.user.client.from("categories").delete().eq("id", pet!.id);
    expect(error?.code).toBe(FOREIGN_KEY_VIOLATION);
  });

  it("deleting the budget deletes its bills", async () => {
    const s = await setUp();
    const row = await createBill(s);
    await s.user.client.from("budgets").delete().eq("id", s.budgetId);
    const { data } = await s.user.client.from("recurring_bills").select("id").eq("id", row.id);
    expect(data).toEqual([]);
  });
});

describe("RLS: user A can't reach user B's bills", () => {
  it("can't read, change or delete them", async () => {
    const a = await setUp();
    const b = await setUp();
    const bBill = await createBill(b);

    const { data: read } = await a.user.client.from("recurring_bills").select("id").eq("id", bBill.id);
    expect(read).toEqual([]);

    const { data: updated } = await a.user.client
      .from("recurring_bills")
      .update({ amount: 1 })
      .eq("id", bBill.id)
      .select("id");
    expect(updated).toEqual([]);

    await a.user.client.from("recurring_bills").delete().eq("id", bBill.id);
    const { data: still } = await b.user.client.from("recurring_bills").select("amount").eq("id", bBill.id).single();
    expect(still!.amount).toBe(250_000);
  });

  it("can't create bills owned by B", async () => {
    const a = await setUp();
    const b = await setUp();
    const { error } = await a.user.client.from("recurring_bills").insert(bill(a, { user_id: b.user.id }));
    expect(error).not.toBeNull();
  });

  it("can't add a bill to B's budget or use B's category", async () => {
    const a = await setUp();
    const b = await setUp();
    const toBudget = await a.user.client.from("recurring_bills").insert(bill(a, { budget_id: b.budgetId }));
    expect(toBudget.error?.code).toBe(FOREIGN_KEY_VIOLATION);
    const toCategory = await a.user.client.from("recurring_bills").insert(bill(a, { category_id: b.category.Bills }));
    expect(toCategory.error?.code).toBe(FOREIGN_KEY_VIOLATION);
  });

  it("can't move their own bill to B's category", async () => {
    const a = await setUp();
    const b = await setUp();
    const row = await createBill(a);
    const { error } = await a.user.client
      .from("recurring_bills")
      .update({ category_id: b.category.Bills })
      .eq("id", row.id);
    expect(error?.code).toBe(FOREIGN_KEY_VIOLATION);
  });
});

describe("logged-out visitors", () => {
  it("can't read or add bills", async () => {
    const s = await setUp();
    await createBill(s);
    const anon = anonClient();
    const { data } = await anon.from("recurring_bills").select("id");
    expect(data ?? []).toEqual([]);
    const { error } = await anon.from("recurring_bills").insert(bill(s));
    expect(error).not.toBeNull();
  });
});
