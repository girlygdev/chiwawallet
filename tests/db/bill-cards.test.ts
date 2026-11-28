import { describe, expect, it } from "vitest";
import { signUpUser, type TestUser } from "./helpers";

// Bills paid with a credit card (owner, Nov 28; migration
// 20261128100000_bill_cards): recurring_bills.card_id, Mark paid charging the
// card, and closing or deleting a card moving its bills back to Cash.

const CHECK_VIOLATION = "23514";
const FOREIGN_KEY_VIOLATION = "23503";

type Setup = {
  user: TestUser;
  budgetId: string;
  periodId: string;
  bills: string;
  card: string;
};

const CARD = { name: "BPI card", total_amount: 0, payment_type: "card", due_day: 5, pay_slot: "payday_2" };

async function setUp(): Promise<Setup> {
  const user = await signUpUser();
  const insert = async (table: string, row: Record<string, unknown>) => {
    const { data, error } = await user.client.from(table).insert(row).select("id").single();
    if (error) throw new Error(`Couldn't create ${table}: ${error.message}`);
    return data.id as string;
  };
  const budgetId = await insert("budgets", { name: "Main budget", frequency: "semi_monthly", pay_day_1: 15, pay_day_2: 30 });
  const periodId = await insert("budget_periods", { budget_id: budgetId, start_date: "2027-01-15", end_date: "2027-01-29", pay_slot: "payday_1" });
  const { data: category } = await user.client.from("categories").select("id").eq("name", "Bills").single();
  const card = await insert("debts", CARD);
  return { user, budgetId, periodId, bills: category!.id, card };
}

const bill = (s: Setup, extra: Record<string, unknown> = {}) => ({
  budget_id: s.budgetId,
  name: "Netflix",
  amount: 54_900,
  category_id: s.bills,
  frequency: "monthly",
  due_day: 20,
  pay_slot: "payday_1",
  ...extra,
});

async function addBill(s: Setup, extra: Record<string, unknown> = {}) {
  const { data, error } = await s.user.client.from("recurring_bills").insert(bill(s, extra)).select("id").single();
  if (error) throw new Error(`Couldn't add the bill: ${error.message}`);
  return data.id as string;
}

async function payBill(s: Setup, billId: string) {
  const { data: item, error } = await s.user.client
    .from("plan_items")
    .insert({ period_id: s.periodId, name: "Netflix", category_id: s.bills, planned_amount: 54_900, origin: "recurring", bill_id: billId })
    .select("id")
    .single();
  if (error) throw new Error(`Couldn't add the plan item: ${error.message}`);
  const paid = await s.user.client.rpc("mark_plan_item_paid", { target_item: item.id, paid_on: "2027-01-20", paid_amount: 54_900 });
  if (paid.error) throw new Error(`Couldn't mark it paid: ${paid.error.message}`);
  return (await s.user.client.from("transactions").select("type, amount, card_id").eq("id", paid.data).single()).data!;
}

const cardOf = async (s: Setup, billId: string) =>
  (await s.user.client.from("recurring_bills").select("card_id").eq("id", billId).single()).data!.card_id;

describe("recurring_bills.card_id", () => {
  it("is empty (Cash) by default and can be one of the user's open cards", async () => {
    const s = await setUp();
    const cash = await addBill(s);
    expect(await cardOf(s, cash)).toBeNull();
    const onCard = await addBill(s, { name: "Spotify", card_id: s.card });
    expect(await cardOf(s, onCard)).toBe(s.card);
  });

  it("refuses a debt that isn't a card", async () => {
    const s = await setUp();
    const { data: loan } = await s.user.client
      .from("debts")
      .insert({ name: "SPayLater", total_amount: 1_200_000, payment_type: "installments", num_payments: 3, payment_amount: 400_000, first_due_date: "2027-01-20" })
      .select("id")
      .single();
    const { error } = await s.user.client.from("recurring_bills").insert(bill(s, { card_id: loan!.id }));
    expect(error?.code).toBe(CHECK_VIOLATION);
  });

  it("refuses a closed card", async () => {
    const s = await setUp();
    await s.user.client.from("debts").update({ paid_off_at: new Date().toISOString() }).eq("id", s.card);
    const { error } = await s.user.client.from("recurring_bills").insert(bill(s, { card_id: s.card }));
    expect(error?.code).toBe(CHECK_VIOLATION);
  });

  it("refuses someone else's card", async () => {
    const s = await setUp();
    const other = await setUp();
    const { error } = await s.user.client.from("recurring_bills").insert(bill(s, { card_id: other.card }));
    // The same-owner foreign key (or the card check, which can't see it) refuses it.
    expect([FOREIGN_KEY_VIOLATION, CHECK_VIOLATION]).toContain(error?.code);
  });
});

describe("mark_plan_item_paid() for a bill on a card", () => {
  it("charges the card: an expense with card_id", async () => {
    const s = await setUp();
    const payment = await payBill(s, await addBill(s, { card_id: s.card }));
    expect(payment).toEqual({ type: "expense", amount: 54_900, card_id: s.card });
  });

  it("pays a Cash bill in cash, as before", async () => {
    const s = await setUp();
    const payment = await payBill(s, await addBill(s));
    expect(payment).toEqual({ type: "expense", amount: 54_900, card_id: null });
  });
});

describe("closing or deleting a card", () => {
  it("moves its bills back to Cash when it's closed", async () => {
    const s = await setUp();
    const billId = await addBill(s, { card_id: s.card });
    const { error } = await s.user.client.from("debts").update({ paid_off_at: new Date().toISOString() }).eq("id", s.card);
    expect(error).toBeNull();
    expect(await cardOf(s, billId)).toBeNull();
  });

  it("moves its bills back to Cash when it's deleted", async () => {
    const s = await setUp();
    const billId = await addBill(s, { card_id: s.card });
    const { error } = await s.user.client.from("debts").delete().eq("id", s.card);
    expect(error).toBeNull();
    expect(await cardOf(s, billId)).toBeNull();
  });
});
