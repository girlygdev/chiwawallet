import { describe, expect, it } from "vitest";
import { anonClient, signUpUser, type TestUser } from "./helpers";

// delete_category(): move a category's transactions, then delete it, in one
// database transaction (3h-2).

const PERMISSION_DENIED = "42501";
const NO_DATA = "P0002";
const INVALID_PARAMETER = "22023";

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
  const category = Object.fromEntries(categories!.map((c) => [c.name, c.id]));
  return { user, periodId, category };
}

async function newCategory(s: Setup, name = "Pet food") {
  const { data, error } = await s.user.client
    .from("categories")
    .insert({ name, kind: "expense", budget_group: "needs", icon: "paw-print", color: "orange" })
    .select("id")
    .single();
  if (error) throw new Error(`Couldn't create category: ${error.message}`);
  return data.id as string;
}

async function spend(s: Setup, categoryId: string) {
  const { data, error } = await s.user.client
    .from("transactions")
    .insert({ period_id: s.periodId, category_id: categoryId, type: "expense", amount: 18_000, date: "2026-11-20" })
    .select("id")
    .single();
  if (error) throw new Error(`Couldn't create transaction: ${error.message}`);
  return data.id as string;
}

const exists = async (s: Setup, id: string) =>
  ((await s.user.client.from("categories").select("id").eq("id", id)).data ?? []).length === 1;

describe("delete_category", () => {
  it("deletes an unused category without a destination", async () => {
    const s = await setUp();
    const pet = await newCategory(s);
    const { data, error } = await s.user.client.rpc("delete_category", { target_category: pet });
    expect(error).toBeNull();
    expect(data).toBe(0);
    expect(await exists(s, pet)).toBe(false);
  });

  it("moves every transaction, soft-deleted ones too, then deletes", async () => {
    const s = await setUp();
    const pet = await newCategory(s);
    const live = await spend(s, pet);
    // Soft-deleted like the app does it (deleted_at can't be set on insert).
    const deleted = await spend(s, pet);
    await s.user.client.from("transactions").update({ deleted_at: new Date().toISOString() }).eq("id", deleted);

    const { data, error } = await s.user.client.rpc("delete_category", { target_category: pet, move_to: s.category.Meals });
    expect(error).toBeNull();
    expect(data).toBe(2);
    expect(await exists(s, pet)).toBe(false);
    const { data: rows } = await s.user.client.from("transactions").select("id, category_id").in("id", [live, deleted]);
    expect(rows!.every((r) => r.category_id === s.category.Meals)).toBe(true);
  });

  it("moves bills too, and needs a destination for them (4a-1)", async () => {
    const s = await setUp();
    const pet = await newCategory(s);
    const { data: budget } = await s.user.client.from("budgets").select("id").single();
    const { data: vet } = await s.user.client
      .from("recurring_bills")
      .insert({ budget_id: budget!.id, name: "Vet plan", amount: 50_000, category_id: pet, frequency: "monthly", due_day: 5, pay_slot: "payday_1" })
      .select("id")
      .single();

    // Only a bill uses it, and still a destination is needed.
    const missing = await s.user.client.rpc("delete_category", { target_category: pet });
    expect(missing.error?.code).toBe(INVALID_PARAMETER);

    const { data, error } = await s.user.client.rpc("delete_category", { target_category: pet, move_to: s.category.Meals });
    expect(error).toBeNull();
    expect(data).toBe(0); // transactions moved
    expect(await exists(s, pet)).toBe(false);
    const { data: moved } = await s.user.client.from("recurring_bills").select("category_id").eq("id", vet!.id).single();
    expect(moved!.category_id).toBe(s.category.Meals);
  });

  it("needs a destination when transactions use the category, and changes nothing without one", async () => {
    const s = await setUp();
    const pet = await newCategory(s);
    const row = await spend(s, pet);

    for (const move_to of [undefined, pet, s.category["Savings pot"], s.category.Income]) {
      const { error } = await s.user.client.rpc("delete_category", { target_category: pet, move_to });
      expect(error?.code).toBe(INVALID_PARAMETER);
    }
    expect(await exists(s, pet)).toBe(true);
    const { data } = await s.user.client.from("transactions").select("category_id").eq("id", row).single();
    expect(data!.category_id).toBe(pet);
  });

  it("can't delete a system category", async () => {
    const s = await setUp();
    const { error } = await s.user.client.rpc("delete_category", {
      target_category: s.category["Savings pot"],
      move_to: s.category.Meals,
    });
    expect(error?.code).toBe(PERMISSION_DENIED);
    expect(await exists(s, s.category["Savings pot"])).toBe(true);
  });

  it("says when the category is gone", async () => {
    const s = await setUp();
    const pet = await newCategory(s);
    await s.user.client.rpc("delete_category", { target_category: pet });
    const { error } = await s.user.client.rpc("delete_category", { target_category: pet });
    expect(error?.code).toBe(NO_DATA);
  });
});

describe("RLS: user A can't use delete_category on user B", () => {
  it("can't delete B's category", async () => {
    const a = await setUp();
    const b = await setUp();
    const bPet = await newCategory(b);
    const { error } = await a.user.client.rpc("delete_category", { target_category: bPet });
    expect(error?.code).toBe(NO_DATA);
    expect(await exists(b, bPet)).toBe(true);
  });

  it("can't move their transactions into B's category", async () => {
    const a = await setUp();
    const b = await setUp();
    const aPet = await newCategory(a);
    await spend(a, aPet);
    const { error } = await a.user.client.rpc("delete_category", { target_category: aPet, move_to: b.category.Meals });
    expect(error?.code).toBe(INVALID_PARAMETER);
    expect(await exists(a, aPet)).toBe(true);
  });
});

describe("logged-out visitors", () => {
  it("can't call it", async () => {
    const s = await setUp();
    const pet = await newCategory(s);
    const { error } = await anonClient().rpc("delete_category", { target_category: pet });
    expect(error).not.toBeNull();
    expect(await exists(s, pet)).toBe(true);
  });
});
