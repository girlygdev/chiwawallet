import { beforeAll, describe, expect, it } from "vitest";
import { getOrCreatePeriod } from "@/lib/budget-periods";
import { signUpUser, type TestUser } from "./helpers";

// getOrCreatePeriod() against local Supabase: the first open creates the
// period, every later open (or a second tab at the same moment) reuses it.

async function createBudget(user: TestUser, fields: Record<string, unknown> = {}) {
  const { data, error } = await user.client
    .from("budgets")
    .insert({ name: "Main budget", frequency: "semi_monthly", pay_day_1: 15, pay_day_2: 30, ...fields })
    .select()
    .single();
  if (error) throw new Error(`Couldn't create budget: ${error.message}`);
  return data;
}

async function countPeriods(user: TestUser, budgetId: string) {
  const { count } = await user.client
    .from("budget_periods")
    .select("id", { count: "exact", head: true })
    .eq("budget_id", budgetId);
  return count;
}

describe("getOrCreatePeriod", () => {
  let user: TestUser;
  beforeAll(async () => {
    user = await signUpUser();
  });

  it("creates the period that contains the date", async () => {
    const budget = await createBudget(user);
    const period = await getOrCreatePeriod(user.client, budget, "2026-11-19");
    expect(period).toMatchObject({
      budget_id: budget.id,
      user_id: user.id,
      start_date: "2026-11-15",
      end_date: "2026-11-29",
      pay_slot: "payday_1",
      carried_in: 0,
      first_pay_received: false,
    });
  });

  it("opening it again returns the same row", async () => {
    const budget = await createBudget(user);
    const first = await getOrCreatePeriod(user.client, budget, "2026-11-19");
    const again = await getOrCreatePeriod(user.client, budget, "2026-11-19");
    const laterSamePeriod = await getOrCreatePeriod(user.client, budget, "2026-11-29");
    expect(again.id).toBe(first.id);
    expect(laterSamePeriod.id).toBe(first.id);
    expect(await countPeriods(user, budget.id)).toBe(1);
  });

  it("two tabs opening at the same moment still make one row", async () => {
    const budget = await createBudget(user);
    const results = await Promise.all(
      Array.from({ length: 5 }, () => getOrCreatePeriod(user.client, budget, "2026-11-19")),
    );
    expect(new Set(results.map((p) => p.id)).size).toBe(1);
    expect(await countPeriods(user, budget.id)).toBe(1);
  });

  it("the next payday starts a new period", async () => {
    const budget = await createBudget(user);
    await getOrCreatePeriod(user.client, budget, "2026-11-19");
    const next = await getOrCreatePeriod(user.client, budget, "2026-11-30");
    expect(next).toMatchObject({ start_date: "2026-11-30", end_date: "2026-12-14", pay_slot: "payday_2" });
    expect(await countPeriods(user, budget.id)).toBe(2);
  });

  it("weekly budgets", async () => {
    const budget = await createBudget(user, {
      frequency: "weekly",
      pay_day_1: null,
      pay_day_2: null,
      pay_weekday: 1,
    });
    const period = await getOrCreatePeriod(user.client, budget, "2026-11-19");
    expect(period).toMatchObject({ start_date: "2026-11-16", end_date: "2026-11-22", pay_slot: "every" });
  });

  it("can't create a period on another user's budget", async () => {
    const other = await signUpUser();
    const theirBudget = await createBudget(other);
    await expect(getOrCreatePeriod(user.client, theirBudget, "2026-11-19")).rejects.toThrow();
    expect(await countPeriods(other, theirBudget.id)).toBe(0);
  });
});
