"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deleteCategory } from "@/app/(app)/settings/categories/actions";
import { FieldShell, inputClassName } from "@/components/auth/text-field";
import { ConfirmDelete } from "@/components/confirm-delete";
import { CategoryIconTile } from "@/components/transactions/category-grid";
import { CATEGORIES_HREF, type CategoryUsage, categoryListSections, type ListCategory } from "@/lib/categories";
import { formatPeso } from "@/lib/money";
import { cn } from "@/lib/utils";

type DeletingCategory = {
  id: string;
  name: string;
  icon: string;
  color: string;
  group: string;
  /** "Needs · 50% target" */
  groupLine: string;
};

const GROUP_NAMES: Record<string, string> = {
  needs: "Needs",
  wants: "Wants",
  savings_debt: "Savings & debt payoff",
  income: "Income",
};

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/**
 * Edit category's "Delete category" link and its level 2 dialog
 * (delete-pattern.md §4, "Category"): say what uses it, and when anything
 * does, require picking where those transactions move. No undo, so the
 * choice is the safety net.
 */
export function DeleteCategory({
  category,
  usage,
  destinations,
}: {
  category: DeletingCategory;
  usage: CategoryUsage;
  /** Where its transactions can go: the user's other non-system categories of the same kind. */
  destinations: ListCategory[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [moveTo, setMoveTo] = useState("");
  const [moveError, setMoveError] = useState<string>();
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const destination = destinations.find((d) => d.id === moveTo);
  const sections = categoryListSections(destinations);

  const confirm = () => {
    setError(undefined);
    setMoveError(undefined);
    if (usage.needsMove && !moveTo) return setMoveError("Pick a category to move them to.");
    startTransition(async () => {
      const result = await deleteCategory(category.id, usage.needsMove ? moveTo : null);
      if (result.moveError) return setMoveError(result.moveError);
      if (result.formError) return setError(result.formError);
      router.push(CATEGORIES_HREF);
      router.refresh();
    });
  };

  // What uses it, in words (delete-pattern.md §2: say what's linked).
  const linked =
    usage.count > 0
      ? `${plural(usage.count, "transaction")} (${formatPeso(usage.total)}) use ${category.name}.`
      : usage.deletedCount > 0
        ? `No transactions use ${category.name} now, but ${plural(usage.deletedCount, "recently deleted one")} still do.`
        : `Nothing uses ${category.name} yet.`;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="h-11 self-center rounded-md px-3 text-[15px] font-extrabold text-danger outline-link focus-visible:outline-2"
      >
        Delete category
      </button>

      <ConfirmDelete
        open={open}
        onOpenChange={(next) => !pending && setOpen(next)}
        title={`Delete ${category.name}?`}
        description={linked}
        confirmLabel="Delete category"
        onConfirm={confirm}
        pending={pending}
        error={error}
      >
        {/* The item itself (delete-pattern.md §2.2). */}
        <div className="flex items-center gap-3 rounded-[14px] bg-bg px-4 py-3">
          <CategoryIconTile icon={category.icon} color={category.color} size="md" />
          <div className="min-w-0">
            <p className="truncate font-extrabold">{category.name}</p>
            <p className="text-[13px] text-text-3">{category.groupLine}</p>
          </div>
        </div>

        {usage.needsMove && (
          <FieldShell id="move-to" label="Move them to" error={moveError}>
            {(describedBy) => (
              <select
                id="move-to"
                value={moveTo}
                onChange={(e) => {
                  setMoveTo(e.target.value);
                  setMoveError(undefined);
                }}
                aria-invalid={moveError ? true : undefined}
                aria-describedby={describedBy}
                className={cn(inputClassName, "h-12 appearance-auto")}
              >
                <option value="" disabled>
                  Choose a category
                </option>
                {sections.map(({ key, categories }) => (
                  <optgroup key={key} label={GROUP_NAMES[key]}>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            )}
          </FieldShell>
        )}

        {/* The effect (delete-pattern.md §2.3). Money in and out don't change; only
            the category does, and the 50/30/20 group when it's another one. */}
        <ul className="flex flex-col gap-1 text-sm text-text-2">
          {usage.needsMove && destination && usage.count > 0 && (
            <li>
              <span className="font-extrabold text-ink">{formatPeso(usage.total)}</span> moves to{" "}
              <span className="font-extrabold text-ink">{destination.name}</span>
              {destination.budget_group !== category.group && destination.budget_group
                ? ` and counts as ${GROUP_NAMES[destination.budget_group]}.`
                : "."}
            </li>
          )}
          {usage.needsMove && <li>Past transactions stay in Activity under the new category.</li>}
        </ul>
      </ConfirmDelete>
    </>
  );
}
