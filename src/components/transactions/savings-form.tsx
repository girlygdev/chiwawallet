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
import { potBalanceAfter, potProgress, potTransfer } from "@/lib/pots";
import { cn } from "@/lib/utils";
import { type SavingsFormInput, type SavingsValues, savingsSchemaFor } from "@/lib/validation/transaction";
import { AmountField } from "./amount-field";
import { CategoryIconTile } from "./category-grid";
import { DateButton } from "./date-button";
import { DeleteLink } from "./delete-link";

const FIELD_ORDER = ["amount", "potId", "toPotId", "date"] as const;
const percent = new Intl.NumberFormat("en-PH", { style: "percent", maximumFractionDigits: 0 });

// The Transfer tab (activity.md §3, "Changed Nov 24"; 4e, 6d-1): To a pot,
// From a pot or Pot to pot, the amount, the pot (and the pot to move to),
// the date, then a button that says exactly what happens. Locked pots take
// deposits only. A pot with an unpaid planned deposit this period shows
// "Planned ₱2,000", and adding to it ticks that off. To a debt comes in 6d-2.
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
  defaultDirection?: "add" | "withdraw" | "move";
  onAmountChange: (text: string) => void;
  onSave: (input: SavingsFormInput) => Promise<SaveSavingsResult>;
  onSaved: (saved: NonNullable<SaveSavingsResult["saved"]>, potName: string) => void;
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
          toPotId: "",
          date: editing.date,
        }
      : { direction: defaultDirection, amount: defaultAmount, potId: defaultPotId, toPotId: "", date: today },
  });

  const amountText = useWatch({ control, name: "amount" }) ?? "";
  useEffect(() => onAmountChange(amountText), [amountText, onAmountChange]);
  const direction = useWatch({ control, name: "direction" });
  const potId = useWatch({ control, name: "potId" });
  const toPotId = useWatch({ control, name: "toPotId" }) ?? "";
  const date = useWatch({ control, name: "date" }) ?? today;
  const centavos = parsePesoInput(amountText);
  const validAmount = centavos != null && centavos > 0 ? centavos : null;
  const withdrawing = direction === "withdraw";
  const moving = direction === "move";
  const pots = data?.pots ?? [];
  const pot = pots.find((p) => p.id === potId);
  const toPot = moving ? pots.find((p) => p.id === toPotId && p.id !== potId) : undefined;
  // "Planned ₱2,000" is this period's: only for a deposit dated in it.
  const inCurrent = data != null && date >= data.currentPeriod.start && date <= data.currentPeriod.end;
  const showPlanned = direction === "add" && !editing && inCurrent;

  // A locked pot can't be taken from: withdrawing or moving drops it.
  const pickDirection = (next: "add" | "withdraw" | "move") => {
    setValue("direction", next);
    if (next !== "add" && pot?.is_locked) setValue("potId", "");
  };

  // "Travel will be at ₱8,000 of ₱20,000 (40%)." Editing takes the row's
  // old amount out of its pot's balance first.
  const signed = validAmount == null ? null : withdrawing ? -validAmount : validAmount;
  const after =
    pot && signed != null && !moving
      ? potBalanceAfter(pot.balance, signed, editing && editing.potId === pot.id ? editing.amount : 0)
      : null;
  // Pot to pot: both balances before → after; cash doesn't change.
  const move = moving && pot && toPot && validAmount != null ? potTransfer(pot.balance, toPot.balance, validAmount) : null;

  const onSubmit = (values: SavingsValues) => {
    setFormError(undefined);
    // Send what was typed: the Server Action parses it again with the same schema.
    const input: SavingsFormInput = {
      direction: values.direction,
      amount: amountText,
      potId: values.potId,
      toPotId: values.toPotId ?? "",
      date: values.date,
    };
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
    : moving
      ? toPot && validAmount
        ? `Move ${formatPeso(validAmount)} to ${toPot.name}`
        : "Move"
      : pot && validAmount
        ? withdrawing
          ? `Withdraw ${formatPeso(validAmount)} from ${pot.name}`
          : `Add ${formatPeso(validAmount)} to ${pot.name}`
        : withdrawing
          ? "Withdraw"
          : "Add to pot";

  // One radio card per pot. `takeFrom`: withdrawing or moving out, so a
  // locked pot is disabled. `except`: the pot being moved from.
  const potCards = (group: string, value: string, onPick: (id: string) => void, takeFrom: boolean, except?: string) =>
    pots
      .filter((option) => option.id !== except)
      .map((option) => {
        const checked = value === option.id;
        const locked = option.is_locked && takeFrom;
        const inputId = `${group}-${option.id}`;
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
              name={group}
              value={option.id}
              checked={checked}
              disabled={locked}
              onChange={() => onPick(option.id)}
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
            {showPlanned && option.planned != null && (
              <span className="shrink-0 rounded-full bg-info-bg px-2 py-0.5 text-xs font-bold text-info-fg">
                Planned {formatPeso(option.planned)}
              </span>
            )}
          </label>
        );
      });

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">
      <Controller
        control={control}
        name="direction"
        render={({ field }) => (
          <Segmented
            name="savings-direction"
            legend="What are you doing?"
            // Editing changes one row, so a move isn't offered there.
            options={[
              { value: "add", label: "To a pot" },
              { value: "withdraw", label: "From a pot" },
              ...(editing ? [] : [{ value: "move" as const, label: "Pot to pot" }]),
            ]}
            value={field.value}
            onChange={pickDirection}
            error={errors.direction?.message}
          />
        )}
      />

      <AmountField id="savings-amount" field={register("amount")} amountRef={amountRef} error={errors.amount?.message} />

      <fieldset className="flex flex-col gap-2" aria-describedby={potError ? "savings-pot-error" : undefined}>
        <legend className="mb-1.5 text-sm font-bold text-ink">{moving ? "From which pot?" : "Which pot?"}</legend>
        {data == null ? (
          <div aria-hidden className="flex flex-col gap-2">
            {[0, 1].map((i) => (
              <div key={i} className="h-[62px] animate-pulse rounded-[14px] bg-track motion-reduce:animate-none" />
            ))}
          </div>
        ) : pots.length === 0 ? (
          <p className="rounded-[14px] bg-track px-4 py-3 text-sm text-text-2">No pots yet. Make one first.</p>
        ) : (
          potCards("savings-pot", potId, (id) => setValue("potId", id, { shouldValidate: errors.potId != null }), withdrawing || moving)
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

      {moving && pots.length > 1 && (
        <fieldset className="flex flex-col gap-2" aria-describedby={errors.toPotId ? "savings-to-pot-error" : undefined}>
          <legend className="mb-1.5 text-sm font-bold text-ink">To which pot?</legend>
          {potCards("savings-to-pot", toPotId, (id) => setValue("toPotId", id, { shouldValidate: errors.toPotId != null }), false, potId)}
          {errors.toPotId && (
            <p id="savings-to-pot-error" className="flex items-center gap-1.5 text-[13px] font-bold text-bad-fg">
              <CircleAlert aria-hidden className="size-4 shrink-0" />
              {errors.toPotId.message}
            </p>
          )}
        </fieldset>
      )}

      <DateButton
        id="savings-date"
        value={date}
        onChange={(d) => setValue("date", d, { shouldValidate: errors.date != null })}
        today={today}
        min={data?.firstPeriodStart ?? today}
        error={errors.date?.message}
      />

      {/* The effect in pesos before saving (CLAUDE.md UI rules). */}
      <div aria-live="polite" className="flex flex-col gap-2">
        {move && pot && toPot && (
          <p
            className={cn(
              "rounded-[14px] px-4 py-3 text-sm font-bold",
              move.from.after < 0 ? "bg-warn-bg text-warn-fg" : "bg-mint text-link-hover",
            )}
          >
            {move.from.after < 0
              ? `${pot.name} only has ${formatPeso(move.from.before)}.`
              : `${pot.name} ${formatPeso(move.from.before)} → ${formatPeso(move.from.after)} · ${toPot.name} ${formatPeso(move.to.before)} → ${formatPeso(move.to.after)}. Your cash stays the same.`}
          </p>
        )}
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
        {/* "This also ticks off…" (activity.md §3): the deposit pays the planned item. */}
        {showPlanned && pot?.planned != null && after != null && (
          <p className="rounded-[14px] bg-mint px-4 py-3 text-sm font-bold text-link-hover">
            This also ticks off the {formatPeso(pot.planned)} planned for this period.
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
