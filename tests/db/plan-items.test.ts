import { describe, expect, it } from "vitest";
import { anonClient, signUpUser, type TestUser } from "./helpers";

// plan_items (5a): checks, the generation keys, deleting sources, the
// category move, RLS and permissions.

const PERMISSION_DENIED = "42501";
const CHECK_VIOLATION = "23514";
const UNIQUE_VIOLATION = "23505";
const FOREIGN_KEY_VIOLATION = "23503";

type Setup = {
  user: TestUser;
  budgetId: string;
  /** Jan 15–29, 2026: long over. */
  pastId: string;
  /** Jan 15–29, 2027: hasn't ended. */
  futureId: string;
  category: Record<string, string>;
  sourceId: string;
  billId: string;
  potId: string;
  debtId: string;
};

// A user with a twice-a-month budget, a past and a future period, their
// default categories, and one income source, bill, pot and debt.
async function setUp(): Promise<Setup> {
  const user = await signUpUser();
  const insert = async (table: string, row: Record<string, unknown>) => {
    const { data, error } = await user.client.from(table).insert(row).select("id").single();
    if (error) throw new Error(`Couldn't create ${table}: ${error.message}`);
    return data.id as string;
  };
  const budgetId = await insert("budgets", { name: "Main budget", frequency: "semi_monthly", pay_day_1: 15, pay_day_2: 30 });
  const period = (start_date: string, end_date: string) =>
    insert("budget_periods", { budget_id: budgetId, start_date, end_date, pay_slot: "payday_1" });
  const pastId = await period("2026-01-15", "2026-01-29");
  const futureId = await period("2027-01-15", "2027-01-29");
  const { data: categories } = await user.client.from("categories").select("id, name");
  const category = Object.fromEntries(categories!.map((c) => [c.name, c.id]));
  const sourceId = await insert("income_sources", {
    budget_id: budgetId,
    name: "Salary",
    amount: 2_500_000,
    pay_slot: "payday_1",
    start_date: "2026-01-15",
  });
  const billId = await insert("recurring_bills", {
    budget_id: budgetId,
    name: "Meralco",
    amount: 250_000,
    category_id: category.Bills,
    frequency: "monthly",
    due_day: 20,
    pay_slot: "payday_1",
  });
  const potId = await insert("savings_pots", { name: "Laptop fund", icon: "laptop", color: "blue", planned_contribution: 200_000, pay_slot: "payday_1" });
  const debtId = await insert("debts", {
    name: "SPayLater",
    total_amount: 1_200_000,
    payment_type: "installments",
    num_payments: 3,
    payment_amount: 400_000,
    first_due_date: "2027-01-20",
  });
  return { user, budgetId, pastId, futureId, category, sourceId, billId, potId, debtId };
}

// Each kind of item, as generatePlan() will make them.
const items = {
  income: (s: Setup, period_id = s.futureId) => ({
    period_id, name: "Salary", category_id: s.category.Income, planned_amount: 2_500_000, origin: "recurring", income_source_id: s.sourceId,
  }),
  bill: (s: Setup, period_id = s.futureId) => ({
    period_id, name: "Meralco", category_id: s.category.Bills, planned_amount: 250_000, origin: "recurring", bill_id: s.billId,
  }),
  pot: (s: Setup, period_id = s.futureId) => ({
    period_id, name: "Laptop fund", category_id: s.category["Savings pot"], planned_amount: 200_000, origin: "recurring", pot_id: s.potId,
  }),
  debt: (s: Setup, period_id = s.futureId) => ({
    period_id, name: "SPayLater", category_id: s.category["Debt payment"], planned_amount: 400_000, origin: "recurring", debt_id: s.debtId,
  }),
  budget: (s: Setup, name = "Meals", period_id = s.futureId) => ({
    period_id, name, category_id: s.category[name], planned_amount: 300_000, origin: "recurring",
  }),
  oneOff: (s: Setup, fields: Record<string, unknown> = {}) => ({
    period_id: s.futureId, name: "Dad's birthday gift", category_id: s.category.Gifts, planned_amount: 250_000, origin: "one_off", ...fields,
  }),
  starter: (s: Setup, budget_group = "needs") => ({
    period_id: s.futureId, name: "Needs", budget_group, planned_amount: 1_250_000, origin: "starter",
  }),
};

async function add(s: Setup, row: Record<string, unknown>) {
  const { data, error } = await s.user.client.from("plan_items").insert(row).select().single();
  if (error) throw new Error(`Couldn't add the plan item: ${error.message}`);
  return data;
}

async function get(s: Setup, id: string) {
  const { data } = await s.user.client.from("plan_items").select().eq("id", id).single();
  return data!;
}

describe("plan_items: owner's own rows", () => {
  it("adds a one-off with defaults and fills in user_id", async () => {
    const s = await setUp();
    const row = await add(s, items.oneOff(s, { needed_by: "2027-01-25" }));
    expect(row).toMatchObject({ user_id: s.user.id, edited: false, paid_at: null, deleted_at: null, budget_group: null });
  });

  it("adds a spending budget already marked edited (Set a budget, this period only; 5g-1)", async () => {
    const s = await setUp();
    const row = await add(s, { ...items.budget(s), edited: true });
    expect(row).toMatchObject({ origin: "recurring", edited: true });
  });

  it("adds every kind of generated item, and starter items with a group and no category", async () => {
    const s = await setUp();
    for (const row of [items.income(s), items.bill(s), items.pot(s), items.debt(s), items.budget(s), items.starter(s)]) {
      await add(s, row);
    }
  });

  it.each([
    ["a zero amount", { planned_amount: 0 }],
    ["a blank name", { name: "  " }],
    ["no category", { category_id: null }],
    ["a group on a non-starter item", { budget_group: "wants" }],
    ["an unknown origin", { origin: "monthly" }],
    ["a bill on a one-off", { bill_id: "BILL" }],
    ["two links", { pot_id: "POT", debt_id: "DEBT" }],
  ])("rejects %s", async (_, fields) => {
    const s = await setUp();
    const ids: Record<string, string> = { BILL: s.billId, POT: s.potId, DEBT: s.debtId };
    const row = Object.fromEntries(
      Object.entries({ ...items.oneOff(s), ...fields }).map(([k, v]) => [k, typeof v === "string" && v in ids ? ids[v] : v]),
    );
    const { error } = await s.user.client.from("plan_items").insert(row);
    expect(error?.code).toBe(CHECK_VIOLATION);
  });

  it("rejects a starter item with a category, or with a link", async () => {
    const s = await setUp();
    for (const fields of [{ category_id: s.category.Meals }, { pot_id: s.potId }]) {
      const { error } = await s.user.client.from("plan_items").insert({ ...items.starter(s), ...fields });
      expect(error?.code).toBe(CHECK_VIOLATION);
    }
  });

  it("rejects needed_by on anything but a one-off", async () => {
    const s = await setUp();
    const { error } = await s.user.client.from("plan_items").insert({ ...items.bill(s), needed_by: "2027-01-20" });
    expect(error?.code).toBe(CHECK_VIOLATION);
  });

  it("needs an income category for income and an expense category for everything else", async () => {
    const s = await setUp();
    const income = await s.user.client.from("plan_items").insert({ ...items.income(s), category_id: s.category.Meals });
    expect(income.error?.code).toBe(CHECK_VIOLATION);
    const expense = await s.user.client.from("plan_items").insert(items.oneOff(s, { category_id: s.category.Income }));
    expect(expense.error?.code).toBe(CHECK_VIOLATION);
  });

  it("can change a category only to one of the same kind", async () => {
    const s = await setUp();
    const row = await add(s, items.oneOff(s));
    const toIncome = await s.user.client.from("plan_items").update({ category_id: s.category.Income }).eq("id", row.id);
    expect(toIncome.error?.code).toBe(CHECK_VIOLATION);
    const toFun = await s.user.client.from("plan_items").update({ category_id: s.category.Fun }).eq("id", row.id);
    expect(toFun.error).toBeNull();
  });

  it("edits, marks edited, soft-deletes and undoes", async () => {
    const s = await setUp();
    const row = await add(s, items.bill(s));
    const { error } = await s.user.client
      .from("plan_items")
      .update({ name: "Meralco (Jan)", planned_amount: 280_000, edited: true, period_id: s.pastId })
      .eq("id", row.id);
    expect(error).toBeNull();
    for (const deleted_at of [new Date().toISOString(), null]) {
      expect((await s.user.client.from("plan_items").update({ deleted_at }).eq("id", row.id)).error).toBeNull();
    }
    expect(await get(s, row.id)).toMatchObject({ planned_amount: 280_000, edited: true, deleted_at: null, origin: "recurring" });
  });
});

describe("plan_items: no duplicate generated items", () => {
  it("refuses a second item from the same source in a period, even after the first was deleted", async () => {
    const s = await setUp();
    for (const make of [items.income, items.bill, items.pot, items.debt, (x: Setup) => items.budget(x)]) {
      const first = await add(s, make(s));
      expect((await s.user.client.from("plan_items").insert(make(s))).error?.code).toBe(UNIQUE_VIOLATION);
      await s.user.client.from("plan_items").update({ deleted_at: new Date().toISOString() }).eq("id", first.id);
      expect((await s.user.client.from("plan_items").insert(make(s))).error?.code).toBe(UNIQUE_VIOLATION);
    }
  });

  it("allows the same source in another period, and any number of one-offs and extra debt payments", async () => {
    const s = await setUp();
    await add(s, items.bill(s));
    await add(s, items.bill(s, s.pastId));
    const extra = { category_id: s.category["Extra debt payment"], debt_id: s.debtId, name: "SPayLater extra" };
    await add(s, items.oneOff(s, extra));
    await add(s, items.oneOff(s, extra));
    await add(s, items.oneOff(s));
    await add(s, items.oneOff(s));
  });

  it("adds the starter plan once per period, and again after it's deleted", async () => {
    const s = await setUp();
    const first = await add(s, items.starter(s));
    expect((await s.user.client.from("plan_items").insert(items.starter(s))).error?.code).toBe(UNIQUE_VIOLATION);
    await s.user.client.from("plan_items").update({ deleted_at: new Date().toISOString() }).eq("id", first.id);
    await add(s, items.starter(s));
  });
});

describe("plan_items: deleting a bill, pot, debt or income source", () => {
  const cases = [
    ["bill", "recurring_bills", "billId", "bill_id", items.bill],
    ["pot", "savings_pots", "potId", "pot_id", items.pot],
    ["debt", "debts", "debtId", "debt_id", items.debt],
    ["income source", "income_sources", "sourceId", "income_source_id", items.income],
  ] as const;

  it.each(cases)(
    "removes the %s's items in periods that haven't ended and keeps past ones as one-offs",
    async (_, table, idKey, column, make) => {
      const s = await setUp();
      const future = await add(s, make(s));
      const past = await add(s, make(s, s.pastId));

      const { error } = await s.user.client.from(table).delete().eq("id", s[idKey]);
      expect(error).toBeNull();

      const futureRow = await get(s, future.id);
      expect(futureRow.deleted_at).not.toBeNull();
      expect(futureRow[column]).toBeNull();

      const pastRow = await get(s, past.id);
      expect(pastRow).toMatchObject({ deleted_at: null, [column]: null, origin: "one_off" });
    },
  );

  it("leaves other items alone", async () => {
    const s = await setUp();
    const pot = await add(s, items.pot(s));
    const extra = await add(s, items.oneOff(s, { category_id: s.category["Extra debt payment"], debt_id: s.debtId }));
    await s.user.client.from("recurring_bills").delete().eq("id", s.billId);
    expect((await get(s, pot.id)).deleted_at).toBeNull();
    expect((await get(s, extra.id)).deleted_at).toBeNull();
  });

  it("lets a past bill item and a spending budget of the same category share a period", async () => {
    const s = await setUp();
    await add(s, items.bill(s, s.pastId)); // Meralco, in Bills
    await add(s, items.budget(s, "Bills", s.pastId));
    const { error } = await s.user.client.from("recurring_bills").delete().eq("id", s.billId);
    expect(error).toBeNull();
  });

  it("still deletes a whole budget with its periods, bills, income sources and items", async () => {
    const s = await setUp();
    await add(s, items.bill(s));
    await add(s, items.income(s, s.pastId));
    const { error } = await s.user.client.from("budgets").delete().eq("id", s.budgetId);
    expect(error).toBeNull();
    const { data } = await s.user.client.from("plan_items").select("id");
    expect(data).toEqual([]);
  });
});

describe("delete_category with plan items", () => {
  it("moves plan items, deleted ones too, and needs a destination for them", async () => {
    const s = await setUp();
    const live = await add(s, items.oneOff(s, { category_id: s.category.Fun }));
    const gone = await add(s, items.oneOff(s, { category_id: s.category.Fun }));
    await s.user.client.from("plan_items").update({ deleted_at: new Date().toISOString() }).eq("id", gone.id);

    const noDestination = await s.user.client.rpc("delete_category", { target_category: s.category.Fun });
    expect(noDestination.error?.code).toBe("22023");

    const { error } = await s.user.client.rpc("delete_category", { target_category: s.category.Fun, move_to: s.category.Travel });
    expect(error).toBeNull();
    expect((await get(s, live.id)).category_id).toBe(s.category.Travel);
    expect((await get(s, gone.id)).category_id).toBe(s.category.Travel);
  });

  it("turns a moved spending budget into a one-off, so it can't clash with the destination's", async () => {
    const s = await setUp();
    const fun = await add(s, items.budget(s, "Fun"));
    await add(s, items.budget(s, "Travel"));
    const { error } = await s.user.client.rpc("delete_category", { target_category: s.category.Fun, move_to: s.category.Travel });
    expect(error).toBeNull();
    expect(await get(s, fun.id)).toMatchObject({ category_id: s.category.Travel, origin: "one_off" });
  });

  it("keeps a bill's item recurring when its category moves", async () => {
    const s = await setUp();
    const bill = await add(s, items.bill(s));
    await s.user.client.rpc("delete_category", { target_category: s.category.Bills, move_to: s.category.Rent });
    expect(await get(s, bill.id)).toMatchObject({ category_id: s.category.Rent, origin: "recurring", bill_id: s.billId });
  });
});

describe("plan_items: permissions", () => {
  it("can't change the origin, links or paid_at, or set the owner", async () => {
    const s = await setUp();
    const row = await add(s, items.oneOff(s));
    for (const fields of [{ origin: "recurring" }, { bill_id: s.billId }, { paid_at: new Date().toISOString() }, { user_id: s.user.id }]) {
      const { error } = await s.user.client.from("plan_items").update(fields).eq("id", row.id);
      expect(error?.code).toBe(PERMISSION_DENIED);
    }
  });

  it("can't set paid_at when adding (Mark paid is Week 6)", async () => {
    const s = await setUp();
    const { error } = await s.user.client.from("plan_items").insert(items.oneOff(s, { paid_at: new Date().toISOString() }));
    expect(error?.code).toBe(PERMISSION_DENIED);
  });

  it("can't hard-delete", async () => {
    const s = await setUp();
    const row = await add(s, items.oneOff(s));
    const { error } = await s.user.client.from("plan_items").delete().eq("id", row.id);
    expect(error?.code).toBe(PERMISSION_DENIED);
  });

  it("can't link a transaction to a plan item yet", async () => {
    const s = await setUp();
    const row = await add(s, items.oneOff(s));
    const { error } = await s.user.client.from("transactions").insert({
      period_id: s.futureId, category_id: s.category.Gifts, type: "expense", amount: 250_000, date: "2027-01-20", plan_item_id: row.id,
    });
    expect(error?.code).toBe(PERMISSION_DENIED);
  });
});

describe("RLS: user A can't read or write user B's plan items", () => {
  it("can't read, edit or delete B's items", async () => {
    const a = await setUp();
    const b = await setUp();
    const row = await add(b, items.oneOff(b));

    const { data } = await a.user.client.from("plan_items").select("id");
    expect(data).toEqual([]);

    const { data: changed } = await a.user.client
      .from("plan_items")
      .update({ planned_amount: 1, deleted_at: new Date().toISOString() })
      .eq("id", row.id)
      .select();
    expect(changed).toEqual([]);
    expect(await get(b, row.id)).toMatchObject({ planned_amount: 250_000, deleted_at: null });
  });

  it("can't add items as B", async () => {
    const a = await setUp();
    const b = await setUp();
    const { error } = await a.user.client.from("plan_items").insert({ ...items.oneOff(b), user_id: b.user.id });
    expect(error).not.toBeNull();
  });

  it("can't add items to B's period or link B's category, bill, pot, debt or income source", async () => {
    const a = await setUp();
    const b = await setUp();
    for (const row of [
      items.oneOff(a, { period_id: b.futureId }),
      items.oneOff(a, { category_id: b.category.Gifts }),
      { ...items.bill(a), bill_id: b.billId },
      { ...items.pot(a), pot_id: b.potId },
      { ...items.debt(a), debt_id: b.debtId },
      { ...items.income(a), income_source_id: b.sourceId },
    ]) {
      const { error } = await a.user.client.from("plan_items").insert(row);
      expect(error?.code).toBe(FOREIGN_KEY_VIOLATION);
    }
  });

  it("deleting A's bill never touches B's items", async () => {
    const a = await setUp();
    const b = await setUp();
    const bRow = await add(b, items.bill(b));
    await a.user.client.from("recurring_bills").delete().eq("id", a.billId);
    expect((await get(b, bRow.id)).deleted_at).toBeNull();
  });
});

describe("logged-out visitors", () => {
  it("can't read or add plan items", async () => {
    const s = await setUp();
    const anon = anonClient();
    const read = await anon.from("plan_items").select("id");
    expect(read.error?.code).toBe(PERMISSION_DENIED);
    const insert = await anon.from("plan_items").insert(items.oneOff(s));
    expect(insert.error?.code).toBe(PERMISSION_DENIED);
  });
});
