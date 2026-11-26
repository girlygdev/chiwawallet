"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState, useTransition } from "react";
import { useForm, useWatch } from "react-hook-form";
import { FormError } from "@/components/auth/form-error";
import { SubmitButton } from "@/components/auth/submit-button";
import { TextField } from "@/components/auth/text-field";
import { MoneyInput } from "@/components/money-input";
import { formatPeso, formatPesoInput, parsePesoInput } from "@/lib/money";
import { editImpact, type PlanSection, type PlanSummary } from "@/lib/plan";
import { cn } from "@/lib/utils";
import { type EditPlanItem, type EditPlanItemInput, editPlanItemSchema } from "@/lib/validation/plan-item";

/** What Edit item needs to know about a row. */
export type EditableItem = {
  id: string;
  name: string;
  planned_amount: number;
  needed_by: string | null;
  origin: string;
  section: PlanSection;
  /** Income rows: whether the pay came in. */
  received: boolean;
};

export type PlanItemFormResult = { ok?: true; formError?: string; fieldErrors?: Partial<Record<string, string>> };

const FIELD_ORDER = ["name", "amount", "neededBy"] as const;

/**
 * Edit item (plan.md §3, task 5e): name and amount, plus Needed by for
 * one-off items. The impact line shows the effect in pesos before saving.
 */
export function PlanItemForm({
  item,
  summary,
  onSave,
  onRemoveRequest,
}: {
  item: EditableItem;
  summary: Pick<PlanSummary, "moneyForPeriod" | "notAssigned">;
  onSave: (input: EditPlanItemInput) => Promise<PlanItemFormResult>;
  onRemoveRequest: () => void;
}) {
  const [formError, setFormError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const oneOff = item.origin === "one_off";
  const id = `plan-item-${item.id}`;

  const {
    register,
    handleSubmit,
    setError,
    getValues,
    control,
    formState: { errors },
  } = useForm<EditPlanItemInput, unknown, EditPlanItem>({
    resolver: zodResolver(editPlanItemSchema),
    mode: "onTouched",
    defaultValues: {
      name: item.name,
      amount: formatPesoInput(item.planned_amount),
      neededBy: item.needed_by ?? "",
    },
  });

  // The effect in pesos before saving (CLAUDE.md UI rules), from lib/plan.ts.
  const amountText = useWatch({ control, name: "amount" }) ?? "";
  const centavos = parsePesoInput(amountText);
  const impact = centavos != null && centavos > 0 ? editImpact(summary, item, centavos) : null;

  const onSubmit = () => {
    setFormError(undefined);
    // Send what was typed (not the parsed centavos): the Server Action parses
    // it again with the same schema.
    const input = getValues();
    startTransition(async () => {
      const result = await onSave(input);
      if (result.formError) setFormError(result.formError);
      const firstBad = FIELD_ORDER.find((f) => result.fieldErrors?.[f]);
      for (const f of FIELD_ORDER) {
        const message = result.fieldErrors?.[f];
        if (message) setError(f, { message }, { shouldFocus: f === firstBad });
      }
    });
  };

  return (
    <form noValidate onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <TextField
        id={`${id}-name`}
        label="Name"
        autoComplete="off"
        maxLength={40}
        className="h-[50px]"
        error={errors.name?.message}
        {...register("name")}
      />
      <MoneyInput
        id={`${id}-amount`}
        label={item.section === "income" ? "Expected amount" : "Amount"}
        error={errors.amount?.message}
        {...register("amount")}
      />
      {oneOff && (
        // Future dates are the point here, so a plain date input, like Debts.
        <TextField
          id={`${id}-needed-by`}
          type="date"
          label="Needed by (optional)"
          className="h-12"
          error={errors.neededBy?.message}
          {...register("neededBy")}
        />
      )}

      {/* The effect in pesos before saving. Yellow, not red, below ₱0 (plan.md §1). */}
      <div aria-live="polite">
        {impact ? (
          <p
            className={cn(
              "rounded-[14px] px-4 py-3 text-sm",
              impact.after < 0 ? "bg-cat-yellow-bg text-cat-yellow-fg" : "bg-mint text-link-hover",
            )}
          >
            <span className="font-bold">{impact.label}:</span> {formatPeso(impact.before)} →{" "}
            <span className="font-extrabold">{formatPeso(impact.after)}</span>
          </p>
        ) : (
          item.section === "income" &&
          item.received && (
            <p className="rounded-[14px] bg-bg px-4 py-3 text-sm text-text-2">
              This pay already came in, so the amount you logged is what counts.
            </p>
          )
        )}
      </div>

      <FormError message={formError} />

      <SubmitButton
        pending={pending}
        pendingLabel="Saving…"
        // The sheet's one hero button (style-guide.md "Buttons").
        className="h-14 border-2 border-sticker bg-green-500 text-white shadow-sticker-sm hover:bg-green-500/90 aria-busy:bg-green-500 aria-busy:text-white"
      >
        Save changes
      </SubmitButton>

      {/* "Remove" takes it out of the plan (delete-pattern.md word list). */}
      <button
        type="button"
        onClick={onRemoveRequest}
        className="h-11 self-center rounded-md px-3 text-[15px] font-extrabold text-danger outline-link focus-visible:outline-2"
      >
        Remove from plan
      </button>
    </form>
  );
}
