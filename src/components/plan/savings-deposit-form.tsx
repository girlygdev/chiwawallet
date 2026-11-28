"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState, useTransition } from "react";
import { useForm, useWatch } from "react-hook-form";
import type { AddSavingsDepositResult } from "@/app/(app)/plan/actions";
import { FormError } from "@/components/auth/form-error";
import { SubmitButton } from "@/components/auth/submit-button";
import { MoneyInput } from "@/components/money-input";
import { type PaydayCard, PaydayCards, PeriodImpact, usePeriodNotAssigned } from "@/components/plan/payday-picker";
import { formatPeso, parsePesoInput } from "@/lib/money";
import type { PlanPot } from "@/lib/plan-periods";
import { potCapMessage } from "@/lib/pots";
import { cn } from "@/lib/utils";
import { type SavingsDeposit, type SavingsDepositInput, savingsDepositSchema } from "@/lib/validation/plan-item";

const FIELD_ORDER = ["potId", "amount", "periodStart"] as const;

/**
 * Plan savings (owner, Nov 28): money into a pot, from the chosen payday.
 * It counts as Savings & debt payoff. A pot with a target takes no more than
 * still fits (its cap); one whose target is covered can't be picked. The
 * impact box is Add one-off item's.
 */
export function SavingsDepositForm({
  pots,
  cards,
  defaultStart,
  loadNotAssigned,
  onSave,
  onSaved,
  onCancel,
}: {
  /** Every pot, oldest first. */
  pots: PlanPot[];
  cards: PaydayCard[];
  defaultStart: string;
  loadNotAssigned: (start: string) => Promise<number | null>;
  onSave: (input: SavingsDepositInput) => Promise<AddSavingsDepositResult>;
  onSaved: (saved: NonNullable<AddSavingsDepositResult["saved"]>) => void;
  onCancel: () => void;
}) {
  const [formError, setFormError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const open = pots.filter((p) => p.cap !== 0);

  const {
    register,
    handleSubmit,
    setError,
    setValue,
    getValues,
    control,
    formState: { errors },
  } = useForm<SavingsDepositInput, unknown, SavingsDeposit>({
    resolver: zodResolver(savingsDepositSchema),
    mode: "onTouched",
    // One pot that can take more: already picked.
    defaultValues: { potId: open.length === 1 ? open[0].id : "", amount: "", periodStart: defaultStart },
  });

  const potId = useWatch({ control, name: "potId" });
  const amountText = useWatch({ control, name: "amount" }) ?? "";
  const periodStart = useWatch({ control, name: "periodStart" });
  const centavos = parsePesoInput(amountText);
  const pot = pots.find((p) => p.id === potId);
  const before = usePeriodNotAssigned(periodStart, loadNotAssigned);
  // More than fits in the target: said under the amount, before saving.
  const tooMuch = pot?.cap != null && centavos != null && centavos > pot.cap;

  const onSubmit = () => {
    if (tooMuch) {
      setError("amount", { message: potCapMessage(pot.name, pot.cap!) }, { shouldFocus: true });
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
      <fieldset className="flex flex-col gap-1.5" aria-describedby={errors.potId ? "savings-deposit-pot-error" : undefined}>
        <legend className="mb-1.5 text-sm font-bold text-ink">Which pot?</legend>
        <div className="flex flex-col gap-2">
          {pots.map((p) => {
            const covered = p.cap === 0;
            return (
              <label
                key={p.id}
                className={cn(
                  "flex min-h-14 items-center justify-between gap-3 rounded-[14px] border-[1.5px] border-line bg-surface px-3.5 py-2.5",
                  covered ? "cursor-not-allowed opacity-60" : "cursor-pointer",
                  "has-checked:border-2 has-checked:border-green-600 has-checked:bg-mint",
                  "has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-link",
                )}
              >
                <input type="radio" value={p.id} disabled={covered} className="sr-only" {...register("potId")} />
                <span className="flex min-w-0 flex-col">
                  <span className="truncate font-extrabold text-ink">{p.name}</span>
                  {covered && <span className="text-[13px] text-text-2">Target covered</span>}
                </span>
                <span className="shrink-0 text-sm font-bold text-text-2">
                  {p.target != null ? `${formatPeso(p.balance)} of ${formatPeso(p.target)}` : `${formatPeso(p.balance)} saved`}
                </span>
              </label>
            );
          })}
        </div>
        {errors.potId && (
          <p id="savings-deposit-pot-error" className="text-[13px] font-bold text-bad-fg">
            {errors.potId.message}
          </p>
        )}
      </fieldset>

      <MoneyInput
        id="savings-deposit-amount"
        label="Amount"
        placeholder="1,000"
        className="h-[50px]"
        hint={pot ? amountHint(pot) : undefined}
        error={errors.amount?.message ?? (tooMuch ? potCapMessage(pot.name, pot.cap!) : undefined)}
        {...register("amount")}
      />

      <PaydayCards
        id="savings-deposit-period"
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

/** Under the amount: how much still fits, or that any amount works. */
function amountHint(pot: PlanPot): string {
  const group = "Savings count as Savings & debt payoff.";
  if (pot.cap == null) return `No target, so any amount works. ${group}`;
  return `Up to ${formatPeso(pot.cap)} more fits in ${pot.name}'s target. ${group}`;
}
