import { beforeAll, describe, expect, it } from "vitest";
import { anonClient, signUpUser, type TestUser } from "./helpers";

// Postgres error codes the tests expect.
const PERMISSION_DENIED = "42501";
const CHECK_VIOLATION = "23514";
const FOREIGN_KEY_VIOLATION = "23503";

type Setup = {
  user: TestUser;
  budgetId: string;
  periodId: string;
  incomeSourceId: string;
  // Default category ids by name, from sign-up.
  category: Record<string, string>;
};

// A user with a budget, one period (Nov 15–29), an income source and their
// default categories.
async function setUp(): Promise<Setup> {
  const user = await signUpUser();
  const insert = async (table: string, row: Record<string, unknown>) => {
    const { data, error } = await user.client.from(table).insert(row).select("id").single();
    if (error) throw new Error(`Couldn't create ${table}: ${error.message}`);
    return data.id as string;
  };
  const budgetId = await insert("budgets", {
    name: "Main budget",
    frequency: "semi_monthly",
    pay_day_1: 15,
    pay_day_2: 30,
  });
  const periodId = await insert("budget_periods", {
    budget_id: budgetId,
    start_date: "2026-11-15",
    end_date: "2026-11-29",
    pay_slot: "payday_1",
  });
  const incomeSourceId = await insert("income_sources", {
    budget_id: budgetId,
    name: "Salary",
    amount: 2_500_000,
    pay_slot: "payday_1",
    start_date: "2026-11-15",
  });
  const { data: categories } = await user.client.from("categories").select("id, name");
  const category = Object.fromEntries(categories!.map((c) => [c.name, c.id]));
  return { user, budgetId, periodId, incomeSourceId, category };
}

function expense(s: Setup, fields: Record<string, unknown> = {}) {
  return {
    period_id: s.periodId,
    category_id: s.category.Meals,
    type: "expense",
    amount: 18_000,
    date: "2026-11-20",
    ...fields,
  };
}

async function createTransaction(s: Setup, fields: Record<string, unknown> = {}) {
  const { data, error } = await s.user.client
    .from("transactions")
    .insert(expense(s, fields))
    .select()
    .single();
  if (error) throw new Error(`Couldn't create transaction: ${error.message}`);
  return data;
}

describe("transactions: owner's own rows", () => {
  let s: Setup;
  beforeAll(async () => {
    s = await setUp();
  });

  it("adds an expense and fills in user_id", async () => {
    const row = await createTransaction(s, { note: "Lunch" });
    expect(row).toMatchObject({ user_id: s.user.id, amount: 18_000, note: "Lunch", deleted_at: null });
  });

  it("adds income from a source", async () => {
    const row = await createTransaction(s, {
      type: "income",
      category_id: s.category.Income,
      income_source_id: s.incomeSourceId,
      amount: 2_500_000,
      date: "2026-11-15",
    });
    expect(row.income_source_id).toBe(s.incomeSourceId);
  });

  it("adds to a pot and withdraws (a negative savings amount)", async () => {
    const add = await createTransaction(s, { type: "savings", category_id: s.category["Savings pot"], amount: 300_000 });
    const withdraw = await createTransaction(s, {
      type: "savings",
      category_id: s.category["Savings pot"],
      amount: -100_000,
    });
    expect([add.amount, withdraw.amount]).toEqual([300_000, -100_000]);
  });

  it("adds a debt payment", async () => {
    const row = await createTransaction(s, { type: "debt_payment", category_id: s.category.Bills, amount: 400_000 });
    expect(row.type).toBe("debt_payment");
  });

  it("allows the first and last day of the period", async () => {
    await createTransaction(s, { date: "2026-11-15" });
    await createTransaction(s, { date: "2026-11-29" });
  });

  it("edits a transaction", async () => {
    const row = await createTransaction(s);
    const { data } = await s.user.client
      .from("transactions")
      .update({ amount: 25_000, category_id: s.category.Transport, note: "Grab" })
      .eq("id", row.id)
      .select()
      .single();
    expect(data).toMatchObject({ amount: 25_000, category_id: s.category.Transport, note: "Grab" });
    expect(data!.updated_at > row.updated_at).toBe(true);
  });

  it("soft-deletes and undoes", async () => {
    const row = await createTransaction(s);
    const deletedAt = new Date().toISOString();

    const { data: deleted } = await s.user.client
      .from("transactions")
      .update({ deleted_at: deletedAt })
      .eq("id", row.id)
      .select("deleted_at")
      .single();
    expect(deleted?.deleted_at).not.toBeNull();

    const { data: live } = await s.user.client
      .from("transactions")
      .select("id")
      .eq("id", row.id)
      .is("deleted_at", null);
    expect(live).toEqual([]);

    const { data: undone } = await s.user.client
      .from("transactions")
      .update({ deleted_at: null })
      .eq("id", row.id)
      .select("deleted_at")
      .single();
    expect(undone?.deleted_at).toBeNull();
  });

  it("can't hard-delete", async () => {
    const row = await createTransaction(s);
    const { error } = await s.user.client.from("transactions").delete().eq("id", row.id);
    expect(error?.code).toBe(PERMISSION_DENIED);
  });

  it("can't change the ids, owner or timestamps", async () => {
    const row = await createTransaction(s);
    for (const fields of [{ id: crypto.randomUUID() }, { user_id: s.user.id }, { created_at: "2020-01-01" }]) {
      const { error } = await s.user.client.from("transactions").update(fields).eq("id", row.id);
      expect(error?.code, Object.keys(fields)[0]).toBe(PERMISSION_DENIED);
    }
  });
});

describe("transactions: checks reject bad data", () => {
  let s: Setup;
  beforeAll(async () => {
    s = await setUp();
  });

  it.each([
    ["a ₱0 expense", { amount: 0 }],
    ["a negative expense", { amount: -18_000 }],
    ["a negative income", { type: "income", amount: -100 }],
    ["a negative debt payment", { type: "debt_payment", amount: -100 }],
    ["a ₱0 savings amount", { type: "savings", amount: 0 }],
    ["an unknown type", { type: "transfer" }],
    ["an empty note", { note: "   " }],
    ["a note over 100 characters", { note: "a".repeat(101) }],
    ["a date before the period", { date: "2026-11-14" }],
    ["a date after the period", { date: "2026-11-30" }],
  ])("rejects %s", async (_label, fields: Record<string, unknown>) => {
    const row = expense(s, fields);
    // Income rows need the Income category, so that rule doesn't hide the one tested here.
    if (fields.type === "income") row.category_id = s.category.Income;
    const { error } = await s.user.client.from("transactions").insert(row);
    expect(error?.code).toBe(CHECK_VIOLATION);
  });

  it("rejects an income source on a non-income row", async () => {
    const { error } = await s.user.client
      .from("transactions")
      .insert(expense(s, { income_source_id: s.incomeSourceId }));
    expect(error?.code).toBe(CHECK_VIOLATION);
  });

  it.each([
    ["an expense in the Income category", { category_id: "Income" }],
    ["income in an expense category", { type: "income", category_id: "Meals" }],
    ["savings in the Income category", { type: "savings", category_id: "Income" }],
  ])("rejects %s", async (_label, { category_id, ...fields }) => {
    const { error } = await s.user.client
      .from("transactions")
      .insert(expense(s, { ...fields, category_id: s.category[category_id] }));
    expect(error?.code).toBe(CHECK_VIOLATION);
  });

  it("rejects moving a row's date out of its period", async () => {
    const row = await createTransaction(s);
    const { error } = await s.user.client.from("transactions").update({ date: "2026-12-01" }).eq("id", row.id);
    expect(error?.code).toBe(CHECK_VIOLATION);
  });

  it("rejects changing a row to a type its category doesn't allow", async () => {
    const row = await createTransaction(s);
    const { error } = await s.user.client.from("transactions").update({ type: "income" }).eq("id", row.id);
    expect(error?.code).toBe(CHECK_VIOLATION);
  });
});

describe("transactions: what happens when linked rows are deleted", () => {
  it("a category with transactions can't be deleted", async () => {
    const s = await setUp();
    const { data: pet } = await s.user.client
      .from("categories")
      .insert({ name: "Pet", kind: "expense", budget_group: "needs", icon: "dog", color: "orange" })
      .select("id")
      .single();
    await createTransaction(s, { category_id: pet!.id });

    const { error } = await s.user.client.from("categories").delete().eq("id", pet!.id);
    expect(error?.code).toBe(FOREIGN_KEY_VIOLATION);
  });

  it("deleting an income source keeps the transaction and empties the link", async () => {
    const s = await setUp();
    const row = await createTransaction(s, {
      type: "income",
      category_id: s.category.Income,
      income_source_id: s.incomeSourceId,
    });

    const { error } = await s.user.client.from("income_sources").delete().eq("id", s.incomeSourceId);
    expect(error).toBeNull();

    const { data } = await s.user.client.from("transactions").select().eq("id", row.id).single();
    expect(data).toMatchObject({ income_source_id: null, user_id: s.user.id, amount: row.amount });
  });

  it("deleting the budget deletes its periods' transactions", async () => {
    const s = await setUp();
    await createTransaction(s);

    const { error } = await s.user.client.from("budgets").delete().eq("id", s.budgetId);
    expect(error).toBeNull();
    const { data } = await s.user.client.from("transactions").select("id");
    expect(data).toEqual([]);
  });
});

describe("RLS: user A can't reach user B's transactions", () => {
  let a: Setup;
  let b: Setup;
  let bRow: { id: string };

  beforeAll(async () => {
    [a, b] = await Promise.all([setUp(), setUp()]);
    bRow = await createTransaction(b);
  });

  it("can't read them", async () => {
    const { data, error } = await a.user.client.from("transactions").select("id").eq("id", bRow.id);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("can't change or soft-delete them", async () => {
    const { data } = await a.user.client
      .from("transactions")
      .update({ amount: 1, deleted_at: new Date().toISOString() })
      .eq("id", bRow.id)
      .select();
    expect(data).toEqual([]);

    const { data: still } = await b.user.client.from("transactions").select("amount, deleted_at").eq("id", bRow.id).single();
    expect(still).toEqual({ amount: 18_000, deleted_at: null });
  });

  it("can't create rows owned by B", async () => {
    const { error } = await a.user.client.from("transactions").insert({ ...expense(a), user_id: b.user.id });
    expect(error?.code).toBe(PERMISSION_DENIED);
  });

  // Functions, because a and b only exist once beforeAll has run.
  it.each<[string, () => Record<string, unknown>]>([
    ["period", () => ({ period_id: b.periodId })],
    ["category", () => ({ category_id: b.category.Meals })],
    ["income source", () => ({ type: "income", category_id: a.category.Income, income_source_id: b.incomeSourceId })],
  ])("can't use B's %s", async (_label, bFields) => {
    const { error } = await a.user.client.from("transactions").insert(expense(a, bFields()));
    expect(error?.code).toBe(FOREIGN_KEY_VIOLATION);
  });

  it("can't move their own row into B's period", async () => {
    const aRow = await createTransaction(a);
    const { error } = await a.user.client.from("transactions").update({ period_id: b.periodId }).eq("id", aRow.id);
    expect(error?.code).toBe(FOREIGN_KEY_VIOLATION);
  });
});

describe("logged-out visitors", () => {
  it("can't read transactions", async () => {
    const anon = anonClient();
    const { error } = await anon.from("transactions").select("id");
    expect(error?.code).toBe(PERMISSION_DENIED);
  });
});
