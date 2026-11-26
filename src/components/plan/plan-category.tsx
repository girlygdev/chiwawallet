"use client";

import { useEffect, useRef, useState } from "react";
import type { AddSheetData } from "@/app/(app)/activity/actions";
import { createCategory } from "@/app/(app)/settings/categories/actions";
import { CategoryForm } from "@/components/categories/category-form";
import { CategoryGrid } from "@/components/transactions/category-grid";
import { CategoryPicker } from "@/components/transactions/category-picker";
import type { ExpenseView } from "@/components/transactions/expense-form";
import type { BudgetGroup } from "@/lib/transactions";

const GROUP_NAMES: Record<BudgetGroup, string> = { needs: "Needs", wants: "Wants", savings_debt: "Savings & debt payoff" };

// Choosing a category in the Plan's sheets (Add one-off item, Set a budget),
// the same way as Add expense: the tile grid inside the form, and the
// category picker or New category in the form's place (`view`).

/** The picker or New category, shown instead of the form. Nothing on the form view. */
export function CategoryViews({
  view,
  data,
  value,
  onPick,
  onViewChange,
  onCategoriesChanged,
}: {
  view: ExpenseView;
  data: AddSheetData | null;
  value: string;
  onPick: (id: string) => void;
  onViewChange: (view: ExpenseView) => void;
  /** Reloads `data` after New category, so the grid has its tile. */
  onCategoriesChanged: () => Promise<void>;
}) {
  // The picker's search text becomes New category's starting name.
  const [newName, setNewName] = useState("");
  if (!data) return null;
  if (view === "picker") {
    return (
      <CategoryPicker
        budgets={data.budgets}
        categories={data.categories}
        recentIds={data.recentIds}
        targets={data.targets}
        value={value || undefined}
        onPick={onPick}
        onNew={(name) => {
          setNewName(name);
          onViewChange("new-category");
        }}
      />
    );
  }
  if (view === "new-category") {
    return (
      <CategoryForm
        targets={data.targets}
        defaultName={newName}
        onSave={createCategory}
        onSaved={async (id) => {
          try {
            await onCategoriesChanged();
          } catch (error) {
            console.error("plan: couldn't reload categories", error);
          }
          onPick(id);
        }}
      />
    );
  }
  return null;
}

/**
 * The tile grid and, under it, which group the category counts in ("Counts
 * as Wants", plan.md §6). Coming back from the picker puts focus on the
 * chosen tile, or More, so keyboard users land where they left.
 */
export function CategoryGridField({
  view,
  data,
  value,
  onChange,
  onMore,
  error,
}: {
  view: ExpenseView;
  data: AddSheetData | null;
  value: string;
  onChange: (id: string) => void;
  onMore: () => void;
  error?: string;
}) {
  const gridRef = useRef<HTMLDivElement>(null);
  const wasAway = useRef(false);
  useEffect(() => {
    if (wasAway.current && view === "form") {
      const grid = gridRef.current;
      (grid?.querySelector<HTMLElement>('[aria-pressed="true"]') ?? grid?.querySelector<HTMLElement>("[data-more]"))?.focus();
    }
    wasAway.current = view !== "form";
  }, [view]);

  const category = data?.categories.find((c) => c.id === value);
  return (
    <div className="flex flex-col gap-1.5">
      <CategoryGrid
        categories={data?.categories ?? null}
        topCount={data?.topCount ?? 5}
        loading={data == null}
        value={value || undefined}
        onChange={onChange}
        onMore={onMore}
        error={error}
        ref={gridRef}
      />
      <p aria-live="polite" className="text-[13px] text-text-3">
        {category?.budget_group ? `Counts as ${GROUP_NAMES[category.budget_group as BudgetGroup]}` : ""}
      </p>
    </div>
  );
}
