import type { BudgetGroup } from "@/lib/transactions";

// The category list (more-and-categories.md §3): pure helpers, no React.

export const CATEGORIES_HREF = "/settings/categories";

export type ListCategory = {
  id: string;
  name: string;
  kind: string;
  budget_group: string | null;
  system_key: string | null;
};

/** What the Delete category dialog says is linked (delete-pattern.md §4). */
export type CategoryUsage = {
  /** Live transactions using the category. */
  count: number;
  /** Their amounts added up, in centavos. */
  total: number;
  /** Soft-deleted ones, which Undo can bring back. */
  deletedCount: number;
  /** Any row at all (live or deleted) means picking where they move to. */
  needsMove: boolean;
};

/** `rows`: every transaction with this category, deleted ones included. */
export function categoryUsage(rows: { amount: number; deleted_at: string | null }[]): CategoryUsage {
  const live = rows.filter((r) => r.deleted_at == null);
  return {
    count: live.length,
    total: live.reduce((sum, r) => sum + r.amount, 0),
    deletedCount: rows.length - live.length,
    needsMove: rows.length > 0,
  };
}

export type ListSection<T> = { key: BudgetGroup | "income"; categories: T[] };

const ORDER: ListSection<unknown>["key"][] = ["needs", "wants", "savings_debt", "income"];

/**
 * The list's sections: Needs, Wants, Savings & debt payoff, then Income.
 * Inside each, the user's own categories A–Z (ignoring case), then the locked
 * system ones. Empty sections are left out, so Income only shows while an
 * income category exists.
 */
export function categoryListSections<T extends ListCategory>(categories: T[]): ListSection<T>[] {
  const sorted = [...categories].sort(
    (a, b) =>
      Number(a.system_key != null) - Number(b.system_key != null) ||
      a.name.localeCompare(b.name, "en", { sensitivity: "base" }),
  );
  return ORDER.map((key) => ({
    key,
    categories: sorted.filter((c) => (key === "income" ? c.kind === "income" : c.kind === "expense" && c.budget_group === key)),
  })).filter((section) => section.categories.length > 0);
}
