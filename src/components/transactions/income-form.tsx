"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CircleAlert } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";
import { type Resolver, useForm, useWatch } from "react-hook-form";
import type { AddSheetData, SaveIncomeResult, SheetSource } from "@/app/(app)/activity/actions";
import { FormError } from "@/components/auth/form-error";
import { SubmitButton } from "@/components/auth/submit-button";
import { TextField } from "@/components/auth/text-field";
import { formatPeso, formatPesoInput, parsePesoInput } from "@/lib/money";
import { formatPeriodRange, formatShortDate, getPeriod, todayInManila } from "@/lib/periods";
import { moneyInImpact } from "@/lib/transactions";
import { cn } from "@/lib/utils";
import { type IncomeFormInput, type IncomeValues, incomeSchemaFor, ONE_TIME } from "@/lib/validation/transaction";
import { AmountField } from "./amount-field";
import { DateButton } from "./date-button";

const FIELD_ORDER = ["amount", "source", "name", "date"] as const;

/** "₱25,000 expected · Nov 15" or "₱8,000 expected · next on Nov 30". */
function sourceLine(source: SheetSource): string {
  const expected = `${formatPeso(source.amount)} expected`;
  if (!source.payday) return expected;
  const date = formatShortDate(source.payday.date);
  return source.payday.thisPeriod ? `${expected} · ${date}` : `${expected} · next on ${date}`;
}

// The Income tab (activity.md §3 Income): amount, "Where is it from?", date
// received, then Save income. Picking a source fills in its expected amount,
// but never over an amount the user typed themselves (owner, Nov 23).
// Not yet: "Safe to spend goes from…" and "Help me give this money a job"
// (both need the Plan, Week 5).
export function IncomeForm({
  data,
  amountRef,
  defaultAmount,
  defaultSource = "",
  onAmountChange,
  onSave,
  onSaved,
}: {
  data: AddSheetData | null;
  amountRef: React.RefObject<HTMLInputElement | null>;
  defaultAmount: string;
  /** A source id or ONE_TIME, e.g. from the Income screen's Log one-time income. */
  defaultSource?: string;
  onAmountChange: (text: string) => void;
  onSave: (input: IncomeFormInput) => Promise<SaveIncomeResult>;
  onSaved: (saved: { id: string; amount: number }) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string>();
  const today = data?.today ?? todayInManila(new Date());

  // Same pattern as ExpenseForm: the schema needs `data`, read through a ref.
  const dataRef = useRef(data);
  useEffect(() => {
    dataRef.current = data;
  }, [data]);
  const resolver: Resolver<IncomeFormInput, unknown, IncomeValues> = (values, context, options) =>
    zodResolver(incomeSchemaFor({ today, firstPeriodStart: dataRef.current?.firstPeriodStart ?? today }))(
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
  } = useForm<IncomeFormInput, unknown, IncomeValues>({
    resolver,
    mode: "onSubmit",
    defaultValues: { amount: defaultAmount, source: defaultSource, name: "", date: today },
  });

  const amountText = useWatch({ control, name: "amount" }) ?? "";
  useEffect(() => onAmountChange(amountText), [amountText, onAmountChange]);
  const source = useWatch({ control, name: "source" });
  const date = useWatch({ control, name: "date" }) ?? today;
  const centavos = parsePesoInput(amountText);
  const validAmount = centavos != null && centavos > 0 ? centavos : null;

  // The text the last source pick put in the amount. A pick may replace that
  // (or an empty amount), but not something the user typed.
  // An amount that arrived with a source ("I got paid") counts as filled in.
  const [autoFilled, setAutoFilled] = useState<string | null>(
    defaultSource && defaultSource !== ONE_TIME && defaultAmount ? defaultAmount : null,
  );
  const pickSource = (value: string) => {
    setValue("source", value, { shouldValidate: errors.source != null });
    const picked = data?.sources.find((s) => s.id === value);
    if (picked && (amountText.trim() === "" || amountText === autoFilled)) {
      const text = formatPesoInput(picked.amount);
      setAutoFilled(text);
      setValue("amount", text, { shouldValidate: errors.amount != null });
    }
  };

  // The effect in pesos before saving. "Safe to spend goes from…" replaces
  // this once the Plan exists (Week 5).
  let impact: string | null = null;
  if (data && validAmount) {
    const inCurrent = date >= data.currentPeriod.start && date <= data.currentPeriod.end;
    if (inCurrent) {
      const { before, after } = moneyInImpact(data.periodRows, validAmount);
      impact = `Money in this period: ${formatPeso(before)} → ${formatPeso(after)}`;
    } else {
      const period = getPeriod(date, data.schedule);
      impact = `Goes in ${formatPeriodRange(period.start, period.end)}.`;
    }
  }

  const finish = (result: SaveIncomeResult) => {
    if (result.formError) setFormError(result.formError);
    const firstBad = FIELD_ORDER.find((f) => result.fieldErrors?.[f]);
    for (const f of FIELD_ORDER) {
      const message = result.fieldErrors?.[f];
      if (message) setError(f, { message }, { shouldFocus: f === firstBad });
    }
    if (result.ok && result.saved) onSaved(result.saved);
  };

  const onSubmit = (values: IncomeValues) => {
    setFormError(undefined);
    // Send what was typed: the Server Action parses it again with the same schema.
    const input: IncomeFormInput = {
      amount: amountText,
      source: values.incomeSourceId ?? ONE_TIME,
      name: values.note ?? "",
      date: values.date,
    };
    startTransition(async () => finish(await onSave(input)));
  };

  const sourceError = errors.source?.message;
  const options: { value: string; title: string; line: string; received: boolean }[] = [
    ...(data?.sources ?? []).map((s) => ({ value: s.id, title: s.name, line: sourceLine(s), received: s.received })),
    { value: ONE_TIME, title: "One-time income", line: "Bonus, 13th month, gift, refund, side sale", received: false },
  ];

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">
      <AmountField id="income-amount" field={register("amount")} amountRef={amountRef} error={errors.amount?.message} />

      <fieldset className="flex flex-col gap-2" aria-describedby={sourceError ? "income-source-error" : undefined}>
        <legend className="mb-1.5 text-sm font-bold text-ink">Where is it from?</legend>
        {data == null ? (
          <div aria-hidden className="flex flex-col gap-2">
            {[0, 1].map((i) => (
              <div key={i} className="h-[62px] animate-pulse rounded-[14px] bg-track motion-reduce:animate-none" />
            ))}
          </div>
        ) : (
          options.map((option) => {
            const checked = source === option.value;
            const inputId = `income-source-${option.value}`;
            return (
              // A real radio inside a label: the whole card is the hit area,
              // and arrow keys move between sources like any radio group.
              <label
                key={option.value}
                htmlFor={inputId}
                className={cn(
                  "flex min-h-[62px] cursor-pointer items-center gap-3 rounded-[14px] px-4 py-3 has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-link",
                  checked ? "border-2 border-green-600 bg-mint" : "border-[1.5px] border-line bg-surface",
                )}
              >
                <input
                  id={inputId}
                  type="radio"
                  name="income-source"
                  value={option.value}
                  checked={checked}
                  onChange={() => pickSource(option.value)}
                  className="size-5 shrink-0 accent-green-600"
                />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="text-[15px] font-extrabold text-ink">{option.title}</span>
                  <span className="text-[13px] text-text-3">{option.line}</span>
                </span>
                {option.received && (
                  // The Positive status tag (style-guide.md), on white when the
                  // card itself is mint.
                  <span
                    className={cn(
                      "shrink-0 rounded-full px-2 py-0.5 text-xs font-extrabold text-link-hover",
                      checked ? "bg-surface" : "bg-mint",
                    )}
                  >
                    Received
                  </span>
                )}
              </label>
            );
          })
        )}
        {sourceError && (
          <p id="income-source-error" className="flex items-center gap-1.5 text-[13px] font-bold text-bad-fg">
            <CircleAlert aria-hidden className="size-4 shrink-0" />
            {sourceError}
          </p>
        )}
      </fieldset>

      {source === ONE_TIME && (
        <TextField
          id="income-name"
          label="Name"
          placeholder="13th month pay"
          autoComplete="off"
          maxLength={100}
          error={errors.name?.message}
          className="h-[46px]"
          {...register("name")}
        />
      )}

      <DateButton
        id="income-date"
        label="Date received"
        value={date}
        onChange={(d) => setValue("date", d, { shouldValidate: errors.date != null })}
        today={today}
        min={data?.firstPeriodStart ?? today}
        error={errors.date?.message}
      />

      <div aria-live="polite">
        {impact && <p className="rounded-[14px] bg-mint px-4 py-3 text-sm font-bold text-link-hover">{impact}</p>}
      </div>

      <FormError message={formError} />

      <SubmitButton
        pending={pending}
        pendingLabel="Saving…"
        disabled={pending || data == null}
        className="h-14 border-2 border-sticker bg-green-500 text-white shadow-sticker-sm hover:bg-green-500/90 aria-busy:bg-green-500 aria-busy:text-white"
      >
        Save income
      </SubmitButton>
    </form>
  );
}
