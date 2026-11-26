"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState, useTransition } from "react";
import { useForm, useWatch } from "react-hook-form";
import type { AddDebtPaymentResult } from "@/app/(app)/plan/actions";
import { FormError } from "@/components/auth/form-error";
import { SubmitButton } from "@/components/auth/submit-button";
import { MoneyInput } from "@/components/money-input";
import { type PaydayCard, PaydayCards, PeriodImpact, usePeriodNotAssigned } from "@/components/plan/payday-picker";
import { formatPeso, parsePesoInput } from "@/lib/money";
import type { PlanDebt } from "@/lib/plan-periods";
import { cn } from "@/lib/utils";
import { type DebtPayment, type DebtPaymentInput, debtPaymentSchema } from "@/lib/validation/plan-item";

const FIELD_ORDER = ["debtId", "amount", "periodStart"] as const;

/**
 * Plan a debt payment (task 5g-2): an extra payment on an active debt, from
 * the chosen payday. It counts as Savings & debt payoff. The amount can't be
 * more than what's left; the impact box is Add one-off item's.
 */
export function DebtPaymentForm({
  debts,
  cards,
  defaultStart,
  loadNotAssigned,
  onSave,
  onSaved,
  onCancel,
}: {
  /** Active debts, oldest first. */
  debts: PlanDebt[];
  cards: PaydayCard[];
  defaultStart: string;
  loadNotAssigned: (start: string) => Promise<number | null>;
  onSave: (input: DebtPaymentInput) => Promise<AddDebtPaymentResult>;
  onSaved: (saved: NonNullable<AddDebtPaymentResult["saved"]>) => void;
  onCancel: () => void;
}) {
  const [formError, setFormError] = useState<string>();
  const [pending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    setError,
    setValue,
    getValues,
    control,
    formState: { errors },
  } = useForm<DebtPaymentInput, unknown, DebtPayment>({
    resolver: zodResolver(debtPaymentSchema),
    mode: "onTouched",
    // One debt: already picked.
    defaultValues: { debtId: debts.length === 1 ? debts[0].id : "", amount: "", periodStart: defaultStart },
  });

  const debtId = useWatch({ control, name: "debtId" });
  const amountText = useWatch({ control, name: "amount" }) ?? "";
  const periodStart = useWatch({ control, name: "periodStart" });
  const centavos = parsePesoInput(amountText);
  const debt = debts.find((d) => d.id === debtId);
  const before = usePeriodNotAssigned(periodStart, loadNotAssigned);
  // More than what's left: said under the amount, before saving.
  const tooMuch = debt != null && centavos != null && centavos > debt.left;

  const onSubmit = () => {
    if (tooMuch) {
      setError("amount", { message: `Only ${formatPeso(debt.left)} left on ${debt.name}.` }, { shouldFocus: true });
      return;
    }
    setFormError(undefined);
    // Send what was typed: the Server Action parses and checks it again.
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
    <form noValidate onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <fieldset className="flex flex-col gap-1.5" aria-describedby={errors.debtId ? "debt-payment-debt-error" : undefined}>
        <legend className="mb-1.5 text-sm font-bold text-ink">Which debt?</legend>
        <div className="flex flex-col gap-2">
          {debts.map((d) => (
            <label
              key={d.id}
              className={cn(
                "flex min-h-14 cursor-pointer items-center justify-between gap-3 rounded-[14px] border-[1.5px] border-line bg-surface px-3.5 py-2.5",
                "has-checked:border-2 has-checked:border-green-600 has-checked:bg-mint",
                "has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-link",
              )}
            >
              <input type="radio" value={d.id} className="sr-only" {...register("debtId")} />
              <span className="flex min-w-0 flex-col">
                <span className="truncate font-extrabold text-ink">{d.name}</span>
                {d.flexible && <span className="text-[13px] text-text-2">When I can</span>}
              </span>
              <span className="shrink-0 text-sm font-bold text-text-2">{formatPeso(d.left)} left</span>
            </label>
          ))}
        </div>
        {errors.debtId && (
          <p id="debt-payment-debt-error" className="text-[13px] font-bold text-bad-fg">
            {errors.debtId.message}
          </p>
        )}
      </fieldset>

      <MoneyInput
        id="debt-payment-amount"
        label="Amount"
        placeholder="2,000"
        className="h-[50px]"
        hint={debt ? `${formatPeso(debt.left)} left on ${debt.name}. Extra payments count as Savings & debt payoff.` : undefined}
        error={errors.amount?.message ?? (tooMuch ? `Only ${formatPeso(debt.left)} left on ${debt.name}.` : undefined)}
        {...register("amount")}
      />

      <PaydayCards
        id="debt-payment-period"
        cards={cards}
        value={periodStart}
        onPick={(start) => setValue("periodStart", start, { shouldValidate: errors.periodStart != null })}
        error={errors.periodStart?.message}
      />

      {/* The effect in pesos before saving. */}
      <PeriodImpact card={cards.find((c) => c.start === periodStart)} before={before} amount={tooMuch ? null : centavos} />

      <FormError message={formError} />

      <div className="flex flex-col gap-2 md:flex-row-reverse">
        <SubmitButton
          pending={pending}
          pendingLabel="Adding…"
          // The sheet's one hero button (style-guide.md "Buttons").
          className="h-14 border-2 border-sticker bg-green-500 text-white shadow-sticker-sm hover:bg-green-500/90 aria-busy:bg-green-500 aria-busy:text-white md:flex-1"
        >
          Add to plan
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
  );
}
