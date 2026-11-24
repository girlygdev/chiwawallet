"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CircleAlert, Lock, Plus } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";
import { Controller, type Resolver, useForm, useWatch } from "react-hook-form";
import type { AddSheetData, EditingTransaction, SaveSavingsResult } from "@/app/(app)/activity/actions";
import { FormError } from "@/components/auth/form-error";
import { SubmitButton } from "@/components/auth/submit-button";
import { Segmented } from "@/components/segmented";
import { formatPeso, formatPesoInput, parsePesoInput } from "@/lib/money";
import { todayInManila } from "@/lib/periods";
import { potBalanceAfter, potProgress } from "@/lib/pots";
import { cn } from "@/lib/utils";
import { type SavingsFormInput, type SavingsValues, savingsSchemaFor } from "@/lib/validation/transaction";
import { AmountField } from "./amount-field";
import { CategoryIconTile } from "./category-grid";
import { DateButton } from "./date-button";
import { DeleteLink } from "./delete-link";

const FIELD_ORDER = ["amount", "potId", "date"] as const;
const percent = new Intl.NumberFormat("en-PH", { style: "percent", maximumFractionDigits: 0 });

// The Savings tab (activity.md §3 Savings, week-4-tasks.md 4e): Add to pot or
// Withdraw, the amount, "Which pot?", the date, then a button that says
// exactly what happens. Locked pots take deposits only. Not yet: the
// "Planned ₱2,000" tag and "This also ticks off…" (plan items, Week 5).
export function SavingsForm({
  data,
  amountRef,
  defaultAmount,
  defaultPotId = "",
  defaultDirection = "add",
  onAmountChange,
  onSave,
  onSaved,
  onNewPot,
  editing = null,
  onDelete,
}: {
  data: AddSheetData | null;
  amountRef: React.RefObject<HTMLInputElement | null>;
  defaultAmount: string;
  /** A pot already chosen, e.g. from its details page. */
  defaultPotId?: string;
  defaultDirection?: "add" | "withdraw";
  onAmountChange: (text: string) => void;
  onSave: (input: SavingsFormInput) => Promise<SaveSavingsResult>;
  onSaved: (saved: { id: string; amount: number }, potName: string) => void;
  /** "+ New pot": closes the sheet and opens New pot on the Savings page. */
  onNewPot: () => void;
  editing?: EditingTransaction | null;
  onDelete?: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string>();
  const today = data?.today ?? todayInManila(new Date());

  // Same pattern as ExpenseForm: the schema needs `data`, read through a ref.
  const dataRef = useRef(data);
  useEffect(() => {
    dataRef.current = data;
  }, [data]);
  const resolver: Resolver<SavingsFormInput, unknown, SavingsValues> = (values, context, options) =>
    zodResolver(savingsSchemaFor({ today, firstPeriodStart: dataRef.current?.firstPeriodStart ?? today }))(
      values,
      context,
      options,
    );

  const {
    register,
    handleSubmit,
    setError,
    setValue,
    control,
    formState: { errors },
  } = useForm<SavingsFormInput, unknown, SavingsValues>({
    resolver,
    mode: "onSubmit",
    defaultValues: editing
      ? {
          // A withdrawal is saved negative; the form shows it as Withdraw ₱X.
          direction: editing.amount < 0 ? "withdraw" : "add",
          amount: formatPesoInput(Math.abs(editing.amount)),
          potId: editing.potId ?? "",
          date: editing.date,
        }
      : { direction: defaultDirection, amount: defaultAmount, potId: defaultPotId, date: today },
  });

  const amountText = useWatch({ control, name: "amount" }) ?? "";
  useEffect(() => onAmountChange(amountText), [amountText, onAmountChange]);
  const direction = useWatch({ control, name: "direction" });
  const potId = useWatch({ control, name: "potId" });
  const date = useWatch({ control, name: "date" }) ?? today;
  const centavos = parsePesoInput(amountText);
  const validAmount = centavos != null && centavos > 0 ? centavos : null;
  const withdrawing = direction === "withdraw";
  const pots = data?.pots ?? [];
  const pot = pots.find((p) => p.id === potId);

  // A locked pot can't be withdrawn from: switching to Withdraw drops it.
  const pickDirection = (next: "add" | "withdraw") => {
    setValue("direction", next);
    if (next === "withdraw" && pot?.is_locked) setValue("potId", "");
  };

  // "Travel will be at ₱8,000 of ₱20,000 (40%)." Editing takes the row's
  // old amount out of its pot's balance first.
  const signed = validAmount == null ? null : withdrawing ? -validAmount : validAmount;
  const after =
    pot && signed != null
      ? potBalanceAfter(pot.balance, signed, editing && editing.potId === pot.id ? editing.amount : 0)
      : null;

  const onSubmit = (values: SavingsValues) => {
    setFormError(undefined);
    // Send what was typed: the Server Action parses it again with the same schema.
    const input: SavingsFormInput = { direction: values.direction, amount: amountText, potId: values.potId, date: values.date };
    startTransition(async () => {
      const result = await onSave(input);
      if (result.formError) setFormError(result.formError);
      const firstBad = FIELD_ORDER.find((f) => result.fieldErrors?.[f]);
      for (const f of FIELD_ORDER) {
        const message = result.fieldErrors?.[f];
        if (message) setError(f, { message }, { shouldFocus: f === firstBad });
      }
      if (result.ok && result.saved) onSaved(result.saved, pot?.name ?? "your pot");
    });
  };

  const potError = errors.potId?.message;
  const buttonLabel = editing
    ? "Save changes"
    : pot && validAmount
      ? withdrawing
        ? `Withdraw ${formatPeso(validAmount)} from ${pot.name}`
        : `Add ${formatPeso(validAmount)} to ${pot.name}`
      : withdrawing
        ? "Withdraw"
        : "Add to pot";

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">
      <Controller
        control={control}
        name="direction"
        render={({ field }) => (
          <Segmented
            name="savings-direction"
            legend="What are you doing?"
            options={[
              { value: "add", label: "Add to pot" },
              { value: "withdraw", label: "Withdraw" },
            ]}
            value={field.value}
            onChange={pickDirection}
            error={errors.direction?.message}
          />
        )}
      />

      <AmountField id="savings-amount" field={register("amount")} amountRef={amountRef} error={errors.amount?.message} />

      <fieldset className="flex flex-col gap-2" aria-describedby={potError ? "savings-pot-error" : undefined}>
        <legend className="mb-1.5 text-sm font-bold text-ink">Which pot?</legend>
        {data == null ? (
          <div aria-hidden className="flex flex-col gap-2">
            {[0, 1].map((i) => (
              <div key={i} className="h-[62px] animate-pulse rounded-[14px] bg-track motion-reduce:animate-none" />
            ))}
          </div>
        ) : pots.length === 0 ? (
          <p className="rounded-[14px] bg-track px-4 py-3 text-sm text-text-2">No pots yet. Make one first.</p>
        ) : (
          pots.map((option) => {
            const checked = potId === option.id;
            const locked = option.is_locked && withdrawing;
            const inputId = `savings-pot-${option.id}`;
            return (
              // A real radio inside a label, like the Income tab's sources.
              <label
                key={option.id}
                htmlFor={inputId}
                className={cn(
                  "flex min-h-[62px] items-center gap-3 rounded-[14px] px-4 py-3 has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-link",
                  checked ? "border-2 border-green-600 bg-mint" : "border-[1.5px] border-line bg-surface",
                  locked ? "cursor-not-allowed opacity-60" : "cursor-pointer",
                )}
              >
                <input
                  id={inputId}
                  type="radio"
                  name="savings-pot"
                  value={option.id}
                  checked={checked}
                  disabled={locked}
                  onChange={() => setValue("potId", option.id, { shouldValidate: errors.potId != null })}
                  className="sr-only"
                />
                <CategoryIconTile icon={option.icon} color={option.color} />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-[15px] font-extrabold text-ink">{option.name}</span>
                  <span className="flex items-center gap-1 text-[13px] text-text-3">
                    {option.is_locked && <Lock aria-hidden size={12} />}
                    {formatPeso(option.balance)}
                    {option.target_amount != null && ` of ${formatPeso(option.target_amount)}`}
                    {option.is_locked && " · locked, deposits only"}
                  </span>
                </span>
              </label>
            );
          })
        )}
        {data != null && (
          <button
            type="button"
            onClick={onNewPot}
            className="flex h-11 items-center gap-1.5 self-start rounded-md px-1 text-sm font-extrabold text-link outline-link hover:text-link-hover focus-visible:outline-2"
          >
            <Plus aria-hidden size={18} strokeWidth={2.5} />
            New pot
          </button>
        )}
        {potError && (
          <p id="savings-pot-error" className="flex items-center gap-1.5 text-[13px] font-bold text-bad-fg">
            <CircleAlert aria-hidden className="size-4 shrink-0" />
            {potError}
          </p>
        )}
      </fieldset>

      <DateButton
        id="savings-date"
        value={date}
        onChange={(d) => setValue("date", d, { shouldValidate: errors.date != null })}
        today={today}
        min={data?.firstPeriodStart ?? today}
        error={errors.date?.message}
      />

      {/* The effect in pesos before saving (CLAUDE.md UI rules). */}
      <div aria-live="polite">
        {pot && after != null && (
          <p
            className={cn(
              "rounded-[14px] px-4 py-3 text-sm font-bold",
              after < 0 ? "bg-warn-bg text-warn-fg" : "bg-mint text-link-hover",
            )}
          >
            {after < 0
              ? `${pot.name} only has ${formatPeso(potBalanceAfter(after, -(signed ?? 0)))}.`
              : `${pot.name} will be at ${formatPeso(after)}${
                  pot.target_amount != null
                    ? ` of ${formatPeso(pot.target_amount)} (${percent.format(potProgress(after, pot.target_amount) ?? 0)})`
                    : ""
                }.`}
          </p>
        )}
      </div>

      <FormError message={formError} />

      <SubmitButton
        pending={pending}
        pendingLabel="Saving…"
        disabled={pending || data == null}
        // The sheet's one hero button (style-guide.md "Buttons").
        className="h-14 border-2 border-sticker bg-green-500 text-white shadow-sticker-sm hover:bg-green-500/90 aria-busy:bg-green-500 aria-busy:text-white"
      >
        {buttonLabel}
      </SubmitButton>

      {editing && onDelete && <DeleteLink onClick={onDelete} />}
    </form>
  );
}
