import { describe, expect, it } from "vitest";
import { anonClient, signUpUser, type TestUser } from "./helpers";

// savings_pots, debts and their links on transactions (4a-2).

const PERMISSION_DENIED = "42501";
const CHECK_VIOLATION = "23514";
const UNIQUE_VIOLATION = "23505";
const FOREIGN_KEY_VIOLATION = "23503";

type Setup = { user: TestUser; periodId: string; category: Record<string, string> };

// A user with a budget, one period (Nov 15–29) and their default categories and pots.
async function setUp(): Promise<Setup> {
  const user = await signUpUser();
  const insert = async (table: string, row: Record<string, unknown>) => {
    const { data, error } = await user.client.from(table).insert(row).select("id").single();
    if (error) throw new Error(`Couldn't create ${table}: ${error.message}`);
    return data.id as string;
  };
  const budgetId = await insert("budgets", { name: "Main budget", frequency: "semi_monthly", pay_day_1: 15, pay_day_2: 30 });
  const periodId = await insert("budget_periods", {
    budget_id: budgetId,
    start_date: "2026-11-15",
    end_date: "2026-11-29",
    pay_slot: "payday_1",
  });
  const { data: categories } = await user.client.from("categories").select("id, name");
  return { user, periodId, category: Object.fromEntries(categories!.map((c) => [c.name, c.id])) };
}

const pot = { name: "Laptop fund", icon: "laptop", color: "blue", target_amount: 4_000_000, planned_contribution: 200_000 };
const debt = {
  name: "SPayLater",
  total_amount: 1_200_000,
  payment_type: "installments",
  num_payments: 3,
  payment_amount: 400_000,
  first_due_date: "2026-11-25",
};

async function create(s: Setup, table: "savings_pots" | "debts", row: Record<string, unknown>) {
  const { data, error } = await s.user.client.from(table).insert(row).select().single();
  if (error) throw new Error(`Couldn't create ${table}: ${error.message}`);
  return data;
}

function transaction(s: Setup, fields: Record<string, unknown>) {
  return { period_id: s.periodId, amount: 100_000, date: "2026-11-20", ...fields };
}

describe("savings_pots", () => {
  it("gives a new user the Emergency Fund and Sinking Funds pots, empty", async () => {
    const s = await setUp();
    const { data } = await s.user.client
      .from("savings_pots")
      .select("name, starting_balance, planned_contribution, target_amount, pay_slot, is_locked")
      .order("name");
    expect(data).toEqual([
      { name: "Emergency Fund", starting_balance: 0, planned_contribution: 0, target_amount: null, pay_slot: "every", is_locked: false },
      { name: "Sinking Funds", starting_balance: 0, planned_contribution: 0, target_amount: null, pay_slot: "every", is_locked: false },
    ]);
  });

  it("adds, edits and deletes a pot", async () => {
    const s = await setUp();
    const row = await create(s, "savings_pots", { ...pot, target_date: "2027-06-01", starting_balance: 500_000 });
    expect(row).toMatchObject({ user_id: s.user.id, pay_slot: "every", is_locked: false });

    const { data: updated } = await s.user.client
      .from("savings_pots")
      .update({ planned_contribution: 300_000, pay_slot: "payday_2", is_locked: true })
      .eq("id", row.id)
      .select()
      .single();
    expect(updated).toMatchObject({ planned_contribution: 300_000, pay_slot: "payday_2", is_locked: true });

    await s.user.client.from("savings_pots").delete().eq("id", row.id);
    const { data } = await s.user.client.from("savings_pots").select("id").eq("id", row.id);
    expect(data).toEqual([]);
  });

  it.each([
    ["an empty name", { name: " " }],
    ["a bad icon name", { icon: "Laptop!" }],
    ["an unknown colour", { color: "pink" }],
    ["a ₱0 target", { target_amount: 0 }],
    ["a target date that isn't the 1st", { target_date: "2027-06-15" }],
    ["a negative starting balance", { starting_balance: -1 }],
    ["a negative contribution", { planned_contribution: -1 }],
    ["a split pay slot", { pay_slot: "split" }],
  ])("rejects %s", async (_label, fields) => {
    const s = await setUp();
    const { error } = await s.user.client.from("savings_pots").insert({ ...pot, ...fields });
    expect(error?.code).toBe(CHECK_VIOLATION);
  });

  it("rejects a name the user already has, ignoring case", async () => {
    const s = await setUp();
    const { error } = await s.user.client.from("savings_pots").insert({ ...pot, name: " emergency fund " });
    expect(error?.code).toBe(UNIQUE_VIOLATION);
  });
});

describe("debts", () => {
  it("adds installments and a one-time debt", async () => {
    const s = await setUp();
    const row = await create(s, "debts", { ...debt, lender: "Shopee", interest_rate: 3.5 });
    expect(row).toMatchObject({ user_id: s.user.id, paid_off_at: null, interest_rate: 3.5 });
    await create(s, "debts", {
      name: "Owe Mama",
      total_amount: 500_000,
      payment_type: "one_time",
      num_payments: 1,
      payment_amount: 500_000,
      first_due_date: "2026-12-15",
    });
  });

  it("edits, marks paid off and deletes a debt", async () => {
    const s = await setUp();
    const row = await create(s, "debts", debt);
    const paidOff = new Date().toISOString();
    const { data } = await s.user.client
      .from("debts")
      .update({ payment_amount: 300_000, paid_off_at: paidOff })
      .eq("id", row.id)
      .select()
      .single();
    expect(data!.payment_amount).toBe(300_000);
    expect(data!.paid_off_at).not.toBeNull();
    await s.user.client.from("debts").delete().eq("id", row.id);
    expect((await s.user.client.from("debts").select("id").eq("id", row.id)).data).toEqual([]);
  });

  it.each([
    ["a ₱0 total", { total_amount: 0 }],
    ["an unknown payment type", { payment_type: "monthly" }],
    ["1 installment", { num_payments: 1 }],
    ["61 installments", { num_payments: 61 }],
    ["a ₱0 payment", { payment_amount: 0 }],
    ["a one-time debt with 2 payments", { payment_type: "one_time", num_payments: 2 }],
    ["a one-time payment that isn't the total", { payment_type: "one_time", num_payments: 1, payment_amount: 400_000 }],
    ["an interest rate over 100", { interest_rate: 101 }],
    ["an empty lender", { lender: " " }],
  ])("rejects %s", async (_label, fields) => {
    const s = await setUp();
    const { error } = await s.user.client.from("debts").insert({ ...debt, ...fields });
    expect(error?.code).toBe(CHECK_VIOLATION);
  });
});

describe("transactions: pot and debt links", () => {
  it("needs a pot on savings and a debt on debt payments", async () => {
    const s = await setUp();
    const savings = await s.user.client
      .from("transactions")
      .insert(transaction(s, { type: "savings", category_id: s.category["Savings pot"] }));
    expect(savings.error?.code).toBe(CHECK_VIOLATION);
    const payment = await s.user.client
      .from("transactions")
      .insert(transaction(s, { type: "debt_payment", category_id: s.category.Bills }));
    expect(payment.error?.code).toBe(CHECK_VIOLATION);
  });

  it("allows a pot only on savings and a debt only on debt payments", async () => {
    const s = await setUp();
    const p = await create(s, "savings_pots", pot);
    const d = await create(s, "debts", debt);
    const withPot = await s.user.client
      .from("transactions")
      .insert(transaction(s, { type: "expense", category_id: s.category.Meals, pot_id: p.id }));
    expect(withPot.error?.code).toBe(CHECK_VIOLATION);
    const withDebt = await s.user.client
      .from("transactions")
      .insert(transaction(s, { type: "expense", category_id: s.category.Meals, debt_id: d.id }));
    expect(withDebt.error?.code).toBe(CHECK_VIOLATION);
  });

  it("can't withdraw from a locked pot, but can add to it", async () => {
    const s = await setUp();
    const locked = await create(s, "savings_pots", { ...pot, is_locked: true });
    const savings = { type: "savings", category_id: s.category["Savings pot"], pot_id: locked.id };
    const add = await s.user.client.from("transactions").insert(transaction(s, savings));
    expect(add.error).toBeNull();
    const withdraw = await s.user.client.from("transactions").insert(transaction(s, { ...savings, amount: -50_000 }));
    expect(withdraw.error?.code).toBe(CHECK_VIOLATION);
  });

  it("deleting a pot or debt keeps its transactions and empties the link", async () => {
    const s = await setUp();
    const p = await create(s, "savings_pots", pot);
    const d = await create(s, "debts", debt);
    const { data: rows, error } = await s.user.client
      .from("transactions")
      .insert([
        transaction(s, { type: "savings", category_id: s.category["Savings pot"], pot_id: p.id }),
        transaction(s, { type: "debt_payment", category_id: s.category.Bills, debt_id: d.id }),
      ])
      .select("id");
    expect(error).toBeNull();

    await s.user.client.from("savings_pots").delete().eq("id", p.id);
    await s.user.client.from("debts").delete().eq("id", d.id);
    const { data: after } = await s.user.client
      .from("transactions")
      .select("pot_id, debt_id, user_id")
      .in("id", rows!.map((r) => r.id));
    expect(after).toHaveLength(2);
    expect(after!.every((r) => r.pot_id === null && r.debt_id === null && r.user_id === s.user.id)).toBe(true);
  });
});

describe("RLS: user A can't reach user B's pots and debts", () => {
  it("can't read, change or delete them", async () => {
    const a = await setUp();
    const b = await setUp();
    const bPot = await create(b, "savings_pots", pot);
    const bDebt = await create(b, "debts", debt);
    for (const [table, id] of [["savings_pots", bPot.id], ["debts", bDebt.id]] as const) {
      expect((await a.user.client.from(table).select("id").eq("id", id)).data).toEqual([]);
      expect((await a.user.client.from(table).update({ name: "Mine now" }).eq("id", id).select("id")).data).toEqual([]);
      await a.user.client.from(table).delete().eq("id", id);
      expect((await b.user.client.from(table).select("name").eq("id", id).single()).data!.name).not.toBe("Mine now");
    }
  });

  it("can't create pots or debts owned by B", async () => {
    const a = await setUp();
    const b = await setUp();
    expect((await a.user.client.from("savings_pots").insert({ ...pot, user_id: b.user.id })).error).not.toBeNull();
    expect((await a.user.client.from("debts").insert({ ...debt, user_id: b.user.id })).error).not.toBeNull();
  });

  it("can't link a transaction to B's pot or debt", async () => {
    const a = await setUp();
    const b = await setUp();
    const bPot = await create(b, "savings_pots", pot);
    const bDebt = await create(b, "debts", debt);
    const toPot = await a.user.client
      .from("transactions")
      .insert(transaction(a, { type: "savings", category_id: a.category["Savings pot"], pot_id: bPot.id }));
    expect(toPot.error?.code).toBe(FOREIGN_KEY_VIOLATION);
    const toDebt = await a.user.client
      .from("transactions")
      .insert(transaction(a, { type: "debt_payment", category_id: a.category.Bills, debt_id: bDebt.id }));
    expect(toDebt.error?.code).toBe(FOREIGN_KEY_VIOLATION);
  });

  it("can't change the owner or timestamps", async () => {
    const s = await setUp();
    const p = await create(s, "savings_pots", pot);
    const d = await create(s, "debts", debt);
    for (const [table, id] of [["savings_pots", p.id], ["debts", d.id]] as const) {
      for (const fields of [{ user_id: s.user.id }, { created_at: new Date().toISOString() }]) {
        expect((await s.user.client.from(table).update(fields).eq("id", id)).error?.code).toBe(PERMISSION_DENIED);
      }
    }
  });
});

describe("logged-out visitors", () => {
  it("can't read or add pots and debts", async () => {
    const anon = anonClient();
    expect((await anon.from("savings_pots").select("id")).data ?? []).toEqual([]);
    expect((await anon.from("debts").select("id")).data ?? []).toEqual([]);
    expect((await anon.from("savings_pots").insert(pot)).error).not.toBeNull();
    expect((await anon.from("debts").insert(debt)).error).not.toBeNull();
  });
});

describe("debts: When I can (flexible, Nov 24)", () => {
  const flexible = { name: "Owe Tita", total_amount: 1_000_000, payment_type: "flexible" };

  it("adds a flexible debt with no schedule, with or without a target month", async () => {
    const s = await setUp();
    const row = await create(s, "debts", flexible);
    expect(row).toMatchObject({ num_payments: null, payment_amount: null, first_due_date: null, target_date: null });
    const aimed = await create(s, "debts", { ...flexible, name: "Owe Kuya", target_date: "2027-06-01" });
    expect(aimed.target_date).toBe("2027-06-01");
  });

  it("edits the target month", async () => {
    const s = await setUp();
    const row = await create(s, "debts", flexible);
    const { data, error } = await s.user.client
      .from("debts")
      .update({ target_date: "2027-03-01" })
      .eq("id", row.id)
      .select("target_date")
      .single();
    expect(error).toBeNull();
    expect(data!.target_date).toBe("2027-03-01");
  });

  it.each([
    ["a flexible debt with payments", { ...flexible, num_payments: 3, payment_amount: 400_000 }],
    ["a flexible debt with a due date", { ...flexible, first_due_date: "2026-12-01" }],
    ["a target that isn't the 1st", { ...flexible, target_date: "2027-06-15" }],
    ["installments with a target month", { ...debt, target_date: "2027-06-01" }],
    ["installments without a due date", { ...debt, first_due_date: null }],
    ["installments without a payment amount", { ...debt, payment_amount: null }],
    ["an unknown payment type", { ...flexible, payment_type: "someday" }],
  ])("rejects %s", async (_label, fields) => {
    const s = await setUp();
    const { error } = await s.user.client.from("debts").insert(fields);
    expect(error?.code).toBe(CHECK_VIOLATION);
  });
});
