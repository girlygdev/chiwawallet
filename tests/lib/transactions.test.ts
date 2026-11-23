import { describe, expect, it } from "vitest";
import {
  cashOnHand,
  type CategoryChoice,
  groupByDay,
  moneyOutImpact,
  periodTotals,
  signedAmount,
  gridCategories,
  groupCategories,
  recentCategories,
  topCategories,
  type TransactionRow,
} from "@/lib/transactions";

let nextId = 0;
function tx(fields: Partial<TransactionRow> & Pick<TransactionRow, "type" | "amount">): TransactionRow {
  nextId += 1;
  return {
    id: `t${nextId}`,
    date: "2026-11-20",
    created_at: `2026-11-20T0${nextId % 10}:00:00Z`,
    deleted_at: null,
    ...fields,
  };
}

const pay = tx({ type: "income", amount: 2_500_000, date: "2026-11-15" });
const lunch = tx({ type: "expense", amount: 18_000 });
const loan = tx({ type: "debt_payment", amount: 400_000 });
const toPot = tx({ type: "savings", amount: 300_000 });
const fromPot = tx({ type: "savings", amount: -100_000 });
const deleted = tx({ type: "expense", amount: 999_900, deleted_at: "2026-11-21T00:00:00Z" });

describe("signedAmount", () => {
  it("adds income and takes away spending and debt payments", () => {
    expect(signedAmount(pay)).toBe(2_500_000);
    expect(signedAmount(lunch)).toBe(-18_000);
    expect(signedAmount(loan)).toBe(-400_000);
  });

  it("treats a pot deposit as cash going out and a withdrawal as cash coming back", () => {
    expect(signedAmount(toPot)).toBe(-300_000);
    expect(signedAmount(fromPot)).toBe(100_000);
  });
});

describe("periodTotals", () => {
  it("adds up money in, money out and to savings", () => {
    expect(periodTotals([pay, lunch, loan, toPot, fromPot])).toEqual({
      moneyIn: 2_500_000,
      // Spending plus debt payments.
      moneyOut: 418_000,
      // Deposits minus withdrawals; the withdrawal isn't money in.
      toSavings: 200_000,
    });
  });

  it("can show more taken out of savings than put in", () => {
    expect(periodTotals([fromPot]).toSavings).toBe(-100_000);
  });

  it("skips deleted rows", () => {
    expect(periodTotals([lunch, deleted]).moneyOut).toBe(18_000);
  });

  it("is all zero for an empty period", () => {
    expect(periodTotals([])).toEqual({ moneyIn: 0, moneyOut: 0, toSavings: 0 });
  });
});

describe("groupByDay", () => {
  it("groups rows by date, newest day first, each with its net", () => {
    const morning = tx({ type: "expense", amount: 5_000, date: "2026-11-20", created_at: "2026-11-20T01:00:00Z" });
    const evening = tx({ type: "expense", amount: 7_000, date: "2026-11-20", created_at: "2026-11-20T12:00:00Z" });
    const days = groupByDay([pay, morning, toPot, evening, fromPot]);

    expect(days.map((d) => d.date)).toEqual(["2026-11-20", "2026-11-15"]);
    expect(days[1]).toEqual({ date: "2026-11-15", net: 2_500_000, rows: [pay] });
    // Pot moves count: −50 − 70 − 3,000 + 1,000.
    expect(days[0].net).toBe(-5_000 - 7_000 - 300_000 + 100_000);
  });

  it("puts the newest row first within a day", () => {
    const first = tx({ type: "expense", amount: 100, created_at: "2026-11-20T01:00:00Z" });
    const second = tx({ type: "expense", amount: 200, created_at: "2026-11-20T02:00:00Z" });
    expect(groupByDay([first, second])[0].rows).toEqual([second, first]);
  });

  it("leaves out deleted rows, and days that only had deleted rows", () => {
    const onlyDeleted = tx({ type: "expense", amount: 100, date: "2026-11-25", deleted_at: "2026-11-25T00:00:00Z" });
    const days = groupByDay([lunch, deleted, onlyDeleted]);
    expect(days).toEqual([{ date: "2026-11-20", net: -18_000, rows: [lunch] }]);
  });

  it("is empty for an empty period", () => {
    expect(groupByDay([])).toEqual([]);
  });
});

describe("cashOnHand", () => {
  it("is the opening balance plus income, minus spending, net savings and debt payments", () => {
    // 5,000 + 25,000 − 180 − 4,000 − (3,000 − 1,000)
    expect(cashOnHand(500_000, [pay, lunch, loan, toPot, fromPot])).toBe(2_382_000);
  });

  it("counts an empty opening balance as ₱0", () => {
    expect(cashOnHand(null, [lunch])).toBe(-18_000);
  });

  it("keeps a negative opening balance", () => {
    expect(cashOnHand(-150_000, [])).toBe(-150_000);
  });

  it("skips deleted rows", () => {
    expect(cashOnHand(500_000, [deleted])).toBe(500_000);
  });
});

describe("moneyOutImpact", () => {
  it("adds the new expense to this period's money out", () => {
    expect(moneyOutImpact([lunch, loan, deleted], 25_000)).toEqual({ before: 418_000, after: 443_000 });
  });

  it("starts from ₱0 in an empty period", () => {
    expect(moneyOutImpact([], 18_000)).toEqual({ before: 0, after: 18_000 });
  });
});

describe("topCategories", () => {
  const cat = (id: string, name: string, budget_group: string | null, extra: Partial<CategoryChoice> = {}) => ({
    id,
    name,
    kind: "expense",
    budget_group,
    system_key: null,
    ...extra,
  });
  // The defaults, out of order on purpose.
  const categories: CategoryChoice[] = [
    cat("travel", "Travel", "wants"),
    cat("food", "Food", "needs"),
    cat("fun", "Fun", "wants"),
    cat("transport", "Transport", "needs"),
    cat("bills", "Bills", "needs"),
    cat("load", "Load & data", "needs"),
    cat("health", "Health", "needs"),
    cat("padala", "Padala", "needs"),
    cat("rent", "Rent", "needs"),
    cat("dining", "Dining out", "wants"),
    cat("income", "Income", null, { kind: "income", system_key: "income" }),
    cat("pot", "Savings pot", "savings_debt", { system_key: "savings_pot" }),
    cat("extra", "Extra debt payment", "savings_debt", { system_key: "extra_debt" }),
  ];
  const ids = (list: CategoryChoice[]) => list.map((c) => c.id);

  it("gives a new user Needs first, then A to Z", () => {
    expect(ids(topCategories(categories, [], 5))).toEqual(["bills", "food", "health", "load", "padala"]);
  });

  it("puts the most-used first, then breaks ties the same way", () => {
    const recent = ["dining", "transport", "dining", "fun", "transport", "dining"];
    expect(ids(topCategories(categories, recent, 5))).toEqual(["dining", "transport", "fun", "bills", "food"]);
  });

  it("never offers income or system categories, even if they were used", () => {
    const shown = ids(topCategories(categories, ["pot", "pot", "extra", "income"], 99));
    expect(shown).not.toContain("pot");
    expect(shown).not.toContain("extra");
    expect(shown).not.toContain("income");
    expect(shown).toHaveLength(10);
  });

  it("ignores usage of categories that no longer exist", () => {
    expect(ids(topCategories(categories, ["gone", "gone"], 2))).toEqual(["bills", "food"]);
  });

  it("puts a custom Savings & debt category after Needs and Wants", () => {
    const withCustom = [...categories, cat("emergency", "Emergency fund", "savings_debt")];
    expect(ids(topCategories(withCustom, [], 99)).at(-1)).toBe("emergency");
  });
});

describe("recentCategories", () => {
  const cat = (id: string, extra: Partial<CategoryChoice> = {}) => ({
    id,
    name: id,
    kind: "expense",
    budget_group: "needs",
    system_key: null,
    ...extra,
  });
  const categories: CategoryChoice[] = [
    cat("food"),
    cat("transport"),
    cat("fun", { budget_group: "wants" }),
    cat("rent"),
    cat("bills"),
    cat("income", { kind: "income", budget_group: null, system_key: "income" }),
    cat("pot", { budget_group: "savings_debt", system_key: "savings_pot" }),
  ];
  const ids = (list: CategoryChoice[]) => list.map((c) => c.id);

  it("lists each category once, newest first, up to the limit", () => {
    const latestFirst = ["fun", "food", "fun", "transport", "food", "rent", "bills"];
    expect(ids(recentCategories(categories, latestFirst, 4))).toEqual(["fun", "food", "transport", "rent"]);
  });

  it("is empty for a new user", () => {
    expect(recentCategories(categories, [], 4)).toEqual([]);
  });

  it("skips income, system and deleted categories without using up the limit", () => {
    const latestFirst = ["pot", "gone", "income", "food", "transport"];
    expect(ids(recentCategories(categories, latestFirst, 2))).toEqual(["food", "transport"]);
  });
});

describe("groupCategories", () => {
  const cat = (id: string, name: string, budget_group: string | null) => ({
    id,
    name,
    kind: "expense",
    budget_group,
    system_key: null,
  });
  // Already in the picker's order (topCategories), which groups keep.
  const categories: CategoryChoice[] = [
    cat("dining", "Dining out", "wants"),
    cat("food", "Food", "needs"),
    cat("load", "Load & data", "needs"),
    cat("fun", "Fun", "wants"),
    cat("emergency", "Emergency fund", "savings_debt"),
  ];
  const shape = (groups: ReturnType<typeof groupCategories<CategoryChoice>>) =>
    groups.map((g) => [g.group, g.categories.map((c) => c.id)]);

  it("makes one section per group in Needs, Wants, Savings & debt order, keeping the given order inside", () => {
    expect(shape(groupCategories(categories, ""))).toEqual([
      ["needs", ["food", "load"]],
      ["wants", ["dining", "fun"]],
      ["savings_debt", ["emergency"]],
    ]);
  });

  it("leaves out empty groups", () => {
    expect(shape(groupCategories(categories.slice(0, 3), ""))).toEqual([
      ["needs", ["food", "load"]],
      ["wants", ["dining"]],
    ]);
  });

  it("searches names anywhere in the word, ignoring case and outer spaces", () => {
    expect(shape(groupCategories(categories, "  D "))).toEqual([
      ["needs", ["food", "load"]],
      ["wants", ["dining"]],
      ["savings_debt", ["emergency"]],
    ]);
    expect(shape(groupCategories(categories, "FUN"))).toEqual([
      ["wants", ["fun"]],
      ["savings_debt", ["emergency"]],
    ]);
  });

  it("returns nothing when no name matches", () => {
    expect(groupCategories(categories, "rent")).toEqual([]);
  });

  it("drops categories without a group (income)", () => {
    expect(shape(groupCategories([cat("pay", "Income", null)], ""))).toEqual([]);
  });
});

describe("gridCategories", () => {
  const list = ["a", "b", "c", "d", "e", "f", "g"].map((id) => ({ id }));
  const ids = (l: { id: string }[]) => l.map((c) => c.id);

  it("shows the top ones when nothing or a top one is picked", () => {
    expect(ids(gridCategories(list, 5))).toEqual(["a", "b", "c", "d", "e"]);
    expect(ids(gridCategories(list, 5, "c"))).toEqual(["a", "b", "c", "d", "e"]);
  });

  it("puts a category picked from More in the last place", () => {
    expect(ids(gridCategories(list, 5, "g"))).toEqual(["a", "b", "c", "d", "g"]);
  });

  it("ignores a picked id that isn't in the list", () => {
    expect(ids(gridCategories(list, 5, "zz"))).toEqual(["a", "b", "c", "d", "e"]);
  });

  it("handles fewer categories than tiles", () => {
    expect(ids(gridCategories(list.slice(0, 2), 5, "b"))).toEqual(["a", "b"]);
  });
});
