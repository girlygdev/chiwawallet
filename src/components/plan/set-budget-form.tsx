"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState, useTransition } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import type { AddSheetData } from "@/app/(app)/activity/actions";
import type { SetBudgetResult } from "@/app/(app)/plan/actions";
import { FormError } from "@/components/auth/form-error";
import { SubmitButton } from "@/components/auth/submit-button";
import { MoneyInput } from "@/components/money-input";
import { CategoryGridField, CategoryViews } from "@/components/plan/plan-category";
import { Segmented } from "@/components/segmented";
import type { ExpenseView } from "@/components/transactions/expense-form";
import { formatPeso, formatPesoInput, parsePesoInput } from "@/lib/money";
import { budgetImpact } from "@/lib/plan";
import { cn } from "@/lib/utils";
import { type SetBudget, type SetBudgetInput, setBudgetSchema } from "@/lib/validation/plan-item";

const FIELD_ORDER = ["categoryId", "amount", "scope"] as const;

/**
 * Set a budget (plan.md fix #2, task 5g-1): a category, an amount, and
 * "Every payday" or "This period only", for the period being viewed. Picking
 * a category that already has a budget here fills in its amount, until one
 * is typed. The impact line shows Not assigned yet before → after.
 */
export function SetBudgetForm({
  data,
  view,
  onViewChange,
  onCategoriesChanged,
  budgets,
  notAssigned,
  periodLabel,
  onSave,
  onSaved,
  onCancel,
}: {
  data: AddSheetData | null;
  view: ExpenseView;
  onViewChange: (view: ExpenseView) => void;
  onCategoriesChanged: () => Promise<void>;
  /** This period's spending budgets: category id → planned amount. */
  budgets: Record<string, number>;
  /** This period's Not assigned yet. */
  notAssigned: number;
  /** "Nov 15 – 29", for "Only Nov 15 – 29 changes." */
  periodLabel: string;
  onSave: (input: SetBudgetInput) => Promise<SetBudgetResult>;
  onSaved: (saved: NonNullable<SetBudgetResult["saved"]>) => void;
  onCancel: () => void;
}) {
  const [formError, setFormError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const [amountTyped, setAmountTyped] = useState(false);

  const {
    register,
    handleSubmit,
    setError,
    setValue,
    getValues,
    control,
    formState: { errors },
  } = useForm<SetBudgetInput, unknown, SetBudget>({
    resolver: zodResolver(setBudgetSchema),
    mode: "onTouched",
    defaultValues: { categoryId: "", amount: "", scope: "every" },
  });

  const categoryId = useWatch({ control, name: "categoryId" });
  const amountText = useWatch({ control, name: "amount" }) ?? "";
  const scope = useWatch({ control, name: "scope" });
  const centavos = parsePesoInput(amountText);
  const current = categoryId ? (budgets[categoryId] ?? null) : null;
  const impact = categoryId && centavos != null && centavos > 0 ? budgetImpact(notAssigned, current, centavos) : null;
  const name = data?.categories.find((c) => c.id === categoryId)?.name;

  const choose = (id: string) => {
    setValue("categoryId", id, { shouldValidate: errors.categoryId != null });
    // Start from the budget it already has here, until an amount is typed.
    if (!amountTyped) setValue("amount", budgets[id] != null ? formatPesoInput(budgets[id]) : "");
  };
  const pick = (id: string) => {
    choose(id);
    onViewChange("form");
  };

  const onSubmit = () => {
    setFormError(undefined);
    // Send what was typed: the Server Action parses it again with the same schema.
    const input = getValues();
    startTransition(async () => {
      const result = await onSave(input);
      if (result.formError) setFormError(result.formError);
      const firstBad = FIELD_ORDER.find((f) => result.fieldErrors?.[f]);
      for (const f of FIELD_ORDER) {
        const message = result.fieldErrors?.[f];
        if (message) setError(f, { message }, { shouldFocus: f === firstBad });
      }
      if (result.saved) onSaved(result.saved);
    });
  };

  return (
    <>
      <CategoryViews
        view={view}
        data={data}
        value={categoryId}
        onPick={pick}
        onViewChange={onViewChange}
        onCategoriesChanged={onCategoriesChanged}
      />

      <form noValidate onSubmit={handleSubmit(onSubmit)} hidden={view !== "form"} className="flex flex-col gap-4">
        <CategoryGridField
          view={view}
          data={data}
          value={categoryId}
          onChange={choose}
          onMore={() => onViewChange("picker")}
          error={errors.categoryId?.message}
        />
        <MoneyInput
          id="set-budget-amount"
          label="Amount"
          placeholder="3,000"
          className="h-[50px]"
          error={errors.amount?.message}
          {...register("amount", { onChange: () => setAmountTyped(true) })}
        />
        <Controller
          control={control}
          name="scope"
          render={({ field }) => (
            <Segmented
              name="set-budget-scope"
              legend="How often?"
              options={[
                { value: "every", label: "Every payday" },
                { value: "period", label: "This period only" },
              ]}
              value={field.value}
              onChange={field.onChange}
              error={errors.scope?.message}
            />
          )}
        />

        {/* The effect in pesos before saving: yellow, not red, below ₱0. */}
        <div aria-live="polite">
          {impact && (
            <div
              className={cn(
                "flex flex-col gap-0.5 rounded-[14px] px-4 py-3 text-sm",
                impact.after < 0 ? "bg-cat-yellow-bg text-cat-yellow-fg" : "bg-mint text-link-hover",
              )}
            >
              <p>
                <span className="font-bold">Not assigned yet:</span> {formatPeso(impact.before)} →{" "}
                <span className="font-extrabold">{formatPeso(impact.after)}</span>
              </p>
              <p>
                {scope === "every"
                  ? `${formatPeso(centavos!)} for ${name ?? "it"} every payday, starting with this one.`
                  : `Only ${periodLabel} changes.`}
              </p>
            </div>
          )}
        </div>

        <FormError message={formError} />

        <div className="flex flex-col gap-2 md:flex-row-reverse">
          <SubmitButton
            pending={pending}
            pendingLabel="Saving…"
            // The sheet's one hero button (style-guide.md "Buttons").
            className="h-14 border-2 border-sticker bg-green-500 text-white shadow-sticker-sm hover:bg-green-500/90 aria-busy:bg-green-500 aria-busy:text-white md:flex-1"
          >
            Set budget
          </SubmitButton>
          <button
            type="button"
            onClick={onCancel}
            className="hidden h-14 items-center justify-center rounded-md border-[1.5px] border-line bg-surface px-5 text-base font-extrabold text-ink outline-link focus-visible:outline-2 focus-visible:outline-offset-2 md:flex md:flex-1"
          >
            Cancel
          </button>
        </div>
      </form>
    </>
  );
}
