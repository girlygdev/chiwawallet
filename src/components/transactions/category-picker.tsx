"use client";

import { Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { SheetCategory } from "@/app/(app)/activity/actions";
import { inputClassName } from "@/components/auth/text-field";
import { type BudgetGroup, groupCategories } from "@/lib/transactions";
import { cn } from "@/lib/utils";
import { CategoryTile } from "./category-grid";

const GROUP_NAMES: Record<BudgetGroup, string> = {
  needs: "Needs",
  wants: "Wants",
  savings_debt: "Savings & debt payoff",
};

const HEADING = "text-xs font-extrabold tracking-wide text-text-3 uppercase";

// "Choose a category" (activity.md §4), shown inside the Add expense sheet in
// place of the form. Search, RECENT, then one section per 50/30/20 group with
// the budget's own target. `categories` never includes income or system ones.
// Not yet: "₱2,760 left" on tiles (needs the Plan, Week 5) and the New
// category tile (3h).
export function CategoryPicker({
  categories,
  recentIds,
  targets,
  value,
  onPick,
}: {
  categories: SheetCategory[];
  recentIds: string[];
  targets: Record<BudgetGroup, number>;
  value: string | undefined;
  onPick: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const regionRef = useRef<HTMLDivElement>(null);

  // Focus moves here from More, so screen readers hear "Choose a category".
  // Not the search field: on phones that would pop the keyboard over the tiles.
  useEffect(() => {
    regionRef.current?.focus();
  }, []);

  const byId = new Map(categories.map((c) => [c.id, c]));
  const recent = recentIds.flatMap((id) => byId.get(id) ?? []);
  const sections = groupCategories(categories, query);
  const searching = query.trim() !== "";

  return (
    <div
      ref={regionRef}
      tabIndex={-1}
      role="region"
      aria-label="Choose a category"
      className="flex flex-col gap-5 outline-none"
    >
      <div className="relative">
        <label htmlFor="category-search" className="sr-only">
          Search categories
        </label>
        <Search aria-hidden size={20} className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-text-3" />
        <input
          id="category-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search categories"
          autoComplete="off"
          enterKeyHint="search"
          className={cn(inputClassName, "h-[46px] pl-11")}
        />
      </div>

      {!searching && recent.length > 0 && (
        <section aria-labelledby="picker-recent" className="flex flex-col gap-2">
          <h3 id="picker-recent" className={HEADING}>
            Recent
          </h3>
          <div className="grid grid-cols-4 gap-2">
            {recent.map((category) => (
              <CategoryTile
                key={category.id}
                category={category}
                selected={category.id === value}
                onClick={() => onPick(category.id)}
              />
            ))}
          </div>
        </section>
      )}

      {sections.map(({ group, categories: tiles }) => (
        <section key={group} aria-labelledby={`picker-${group}`} className="flex flex-col gap-2">
          <h3 id={`picker-${group}`} className={HEADING}>
            {GROUP_NAMES[group]} · {targets[group]}% target
          </h3>
          <div className="grid grid-cols-3 gap-2">
            {tiles.map((category) => (
              <CategoryTile
                key={category.id}
                category={category}
                selected={category.id === value}
                onClick={() => onPick(category.id)}
                className="min-h-[92px]"
              />
            ))}
          </div>
        </section>
      ))}

      <div aria-live="polite">
        {sections.length === 0 && (
          <p className="rounded-[14px] bg-track px-4 py-3 text-sm font-bold text-text-2">
            No categories match &ldquo;{query.trim()}&rdquo;.
          </p>
        )}
      </div>
    </div>
  );
}
