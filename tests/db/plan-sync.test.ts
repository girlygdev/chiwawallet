import { describe, expect, it } from "vitest";
import type { Budget } from "@/lib/current-budget";
import { syncOpenPeriods } from "@/lib/plan-periods";
import { signUpUser, type TestUser } from "./helpers";

// syncOpenPeriods() (5h-1) against local Supabase: open periods follow
// their sources; edited, paid and ended items don't.

// Before the period (Jan 15–29, 2027) ends, and after.
const OPEN = "2027-01-01";
const ENDED = "2027-02-01";

type Setup = { user: TestUser; budget: Budget; periodId: string; billId: string };

// A user with a twice-a-month budget, one period (Jan 15–29, 2027) and
// Meralco (₱2,500, due the 20th, paid from the 15th).
async function setUp(): Promise<Setup> {
  const user = await signUpUser();
  const insert = async (table: string, row: Record<string, unknown>) => {
    const { data, error } = await user.client.from(table).insert(row).select("id").single();
    if (error) throw new Error(`Couldn't create ${table}: ${error.message}`);
    return data.id as string;
  };
  const budgetId = await insert("budgets", { name: "Main budget", frequency: "semi_monthly", pay_day_1: 15, pay_day_2: 30 });
  const periodId = await insert("budget_periods", { budget_id: budgetId, start_date: "2027-01-15", end_date: "2027-01-29", pay_slot: "payday_1" });
  const { data: bills } = await user.client.from("categories").select("id").eq("name", "Bills").single();
  const billId = await insert("recurring_bills", {
    budget_id: budgetId, name: "Meralco", amount: 250_000, category_id: bills!.id, frequency: "monthly", due_day: 20, pay_slot: "payday_1",
  });
  const { data: budget } = await user.client.from("budgets").select("*").eq("id", budgetId).single();
  return { user, budget: budget as Budget, periodId, billId };
}

// The test clients aren't typed with the generated Database types; the app's are.
const sync = (s: Setup, today = OPEN) => syncOpenPeriods(s.user.client as never, s.budget, today);
const changeBill = (s: Setup, fields: Record<string, unknown>) =>
  s.user.client.from("recurring_bills").update(fields).eq("id", s.billId);

async function meralco(s: Setup) {
  const { data } = await s.user.client
    .from("plan_items")
    .select("id, name, planned_amount, edited, deleted_at")
    .eq("period_id", s.periodId)
    .eq("bill_id", s.billId);
  return data!;
}

describe("syncOpenPeriods", () => {
  it("adds a new bill's item, then follows its amount and name", async () => {
    const s = await setUp();
    await sync(s);
    expect(await meralco(s)).toMatchObject([{ planned_amount: 250_000, deleted_at: null }]);

    await changeBill(s, { amount: 300_000, name: "Meralco (house)" });
    await sync(s);
    expect(await meralco(s)).toMatchObject([{ name: "Meralco (house)", planned_amount: 300_000, deleted_at: null }]);
  });

  it("takes the item out when the bill moves to the other payday, and brings it back", async () => {
    const s = await setUp();
    await sync(s);
    await changeBill(s, { pay_slot: "payday_2" });
    await sync(s);
    const [removed] = await meralco(s);
    expect(removed.deleted_at).not.toBeNull();
    expect(removed.edited).toBe(false);

    await changeBill(s, { pay_slot: "payday_1", amount: 280_000 });
    await sync(s);
    expect(await meralco(s)).toMatchObject([{ id: removed.id, planned_amount: 280_000, deleted_at: null }]);
  });

  it("leaves items edited by hand, and ones you removed, alone", async () => {
    const s = await setUp();
    await sync(s);
    const [item] = await meralco(s);
    await s.user.client.from("plan_items").update({ planned_amount: 260_000, edited: true }).eq("id", item.id);
    await changeBill(s, { amount: 300_000 });
    await sync(s);
    expect(await meralco(s)).toMatchObject([{ planned_amount: 260_000, deleted_at: null }]);

    // Removed by hand (5e marks it edited): stays removed.
    await s.user.client.from("plan_items").update({ deleted_at: new Date().toISOString() }).eq("id", item.id);
    await sync(s);
    expect((await meralco(s))[0].deleted_at).not.toBeNull();
  });

  it("never changes a period that has ended", async () => {
    const s = await setUp();
    await sync(s);
    await changeBill(s, { amount: 300_000 });
    await sync(s, ENDED);
    expect(await meralco(s)).toMatchObject([{ planned_amount: 250_000 }]);
  });
});
