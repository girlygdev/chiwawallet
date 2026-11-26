import { describe, expect, it } from "vitest";
import type { Budget } from "@/lib/current-budget";
import { closeEndedPeriods } from "@/lib/plan-periods";
import { signUpUser, type TestUser } from "./helpers";

// closeEndedPeriods() (6h-1) against local Supabase: test data across three
// periods gives the right carry-over (week-6-tasks.md "Done when").

// After all three periods below have ended.
const TODAY = "2027-03-01";

type Setup = { user: TestUser; budgetId: string; ids: string[] };

// A budget with a ₱3,000 opening balance and three periods:
//   Jan 15–29:       ₱25,000 in, ₱20,000 out → ₱3,000 + ₱5,000 = ₱8,000 left
//   Jan 30 – Feb 14: ₱25,000 in, ₱36,000 out → ₱8,000 − ₱11,000 = −₱3,000 (overspent)
//   Feb 15–27:       ₱25,000 in, ₱22,000 out → −₱3,000 + ₱3,000 = ₱0
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
    opening_balance: 300_000,
  });
  const { data: categories } = await user.client.from("categories").select("id, name");
  const category = Object.fromEntries(categories!.map((c) => [c.name, c.id]));
  const periods: [string, string, string, number][] = [
    ["2027-01-15", "2027-01-29", "payday_1", 2_000_000],
    ["2027-01-30", "2027-02-14", "payday_2", 3_600_000],
    ["2027-02-15", "2027-02-27", "payday_1", 2_200_000],
  ];
  const ids: string[] = [];
  for (const [start_date, end_date, pay_slot, spent] of periods) {
    const id = await insert("budget_periods", { budget_id: budgetId, start_date, end_date, pay_slot });
    ids.push(id);
    await insert("transactions", { period_id: id, category_id: category.Income, type: "income", amount: 2_500_000, date: start_date });
    await insert("transactions", { period_id: id, category_id: category.Bills, type: "expense", amount: spent, date: start_date });
  }
  return { user, budgetId, ids };
}

const budgetOf = async (s: Setup) =>
  (await s.user.client.from("budgets").select("*").eq("id", s.budgetId).single()).data as Budget;

// The test clients aren't typed with the generated Database types; the app's are.
const close = async (s: Setup, today = TODAY, client = s.user.client) =>
  closeEndedPeriods(client as never, await budgetOf(s), today);

async function periods(s: Setup) {
  const { data } = await s.user.client
    .from("budget_periods")
    .select("start_date, carried_in, leftover_choice, closed_at")
    .eq("budget_id", s.budgetId)
    .order("start_date");
  return data!.map((p) => ({ ...p, closed: p.closed_at != null }));
}

describe("closeEndedPeriods", () => {
  it("closes missed periods in order with Carry, each carrying its leftover; the latest waits", async () => {
    const s = await setUp();
    const result = await close(s);
    expect(result.awaiting).toBe(s.ids[2]);
    expect((await periods(s)).map(({ start_date, carried_in, leftover_choice, closed }) => ({ start_date, carried_in, leftover_choice, closed }))).toEqual([
      { start_date: "2027-01-15", carried_in: 0, leftover_choice: "carry", closed: true },
      { start_date: "2027-01-30", carried_in: 800_000, leftover_choice: "carry", closed: true },
      // Waiting for the payday screen; its carry-in is the overspend.
      { start_date: "2027-02-15", carried_in: -300_000, leftover_choice: null, closed: false },
    ]);
  });

  it("with Ask on payday off, the latest closes too, and the next period starts from its leftover", async () => {
    const s = await setUp();
    await s.user.client.from("budgets").update({ ask_on_payday: false }).eq("id", s.budgetId);
    expect((await close(s)).awaiting).toBeNull();
    const all = await periods(s);
    expect(all.map((p) => p.closed)).toEqual([true, true, true, false]);
    // Feb 28 – Mar 14 was created (no Feb 30th: payday falls on the 28th) and carries Feb 15–27's ₱0.
    expect(all[3]).toMatchObject({ start_date: "2027-02-28", carried_in: 0, closed: false });
  });

  it("does nothing the second time", async () => {
    const s = await setUp();
    await close(s);
    const first = await periods(s);
    await close(s);
    expect(await periods(s)).toEqual(first);
  });

  it("never closes a period that hasn't ended", async () => {
    const s = await setUp();
    expect(await close(s, "2027-01-20")).toEqual({ awaiting: null });
    expect((await periods(s)).every((p) => !p.closed)).toBe(true);
  });

  it("only touches the caller's own periods", async () => {
    const a = await setUp();
    const b = await signUpUser();
    // B runs it with A's budget row: RLS hides A's periods from B.
    await close(a, TODAY, b.client);
    expect((await periods(a)).every((p) => !p.closed)).toBe(true);
  });
});
