import { describe, expect, it } from "vitest";
import { signUpUser, type TestUser } from "./helpers";

// Credit cards (Week 8 task 8b-1, owner Nov 27): a `card` debt type and
// `transactions.card_id`, set on expenses paid with a card (charges) and,
// filled in by the database, on payments to a card.

const CHECK_VIOLATION = "23514";
const FOREIGN_KEY_VIOLATION = "23503";

type Setup = { user: TestUser; periodId: string; category: Record<string, string> };

// A user with a budget, one period (Nov 15–29) and their default categories.
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

const card = { name: "BPI card", total_amount: 0, payment_type: "card", due_day: 5, pay_slot: "payday_2" };
const loan = {
  name: "SPayLater",
  total_amount: 1_200_000,
  payment_type: "installments",
  num_payments: 3,
  payment_amount: 400_000,
  first_due_date: "2026-11-25",
};

async function addDebt(s: Setup, row: Record<string, unknown>) {
  const { data, error } = await s.user.client.from("debts").insert(row).select().single();
  if (error) throw new Error(`Couldn't create the debt: ${error.message}`);
  return data;
}

const tx = (s: Setup, fields: Record<string, unknown>) => ({ period_id: s.periodId, amount: 120_000, date: "2026-11-20", ...fields });

describe("card debts", () => {
  it("can start at ₱0 and needs a due day and a payday, but no schedule", async () => {
    const s = await setUp();
    const saved = await addDebt(s, card);
    expect(saved).toMatchObject({ payment_type: "card", total_amount: 0, due_day: 5, pay_slot: "payday_2", num_payments: null });

    const bads: Record<string, unknown>[] = [
      { ...card, due_day: null },
      { ...card, pay_slot: null },
      { ...card, due_day: 32 },
      { ...card, pay_slot: "split" },
      { ...card, num_payments: 3, payment_amount: 400_000, first_due_date: "2026-12-05" },
      { ...card, target_date: "2027-06-01" },
      { ...card, total_amount: -1 },
    ];
    for (const bad of bads) {
      const { error } = await s.user.client.from("debts").insert(bad);
      expect(error?.code, JSON.stringify(bad)).toBe(CHECK_VIOLATION);
    }
  });

  it("keeps the other types as they were: above ₱0, and no due day or payday", async () => {
    const s = await setUp();
    expect((await s.user.client.from("debts").insert({ ...loan, total_amount: 0 })).error?.code).toBe(CHECK_VIOLATION);
    expect((await s.user.client.from("debts").insert({ ...loan, due_day: 5 })).error?.code).toBe(CHECK_VIOLATION);
    expect((await s.user.client.from("debts").insert({ ...loan, pay_slot: "every" })).error?.code).toBe(CHECK_VIOLATION);
    await addDebt(s, loan);
  });

  it("can't turn into another type of debt, or another debt into a card", async () => {
    const s = await setUp();
    const c = await addDebt(s, card);
    const l = await addDebt(s, loan);
    const toLoan = await s.user.client
      .from("debts")
      .update({ payment_type: "flexible", due_day: null, pay_slot: null })
      .eq("id", c.id);
    expect(toLoan.error?.code).toBe(CHECK_VIOLATION);
    const toCard = await s.user.client
      .from("debts")
      .update({ payment_type: "card", num_payments: null, payment_amount: null, first_due_date: null, due_day: 5, pay_slot: "every" })
      .eq("id", l.id);
    expect(toCard.error?.code).toBe(CHECK_VIOLATION);
  });

  it("lets the due day and payday change", async () => {
    const s = await setUp();
    const c = await addDebt(s, card);
    const { error } = await s.user.client.from("debts").update({ due_day: 31, pay_slot: "every" }).eq("id", c.id);
    expect(error).toBeNull();
  });
});

describe("transactions.card_id", () => {
  it("marks an expense as paid with a card", async () => {
    const s = await setUp();
    const c = await addDebt(s, card);
    const { data, error } = await s.user.client
      .from("transactions")
      .insert(tx(s, { type: "expense", category_id: s.category.Groceries, card_id: c.id }))
      .select("card_id")
      .single();
    expect(error).toBeNull();
    expect(data!.card_id).toBe(c.id);
  });

  it("fills itself in on a payment to a card, and only then", async () => {
    const s = await setUp();
    const c = await addDebt(s, card);
    const l = await addDebt(s, loan);
    const pay = (debtId: string) =>
      s.user.client
        .from("transactions")
        .insert(tx(s, { type: "debt_payment", category_id: s.category["Debt payment"], debt_id: debtId }))
        .select("card_id")
        .single();
    expect((await pay(c.id)).data!.card_id).toBe(c.id);
    expect((await pay(l.id)).data!.card_id).toBeNull();
  });

  it("only goes on expenses and debt payments, and only points to a card", async () => {
    const s = await setUp();
    const c = await addDebt(s, card);
    const l = await addDebt(s, loan);
    const income = await s.user.client.from("transactions").insert(tx(s, { type: "income", category_id: s.category.Income, card_id: c.id }));
    expect(income.error?.code).toBe(CHECK_VIOLATION);
    const notACard = await s.user.client
      .from("transactions")
      .insert(tx(s, { type: "expense", category_id: s.category.Groceries, card_id: l.id }));
    expect(notACard.error?.code).toBe(CHECK_VIOLATION);
    // A payment to the loan can't say it went to the card.
    const mixed = await s.user.client
      .from("transactions")
      .insert(tx(s, { type: "debt_payment", category_id: s.category["Debt payment"], debt_id: l.id, card_id: c.id }));
    expect(mixed.error?.code).toBe(CHECK_VIOLATION);
  });

  it("can be switched on an existing expense (cash ↔ card)", async () => {
    const s = await setUp();
    const c = await addDebt(s, card);
    const { data: row } = await s.user.client
      .from("transactions")
      .insert(tx(s, { type: "expense", category_id: s.category.Groceries }))
      .select("id")
      .single();
    expect((await s.user.client.from("transactions").update({ card_id: c.id }).eq("id", row!.id)).error).toBeNull();
    expect((await s.user.client.from("transactions").update({ card_id: null }).eq("id", row!.id)).error).toBeNull();
  });

  it("keeps a card with charges or payments from being deleted (its history would turn into cash)", async () => {
    const s = await setUp();
    const used = await addDebt(s, card);
    const unused = await addDebt(s, { ...card, name: "Spare card" });
    await s.user.client.from("transactions").insert(tx(s, { type: "expense", category_id: s.category.Groceries, card_id: used.id }));
    const { error } = await s.user.client.from("debts").delete().eq("id", used.id);
    expect(error?.code).toBe(FOREIGN_KEY_VIOLATION);
    expect((await s.user.client.from("debts").delete().eq("id", unused.id)).error).toBeNull();
  });

  it("can't charge someone else's card, and doesn't show their charges", async () => {
    const a = await setUp();
    const b = await setUp();
    const bCard = await addDebt(b, card);
    await b.user.client.from("transactions").insert(tx(b, { type: "expense", category_id: b.category.Groceries, card_id: bCard.id }));

    const charge = await a.user.client
      .from("transactions")
      .insert(tx(a, { type: "expense", category_id: a.category.Groceries, card_id: bCard.id }));
    expect(charge.error).not.toBeNull();
    const { data: seen } = await a.user.client.from("transactions").select("id").eq("card_id", bCard.id);
    expect(seen).toEqual([]);
    const { data: cards } = await a.user.client.from("debts").select("id").eq("id", bCard.id);
    expect(cards).toEqual([]);
  });
});
