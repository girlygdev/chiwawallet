import { describe, expect, it } from "vitest";
import { categoryListSections, categoryUsage, type ListCategory } from "@/lib/categories";

describe("categoryUsage", () => {
  it("counts and totals live rows, and counts deleted ones separately", () => {
    expect(
      categoryUsage([
        { amount: 18_000, deleted_at: null },
        { amount: 25_050, deleted_at: null },
        { amount: 99_900, deleted_at: "2026-11-21T03:00:00Z" },
      ]),
    ).toEqual({ count: 2, total: 43_050, deletedCount: 1, billCount: 0, needsMove: true });
  });

  it("needs a move when only bills use it (4a-1)", () => {
    expect(categoryUsage([], 2)).toEqual({ count: 0, total: 0, deletedCount: 0, billCount: 2, needsMove: true });
  });

  it("still needs a move when only deleted rows use it (Undo can bring them back)", () => {
    expect(categoryUsage([{ amount: 18_000, deleted_at: "2026-11-21T03:00:00Z" }])).toEqual({
      count: 0,
      total: 0,
      deletedCount: 1,
      billCount: 0,
      needsMove: true,
    });
  });

  it("needs nothing for an unused category", () => {
    expect(categoryUsage([])).toEqual({ count: 0, total: 0, deletedCount: 0, billCount: 0, needsMove: false });
  });
});

const cat = (name: string, budget_group: string | null, extra: Partial<ListCategory> = {}): ListCategory => ({
  id: name,
  name,
  kind: budget_group == null ? "income" : "expense",
  budget_group,
  system_key: null,
  ...extra,
});

const names = (sections: ReturnType<typeof categoryListSections>) =>
  sections.map((s) => [s.key, s.categories.map((c) => c.name)]);

describe("categoryListSections", () => {
  it("groups in Needs, Wants, Savings & debt payoff, Income order", () => {
    const sections = categoryListSections([
      cat("Income", null, { system_key: "income" }),
      cat("Fun", "wants"),
      cat("Savings pot", "savings_debt", { system_key: "savings_pot" }),
      cat("Food", "needs"),
    ]);
    expect(names(sections)).toEqual([
      ["needs", ["Food"]],
      ["wants", ["Fun"]],
      ["savings_debt", ["Savings pot"]],
      ["income", ["Income"]],
    ]);
  });

  it("sorts A–Z ignoring case, with system categories last", () => {
    const sections = categoryListSections([
      cat("Extra debt payment", "savings_debt", { system_key: "extra_debt" }),
      cat("savings for school", "savings_debt"),
      cat("Emergency fund", "savings_debt"),
      cat("Savings pot", "savings_debt", { system_key: "savings_pot" }),
    ]);
    expect(names(sections)).toEqual([
      ["savings_debt", ["Emergency fund", "savings for school", "Extra debt payment", "Savings pot"]],
    ]);
  });

  it("leaves out empty sections, so Income hides without income categories", () => {
    expect(names(categoryListSections([cat("Food", "needs")]))).toEqual([["needs", ["Food"]]]);
    expect(categoryListSections([])).toEqual([]);
  });
});
