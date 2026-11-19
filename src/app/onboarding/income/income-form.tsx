"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { FormError } from "@/components/auth/form-error";
import { SubmitButton } from "@/components/auth/submit-button";
import { TextField } from "@/components/auth/text-field";
import { MoneyInput } from "@/components/money-input";
import { Segmented } from "@/components/segmented";
import { incomeImpact } from "@/lib/income";
import { formatPeso, formatPesoInput, parsePesoInput } from "@/lib/money";
import { type PaySchedule, paydayLabel } from "@/lib/periods";
import { cn } from "@/lib/utils";
import {
  type IncomeFormInput,
  type IncomeValues,
  incomeSchemaFor,
} from "@/lib/validation/income";
import { addIncome, removeIncome, updateIncome } from "../actions";

export type IncomeSource = {
  id: string;
  name: string;
  amount: number;
  amount_varies: boolean;
  pay_slot: string;
};

type Props = {
  schedule: PaySchedule;
  /** The budget's other sources, for the before → after impact lines. */
  otherSources: IncomeSource[];
  /** Editing an existing source; leave out to add a new one. */
  source?: IncomeSource;
  /** "sheet": inside the bottom sheet. "inline": desktop's dashed add box. */
  layout: "sheet" | "inline";
  /** Called after a save or remove, e.g. to close the sheet. */
  onDone?: () => void;
};

const fieldOrder = ["name", "amount", "amountVaries", "paySlot"] as const;

// Add or edit one income source (income.md §4, onboarding.md §4).
export function IncomeForm({ schedule, otherSources, source, layout, onDone }: Props) {
  const router = useRouter();
  const [formError, setFormError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const [confirmingRemove, setConfirmingRemove] = useState(false);
  const semiMonthly = schedule.frequency === "semi_monthly";

  const blank: IncomeFormInput = { name: "", amount: "", amountVaries: false, paySlot: "every" };
  const {
    register,
    handleSubmit,
    setError,
    reset,
    control,
    formState: { errors },
  } = useForm<IncomeFormInput, unknown, IncomeValues>({
    resolver: zodResolver(incomeSchemaFor(schedule.frequency)),
    mode: "onTouched",
    defaultValues: source
      ? {
          name: source.name,
          amount: formatPesoInput(source.amount),
          amountVaries: source.amount_varies,
          paySlot: source.pay_slot as IncomeFormInput["paySlot"],
        }
      : blank,
  });

  const amountText = useWatch({ control, name: "amount" });
  const paySlot = useWatch({ control, name: "paySlot" });
  const amountVaries = useWatch({ control, name: "amountVaries" });
  const centavos = parsePesoInput(amountText ?? "");
  const validAmount = centavos != null && centavos > 0 ? centavos : null;

  const finish = (result: { ok?: true; formError?: string; fieldErrors?: Partial<Record<string, string>> }) => {
    if (result.formError) setFormError(result.formError);
    const firstBad = fieldOrder.find((f) => result.fieldErrors?.[f]);
    for (const f of fieldOrder) {
      const message = result.fieldErrors?.[f];
      if (message) setError(f, { message }, { shouldFocus: f === firstBad });
    }
    if (result.ok) {
      if (!source) reset(blank);
      // Re-reads the page's server data so the list and totals update.
      router.refresh();
      onDone?.();
    }
  };

  const onSubmit = (values: IncomeValues) => {
    setFormError(undefined);
    // Send the typed amount, not the parsed centavos: the Server Action
    // validates and parses the raw input again with the same schema.
    const input: IncomeFormInput = {
      name: values.name,
      amount: amountText ?? "",
      amountVaries: values.amountVaries,
      paySlot: values.paySlot,
    };
    startTransition(async () => {
      finish(source ? await updateIncome(source.id, input) : await addIncome(input));
    });
  };

  const onRemove = () => {
    if (!source) return;
    setFormError(undefined);
    startTransition(async () => finish(await removeIncome(source.id)));
  };

  const impact = validAmount
    ? incomeImpact(otherSources, { amount: validAmount, pay_slot: semiMonthly ? paySlot : "every" }, schedule)
    : [];

  return (
    <form noValidate onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <div className={cn("flex flex-col gap-4", layout === "inline" && "lg:grid lg:grid-cols-2")}>
        <TextField
          id={`${source?.id ?? layout}-name`}
          label="Income name"
          placeholder="e.g. Main job"
          autoComplete="off"
          className="h-12"
          error={errors.name?.message}
          {...register("name")}
        />
        <MoneyInput
          id={`${source?.id ?? layout}-amount`}
          label="Amount each time"
          placeholder="25,000"
          error={errors.amount?.message}
          {...register("amount")}
        />
      </div>

      <div className={cn("flex flex-col gap-4", layout === "inline" && "lg:grid lg:grid-cols-2")}>
        <Controller
          control={control}
          name="amountVaries"
          render={({ field }) => (
            <Segmented
              name={`${source?.id ?? layout}-varies`}
              legend="Amount is"
              options={[
                { value: "fixed", label: "Fixed" },
                { value: "varies", label: "Varies" },
              ]}
              value={field.value ? "varies" : "fixed"}
              onChange={(v) => field.onChange(v === "varies")}
            />
          )}
        />
        {/* Weekly and monthly budgets have one payday: no choice, saves "every". */}
        {semiMonthly && (
          <Controller
            control={control}
            name="paySlot"
            render={({ field }) => (
              <Segmented
                name={`${source?.id ?? layout}-slot`}
                legend="Lands on"
                options={[
                  { value: "payday_1", label: paydayLabel(schedule, "payday_1") },
                  { value: "payday_2", label: paydayLabel(schedule, "payday_2") },
                  { value: "every", label: "Every payday" },
                ]}
                value={field.value}
                onChange={field.onChange}
                error={errors.paySlot?.message}
              />
            )}
          />
        )}
      </div>

      {amountVaries && validAmount && (
        <p className="text-[13px] text-text-3">
          Varies: we plan with {formatPeso(validAmount)} and show what actually came in.
        </p>
      )}

      {/* The effect in pesos before saving (CLAUDE.md UI rules). */}
      <div aria-live="polite">
        {impact.length > 0 && (
          <ul className="flex flex-col gap-1 rounded-[14px] bg-mint px-4 py-3 text-sm text-link-hover">
            {impact.map((line) => (
              <li key={line.label}>
                <span className="font-bold">{line.label}:</span> {formatPeso(line.before)} →{" "}
                <span className="font-extrabold">{formatPeso(line.after)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <FormError message={formError} />

      <div className={cn("flex flex-col gap-3", layout === "inline" && "lg:items-end")}>
        <div className={cn("w-full", layout === "inline" && "lg:w-56")}>
          <SubmitButton
            pending={pending && !confirmingRemove}
            pendingLabel="Saving…"
            disabled={pending}
            className={
              layout === "sheet"
                ? // The sheet's one hero button (style-guide.md "Buttons").
                  "h-14 border-2 border-sticker bg-green-500 text-white shadow-sticker-sm hover:bg-green-500/90 aria-busy:bg-green-500 aria-busy:text-white"
                : // Soft "Add income" button in the desktop dashed box.
                  "h-12 bg-mint text-link-hover hover:bg-mint/80 aria-busy:bg-mint aria-busy:text-link-hover"
            }
          >
            {source ? "Save changes" : layout === "sheet" ? "Add income source" : "Add income"}
          </SubmitButton>
        </div>

        {source && !confirmingRemove && (
          <button
            type="button"
            onClick={() => setConfirmingRemove(true)}
            className="h-11 self-center rounded-md px-3 text-[15px] font-extrabold text-danger outline-link focus-visible:outline-2"
          >
            Remove income
          </button>
        )}
        {source && confirmingRemove && (
          <div role="group" aria-label={`Remove ${source.name}?`} className="flex flex-col gap-2 rounded-[14px] bg-bg p-3">
            <p className="text-sm font-bold text-ink">Remove {source.name}?</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                autoFocus
                onClick={() => setConfirmingRemove(false)}
                className="h-11 rounded-md border-[1.5px] border-line bg-surface font-extrabold text-ink outline-link focus-visible:outline-2"
              >
                Keep it
              </button>
              <button
                type="button"
                onClick={onRemove}
                disabled={pending}
                className="h-11 rounded-md bg-danger font-extrabold text-white outline-link focus-visible:outline-2 disabled:opacity-60"
              >
                {pending ? "Removing…" : "Remove"}
              </button>
            </div>
          </div>
        )}
      </div>
    </form>
  );
}
