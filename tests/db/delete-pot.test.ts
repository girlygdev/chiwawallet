import { describe, expect, it } from "vitest";
import { anonClient, signUpUser, type TestUser } from "./helpers";

// delete_pot(): move the balance to another pot or count it as withdrawn,
// then delete the pot, in one database transaction (4d-3).

const NO_DATA = "P0002";
const INVALID_PARAMETER = "22023";

type Setup = { user: TestUser; periodId: string; savingsCategory: string };

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
  const { data: category } = await user.client.from("categories").select("id").eq("system_key", "savings_pot").single();
  return { user, periodId, savingsCategory: category!.id };
}

async function newPot(s: Setup, name: string, fields: Record<string, unknown> = {}) {
  const { data, error } = await s.user.client
    .from("savings_pots")
    .insert({ name, icon: "plane", color: "purple", ...fields })
    .select("id")
    .single();
  if (error) throw new Error(`Couldn't create pot: ${error.message}`);
  return data.id as string;
}

async function deposit(s: Setup, potId: string, amount: number) {
  const { data, error } = await s.user.client
    .from("transactions")
    .insert({ period_id: s.periodId, category_id: s.savingsCategory, type: "savings", amount, date: "2026-11-16", pot_id: potId })
    .select("id")
    .single();
  if (error) throw new Error(`Couldn't deposit: ${error.message}`);
  return data.id as string;
}

// Starting balance + live transactions, like potBalance().
async function balanceOf(s: Setup, potId: string) {
  const { data: pot } = await s.user.client.from("savings_pots").select("starting_balance").eq("id", potId).single();
  const { data: rows } = await s.user.client.from("transactions").select("amount").eq("pot_id", potId).is("deleted_at", null);
  return pot!.starting_balance + rows!.reduce((sum, r) => sum + r.amount, 0);
}

const exists = async (s: Setup, id: string) =>
  ((await s.user.client.from("savings_pots").select("id").eq("id", id)).data ?? []).length === 1;

const call = (s: Setup, target_pot: string, choice: string | null, move_to: string | null = null) =>
  s.user.client.rpc("delete_pot", { target_pot, choice, move_to, on_period: s.periodId, on_date: "2026-11-20" });

describe("delete_pot", () => {
  it("moves the balance to another pot: a withdrawal and a deposit, net ₱0", async () => {
    const s = await setUp();
    const travel = await newPot(s, "Travel", { starting_balance: 400_000 });
    const emergency = await newPot(s, "Rainy day");
    await deposit(s, travel, 200_000);
    // A deleted deposit doesn't count.
    const gone = await deposit(s, travel, 999_900);
    await s.user.client.from("transactions").update({ deleted_at: new Date().toISOString() }).eq("id", gone);

    const { data, error } = await call(s, travel, "move", emergency);
    expect(error).toBeNull();
    expect(data).toBe(600_000);
    expect(await exists(s, travel)).toBe(false);
    expect(await balanceOf(s, emergency)).toBe(600_000);

    // The move itself nets to ₱0 across today's two rows.
    const { data: moved } = await s.user.client
      .from("transactions")
      .select("amount, note, pot_id")
      .eq("date", "2026-11-20")
      .order("amount");
    expect(moved).toEqual([
      { amount: -600_000, note: "Moved to Rainy day", pot_id: null },
      { amount: 600_000, note: "Moved from Travel", pot_id: emergency },
    ]);
  });

  it("counts the balance as withdrawn", async () => {
    const s = await setUp();
    const travel = await newPot(s, "Travel");
    await deposit(s, travel, 300_000);
    const { data, error } = await call(s, travel, "withdraw");
    expect(error).toBeNull();
    expect(data).toBe(300_000);
    expect(await exists(s, travel)).toBe(false);
    const { data: rows } = await s.user.client.from("transactions").select("amount, note").eq("date", "2026-11-20");
    expect(rows).toEqual([{ amount: -300_000, note: "Travel closed" }]);
  });

  it("withdraws from a locked pot (the app asks first)", async () => {
    const s = await setUp();
    const mp2 = await newPot(s, "MP2", { starting_balance: 4_850_000, is_locked: true });
    const { data, error } = await call(s, mp2, "withdraw");
    expect(error).toBeNull();
    expect(data).toBe(4_850_000);
    expect(await exists(s, mp2)).toBe(false);
  });

  it("deletes an empty pot without a choice, writing nothing", async () => {
    const s = await setUp();
    const empty = await newPot(s, "Someday");
    const { data, error } = await call(s, empty, null);
    expect(error).toBeNull();
    expect(data).toBe(0);
    expect(await exists(s, empty)).toBe(false);
    expect((await s.user.client.from("transactions").select("id")).data).toEqual([]);
  });

  it("needs a choice and a real destination, and changes nothing without them", async () => {
    const s = await setUp();
    const travel = await newPot(s, "Travel", { starting_balance: 100_000 });
    for (const [choice, moveTo] of [
      [null, null],
      ["spend", null],
      ["move", null],
      ["move", travel],
    ] as const) {
      const { error } = await call(s, travel, choice, moveTo);
      expect(error?.code).toBe(INVALID_PARAMETER);
    }
    expect(await exists(s, travel)).toBe(true);
    expect((await s.user.client.from("transactions").select("id")).data).toEqual([]);
  });

  it("past deposits stay, with the pot link emptied", async () => {
    const s = await setUp();
    const travel = await newPot(s, "Travel");
    const row = await deposit(s, travel, 200_000);
    await call(s, travel, "withdraw");
    const { data } = await s.user.client.from("transactions").select("pot_id, amount").eq("id", row).single();
    expect(data).toEqual({ pot_id: null, amount: 200_000 });
  });
});

describe("RLS: user A can't use delete_pot on user B", () => {
  it("can't delete B's pot", async () => {
    const a = await setUp();
    const b = await setUp();
    const bPot = await newPot(b, "Travel", { starting_balance: 100_000 });
    const { error } = await call(a, bPot, "withdraw");
    expect(error?.code).toBe(NO_DATA);
    expect(await exists(b, bPot)).toBe(true);
  });

  it("can't move their money into B's pot", async () => {
    const a = await setUp();
    const b = await setUp();
    const aPot = await newPot(a, "Travel", { starting_balance: 100_000 });
    const bPot = await newPot(b, "Travel");
    const { error } = await call(a, aPot, "move", bPot);
    expect(error?.code).toBe(INVALID_PARAMETER);
    expect(await exists(a, aPot)).toBe(true);
    expect(await balanceOf(b, bPot)).toBe(0);
  });
});

describe("logged-out visitors", () => {
  it("can't call it", async () => {
    const s = await setUp();
    const pot = await newPot(s, "Travel");
    const { error } = await anonClient().rpc("delete_pot", {
      target_pot: pot,
      choice: "withdraw",
      move_to: null,
      on_period: s.periodId,
      on_date: "2026-11-20",
    });
    expect(error).not.toBeNull();
    expect(await exists(s, pot)).toBe(true);
  });
});
