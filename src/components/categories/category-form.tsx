"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { FormError } from "@/components/auth/form-error";
import { SubmitButton } from "@/components/auth/submit-button";
import { TextField } from "@/components/auth/text-field";
import { CategoryIcon, CategoryIconTile } from "@/components/transactions/category-grid";
import { CATEGORIES_HREF } from "@/lib/categories";
import type { BudgetGroup } from "@/lib/transactions";
import { cn } from "@/lib/utils";
import {
  CATEGORY_COLORS,
  CATEGORY_ICONS,
  type CategoryFormInput,
  type CategoryValues,
  categorySchema,
} from "@/lib/validation/category";

/** What a save returns: errors to show, or ok with the saved id. */
export type CategoryFormResult = {
  ok?: true;
  id?: string;
  formError?: string;
  fieldErrors?: Partial<Record<string, string>>;
};

export type EditableCategory = { id: string; name: string; budget_group: string; icon: string; color: string };

const GROUPS: { value: BudgetGroup; label: string; hint: string }[] = [
  { value: "needs", label: "Needs", hint: "Must-pays like food, bills, rent" },
  { value: "wants", label: "Wants", hint: "Nice-to-haves like shopping, fun" },
  { value: "savings_debt", label: "Savings & debt payoff", hint: "Saving or paying debt early" },
];

// Selected icon: a 2px border and soft background in the chosen colour.
// Written out in full so Tailwind finds the class names.
const PICKED_ICON: Record<string, string> = {
  orange: "border-2 border-cat-orange-fg bg-cat-orange-bg text-cat-orange-fg",
  blue: "border-2 border-cat-blue-fg bg-cat-blue-bg text-cat-blue-fg",
  purple: "border-2 border-cat-purple-fg bg-cat-purple-bg text-cat-purple-fg",
  yellow: "border-2 border-cat-yellow-fg bg-cat-yellow-bg text-cat-yellow-fg",
  red: "border-2 border-cat-red-fg bg-cat-red-bg text-cat-red-fg",
  green: "border-2 border-cat-green-fg bg-cat-green-bg text-cat-green-fg",
};

// A swatch: the soft colour with a dot of the icon colour.
const SWATCH: Record<string, [string, string]> = {
  orange: ["bg-cat-orange-bg", "bg-cat-orange-fg"],
  blue: ["bg-cat-blue-bg", "bg-cat-blue-fg"],
  purple: ["bg-cat-purple-bg", "bg-cat-purple-fg"],
  yellow: ["bg-cat-yellow-bg", "bg-cat-yellow-fg"],
  red: ["bg-cat-red-bg", "bg-cat-red-fg"],
  green: ["bg-cat-green-bg", "bg-cat-green-fg"],
};

const LEGEND = "mb-2 text-sm font-bold text-ink";

/**
 * The form on the New and Edit category pages: after saving, back to the
 * list. (A server page can pass the Server Action, but not a callback.)
 */
export function CategoryPageForm(props: Omit<React.ComponentProps<typeof CategoryForm>, "onSaved">) {
  const router = useRouter();
  return (
    <CategoryForm
      {...props}
      onSaved={() => {
        router.push(CATEGORIES_HREF);
        // Re-reads the list's server data, in case the router kept an old copy.
        router.refresh();
      }}
    />
  );
}
const fieldOrder = ["name", "budgetGroup", "icon", "color"] as const;

/**
 * New or Edit category (more-and-categories.md §2). Used by the category
 * pages now and by the add sheet's picker in 3h-3. "Budget per payday" waits
 * for the Plan (Week 5, owner Nov 24).
 */
export function CategoryForm({
  targets,
  category,
  onSave,
  onSaved,
}: {
  /** The budget's 50/30/20 targets, shown beside each group. */
  targets: Record<BudgetGroup, number>;
  /** Editing an existing category; leave out to make a new one. */
  category?: EditableCategory;
  onSave: (input: CategoryFormInput) => Promise<CategoryFormResult>;
  /** After a successful save, with the category's id. */
  onSaved: (id: string) => void;
}) {
  const [formError, setFormError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const idPrefix = category?.id ?? "new-category";

  const {
    register,
    handleSubmit,
    setError,
    control,
    formState: { errors },
  } = useForm<CategoryFormInput, unknown, CategoryValues>({
    resolver: zodResolver(categorySchema),
    mode: "onTouched",
    defaultValues: category
      ? {
          name: category.name,
          budgetGroup: category.budget_group as CategoryFormInput["budgetGroup"],
          icon: category.icon as CategoryFormInput["icon"],
          color: category.color as CategoryFormInput["color"],
        }
      : // The spec's defaults: Needs, the paw, orange.
        { name: "", budgetGroup: "needs", icon: "paw-print", color: "orange" },
  });

  const name = useWatch({ control, name: "name" });
  const budgetGroup = useWatch({ control, name: "budgetGroup" });
  const icon = useWatch({ control, name: "icon" });
  const color = useWatch({ control, name: "color" });
  const group = GROUPS.find((g) => g.value === budgetGroup);

  const onSubmit = (values: CategoryValues) => {
    setFormError(undefined);
    startTransition(async () => {
      const result = await onSave(values);
      if (result.formError) setFormError(result.formError);
      const firstBad = fieldOrder.find((f) => result.fieldErrors?.[f]);
      for (const f of fieldOrder) {
        const message = result.fieldErrors?.[f];
        if (message) setError(f, { message }, { shouldFocus: f === firstBad });
      }
      if (result.ok && result.id) onSaved(result.id);
    });
  };

  return (
    <form noValidate onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
      {/* Repeats the fields, so screen readers skip it (spec §5). */}
      <div aria-hidden className="flex flex-col gap-2 rounded-2xl border-[1.5px] border-line bg-surface p-4">
        <span className="text-xs font-extrabold tracking-wide text-text-3 uppercase">Preview</span>
        <div className="flex items-center gap-3">
          <CategoryIconTile icon={icon} color={color} size="lg" />
          <div className="flex min-w-0 flex-col">
            <span className={cn("truncate text-lg font-extrabold", name?.trim() ? "text-ink" : "text-text-3")}>
              {name?.trim() || "New category"}
            </span>
            {group && (
              <span className="text-sm text-text-2">
                {group.label} · {targets[group.value]}% target
              </span>
            )}
          </div>
        </div>
      </div>

      <TextField
        id={`${idPrefix}-name`}
        label="Name"
        placeholder="New category"
        autoComplete="off"
        maxLength={30}
        // Focused on open for a new category (spec §2), not when editing.
        autoFocus={!category}
        className="h-[50px]"
        error={errors.name?.message}
        {...register("name")}
      />

      <fieldset>
        <legend className={LEGEND}>Which 50/30/20 group?</legend>
        <div className="flex flex-col gap-2">
          {GROUPS.map((g) => (
            <label
              key={g.value}
              className={cn(
                "flex min-h-14 cursor-pointer items-center gap-3 rounded-[14px] border-[1.5px] border-line bg-surface px-3.5 py-2.5",
                "has-checked:border-2 has-checked:border-green-600 has-checked:bg-mint",
                "has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-link",
              )}
            >
              <input type="radio" value={g.value} className="sr-only" {...register("budgetGroup")} />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="font-extrabold text-ink">{g.label}</span>
                <span className="text-[13px] text-text-2">{g.hint}</span>
              </span>
              <span className="text-sm font-extrabold text-text-2">{targets[g.value]}%</span>
            </label>
          ))}
        </div>
      </fieldset>

      <Controller
        control={control}
        name="icon"
        render={({ field }) => (
          <fieldset>
            <legend className={LEGEND}>Icon</legend>
            <div className="grid grid-cols-5 gap-2">
              {CATEGORY_ICONS.map((option) => {
                const picked = field.value === option.name;
                return (
                  <button
                    key={option.name}
                    type="button"
                    aria-label={option.label}
                    aria-pressed={picked}
                    onClick={() => field.onChange(option.name)}
                    className={cn(
                      "flex h-[52px] items-center justify-center rounded-[14px] outline-link focus-visible:outline-2 focus-visible:outline-offset-2",
                      picked ? (PICKED_ICON[color] ?? "border-2 border-green-600 bg-mint text-ink") : "border-[1.5px] border-line bg-surface text-text-2",
                    )}
                  >
                    <CategoryIcon icon={option.name} size={22} />
                  </button>
                );
              })}
            </div>
          </fieldset>
        )}
      />

      <Controller
        control={control}
        name="color"
        render={({ field }) => (
          <fieldset>
            <legend className={LEGEND}>Color</legend>
            <div className="flex flex-wrap gap-3">
              {CATEGORY_COLORS.map((option) => {
                const picked = field.value === option.name;
                const [soft, dot] = SWATCH[option.name];
                return (
                  <button
                    key={option.name}
                    type="button"
                    aria-label={option.label}
                    aria-pressed={picked}
                    onClick={() => field.onChange(option.name)}
                    className={cn(
                      "flex size-[46px] items-center justify-center rounded-full outline-link focus-visible:outline-2 focus-visible:outline-offset-2",
                      soft,
                      picked ? "border-[3px] border-ink" : "border-[1.5px] border-line",
                    )}
                  >
                    <span aria-hidden className={cn("size-3.5 rounded-full", dot)} />
                  </button>
                );
              })}
            </div>
          </fieldset>
        )}
      />

      <FormError message={formError} />

      <SubmitButton
        pending={pending}
        pendingLabel="Saving…"
        // The page's one hero button (style-guide.md "Buttons").
        className="h-14 border-2 border-sticker bg-green-500 text-white shadow-sticker-sm hover:bg-green-500/90 aria-busy:bg-green-500 aria-busy:text-white"
      >
        {category ? "Save changes" : "Save category"}
      </SubmitButton>
    </form>
  );
}
