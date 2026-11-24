import { describe, expect, it } from "vitest";
import { categoryListSections, type ListCategory } from "@/lib/categories";

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
