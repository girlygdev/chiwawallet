import { beforeAll, describe, expect, it } from "vitest";
import { anonClient, signUpUser, type TestUser } from "./helpers";

// Postgres error codes the tests expect.
const PERMISSION_DENIED = "42501";
const CHECK_VIOLATION = "23514";
const UNIQUE_VIOLATION = "23505";

const custom = { name: "Pet food", kind: "expense", budget_group: "needs", icon: "paw-print", color: "orange" };

async function createCategory(user: TestUser, fields: Record<string, unknown> = {}) {
  const { data, error } = await user.client
    .from("categories")
    .insert({ ...custom, ...fields })
    .select()
    .single();
  if (error) throw new Error(`Couldn't create category: ${error.message}`);
  return data;
}

async function systemCategory(user: TestUser, key: string) {
  const { data, error } = await user.client.from("categories").select().eq("system_key", key).single();
  if (error) throw new Error(`No ${key} category: ${error.message}`);
  return data;
}

describe("categories: defaults at sign-up", () => {
  it("gives a new user the 19 default categories", async () => {
    const user = await signUpUser();
    const { data } = await user.client
      .from("categories")
      .select("name, kind, budget_group, system_key, user_id, default_budget");

    expect(data).toHaveLength(19);
    expect(data!.every((c) => c.user_id === user.id && c.default_budget === null)).toBe(true);

    const names = (group: string | null) =>
      data!.filter((c) => c.budget_group === group && !c.system_key).map((c) => c.name).sort();
    expect(names("needs")).toEqual(["Bills", "Groceries", "Health", "Load & data", "Market", "Meals", "Padala", "Rent", "Transport"]);
    expect(names("wants")).toEqual(["Dining out", "Fun", "Gifts", "Personal", "Shopping", "Subscriptions", "Travel"]);

    const system = data!.filter((c) => c.system_key).map(({ name, kind, budget_group, system_key }) => ({
      name,
      kind,
      budget_group,
      system_key,
    }));
    expect(system).toEqual(
      expect.arrayContaining([
        { name: "Income", kind: "income", budget_group: null, system_key: "income" },
        { name: "Savings pot", kind: "expense", budget_group: "savings_debt", system_key: "savings_pot" },
        { name: "Extra debt payment", kind: "expense", budget_group: "savings_debt", system_key: "extra_debt" },
      ]),
    );
    expect(system).toHaveLength(3);
  });

  it("still creates the profile", async () => {
    const user = await signUpUser({ display_name: "Ana" });
    const { data } = await user.client.from("profiles").select("display_name").single();
    expect(data?.display_name).toBe("Ana");
  });
});

describe("categories: owner's own rows", () => {
  it("adds, edits and deletes a custom category", async () => {
    const user = await signUpUser();
    const category = await createCategory(user, { default_budget: 150_000 });
    expect(category).toMatchObject({ user_id: user.id, system_key: null, default_budget: 150_000 });

    const { data: updated } = await user.client
      .from("categories")
      .update({ name: "Pets", budget_group: "wants", icon: "dog", color: "blue" })
      .eq("id", category.id)
      .select()
      .single();
    expect(updated).toMatchObject({ name: "Pets", budget_group: "wants", icon: "dog", color: "blue" });
    expect(updated!.updated_at > category.updated_at).toBe(true);

    await user.client.from("categories").delete().eq("id", category.id);
    const { data: left } = await user.client.from("categories").select("id").eq("id", category.id);
    expect(left).toEqual([]);
  });

  it("allows a custom income category with no group", async () => {
    const user = await signUpUser();
    const category = await createCategory(user, { name: "Side gig", kind: "income", budget_group: null });
    expect(category).toMatchObject({ kind: "income", budget_group: null });
  });

  it("can't change a category's kind", async () => {
    const user = await signUpUser();
    const category = await createCategory(user);
    const { error } = await user.client
      .from("categories")
      .update({ kind: "income", budget_group: null })
      .eq("id", category.id);
    expect(error?.code).toBe(PERMISSION_DENIED);
  });
});

describe("categories: checks reject bad data", () => {
  let user: TestUser;
  beforeAll(async () => {
    user = await signUpUser();
  });

  it.each([
    ["an expense with no group", { budget_group: null }],
    ["an income category with a group", { kind: "income", budget_group: "needs" }],
    ["an unknown kind", { kind: "transfer" }],
    ["an unknown group", { budget_group: "luxuries" }],
    ["an unknown colour", { color: "pink" }],
    ["an icon that isn't a Lucide name", { icon: "<svg>" }],
    ["an empty name", { name: "   " }],
    ["a name over 30 characters", { name: "a".repeat(31) }],
    ["a ₱0 default budget", { default_budget: 0 }],
    ["a negative default budget", { default_budget: -100 }],
  ])("rejects %s", async (_label, fields) => {
    const { error } = await user.client.from("categories").insert({ ...custom, ...fields });
    expect(error?.code).toBe(CHECK_VIOLATION);
  });

  it.each([
    ["the same name", "Meals"],
    ["a different case", "mEALS"],
    ["extra spaces", "  meals "],
  ])("rejects a name that clashes with %s", async (_label, name) => {
    const { error } = await user.client.from("categories").insert({ ...custom, name });
    expect(error?.code).toBe(UNIQUE_VIOLATION);
  });
});

describe("categories: system categories are locked", () => {
  let user: TestUser;
  beforeAll(async () => {
    user = await signUpUser();
  });

  it.each(["income", "savings_pot", "extra_debt"])("can't rename %s", async (key) => {
    const category = await systemCategory(user, key);
    const { error } = await user.client.from("categories").update({ name: "Renamed" }).eq("id", category.id);
    expect(error?.code).toBe(PERMISSION_DENIED);
  });

  it("can't move a system category to another group", async () => {
    const category = await systemCategory(user, "savings_pot");
    const { error } = await user.client.from("categories").update({ budget_group: "wants" }).eq("id", category.id);
    expect(error?.code).toBe(PERMISSION_DENIED);
  });

  it.each(["income", "savings_pot", "extra_debt"])("can't delete %s", async (key) => {
    const category = await systemCategory(user, key);
    await user.client.from("categories").delete().eq("id", category.id);
    const { data } = await user.client.from("categories").select("id").eq("id", category.id);
    expect(data).toHaveLength(1);
  });

  it("can still change a system category's colour and default budget", async () => {
    const category = await systemCategory(user, "savings_pot");
    const { data, error } = await user.client
      .from("categories")
      .update({ color: "blue", default_budget: 200_000 })
      .eq("id", category.id)
      .select()
      .single();
    expect(error).toBeNull();
    expect(data).toMatchObject({ color: "blue", default_budget: 200_000 });
  });

  it("can't add a category with a system key", async () => {
    const { error } = await user.client
      .from("categories")
      .insert({ ...custom, name: "Fake pot", budget_group: "savings_debt", system_key: "savings_pot" });
    expect(error?.code).toBe(PERMISSION_DENIED);
  });

  it("can't remove a category's system key", async () => {
    const category = await systemCategory(user, "income");
    const { error } = await user.client.from("categories").update({ system_key: null }).eq("id", category.id);
    expect(error?.code).toBe(PERMISSION_DENIED);
  });
});

describe("RLS: user A can't reach user B's categories", () => {
  let a: TestUser;
  let b: TestUser;
  let bCategory: { id: string };

  beforeAll(async () => {
    [a, b] = await Promise.all([signUpUser(), signUpUser()]);
    bCategory = await createCategory(b);
  });

  it("can't read them", async () => {
    const { data, error } = await a.client.from("categories").select("id").eq("user_id", b.id);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("can't change them", async () => {
    const { data } = await a.client.from("categories").update({ name: "Hacked" }).eq("id", bCategory.id).select();
    expect(data).toEqual([]);
    const { data: still } = await b.client.from("categories").select("name").eq("id", bCategory.id).single();
    expect(still?.name).toBe("Pet food");
  });

  it("can't delete them", async () => {
    await a.client.from("categories").delete().eq("id", bCategory.id);
    const { data } = await b.client.from("categories").select("id").eq("id", bCategory.id);
    expect(data).toHaveLength(1);
  });

  it("can't create categories owned by B", async () => {
    // user_id isn't in the insert grant, so sending it at all is refused.
    const { error } = await a.client.from("categories").insert({ ...custom, user_id: b.id });
    expect(error?.code).toBe(PERMISSION_DENIED);
  });

  it("can't move their own category to B", async () => {
    const aCategory = await createCategory(a);
    const { error } = await a.client.from("categories").update({ user_id: b.id }).eq("id", aCategory.id);
    expect(error?.code).toBe(PERMISSION_DENIED);
  });
});

describe("logged-out visitors", () => {
  it("can't read or add categories", async () => {
    const anon = anonClient();
    const { error: readError } = await anon.from("categories").select("id");
    expect(readError?.code).toBe(PERMISSION_DENIED);
    const { error: addError } = await anon.from("categories").insert(custom);
    expect(addError?.code).toBe(PERMISSION_DENIED);
  });
});
