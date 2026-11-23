"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useRef, useState, useTransition } from "react";
import { type Resolver, useForm, useWatch } from "react-hook-form";
import type { AddExpenseData, SaveExpenseResult } from "@/app/(app)/activity/actions";
import { FormError } from "@/components/auth/form-error";
import { SubmitButton } from "@/components/auth/submit-button";
import { TextField } from "@/components/auth/text-field";
import { formatPeso, parsePesoInput } from "@/lib/money";
import { formatPeriodRange, getPeriod, todayInManila } from "@/lib/periods";
import { moneyOutImpact } from "@/lib/transactions";
import {
  type TransactionFormInput,
  type TransactionValues,
  transactionSchemaFor,
} from "@/lib/validation/transaction";
import { CategoryGrid } from "./category-grid";
import { CategoryPicker } from "./category-picker";
import { DateButton } from "./date-button";

const FIELD_ORDER = ["amount", "categoryId", "date", "note"] as const;

// The Add expense form (activity.md §3): amount → category → Save in under
// 10 seconds; date and note are optional. `data` arrives a moment after the
// sheet opens; the amount field works before that, and Save waits for it.
//
// More swaps the form for the category picker. The form stays mounted (only
// hidden), so what was typed is kept; `picking` lives in the provider because
// the sheet's title and back arrow change with it.
export function ExpenseForm({
  data,
  amountRef,
  onSave,
  onSaved,
  picking,
  onPickingChange,
}: {
  data: AddExpenseData | null;
  amountRef: React.RefObject<HTMLInputElement | null>;
  onSave: (input: TransactionFormInput) => Promise<SaveExpenseResult>;
  onSaved: (saved: { id: string; amount: number }) => void;
  picking: boolean;
  onPickingChange: (picking: boolean) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string>();
  // The browser's Manila date until the server's arrives (same day either way).
  const today = data?.today ?? todayInManila(new Date());

  // The schema needs the first period's start, which comes with `data`. The
  // resolver reads the latest `data` through a ref each time it validates.
  const dataRef = useRef(data);
  useEffect(() => {
    dataRef.current = data;
  }, [data]);
  const resolver: Resolver<TransactionFormInput, unknown, TransactionValues> = (values, context, options) =>
    zodResolver(
      transactionSchemaFor({ today, firstPeriodStart: dataRef.current?.firstPeriodStart ?? today }),
    )(values, context, options);

  const {
    register,
    handleSubmit,
    setError,
    setValue,
    control,
    formState: { errors },
  } = useForm<TransactionFormInput, unknown, TransactionValues>({
    resolver,
    mode: "onSubmit",
    defaultValues: { type: "expense", amount: "", categoryId: "", date: today, note: "" },
  });

  const amountText = useWatch({ control, name: "amount" }) ?? "";
  const categoryId = useWatch({ control, name: "categoryId" });
  const date = useWatch({ control, name: "date" }) ?? today;
  const centavos = parsePesoInput(amountText);
  const validAmount = centavos != null && centavos > 0 ? centavos : null;

  // The effect in pesos before saving (CLAUDE.md UI rules). A date in an
  // earlier period says where it goes instead (owner, Nov 23).
  let impact: string | null = null;
  if (data && validAmount) {
    const inCurrent = date >= data.currentPeriod.start && date <= data.currentPeriod.end;
    if (inCurrent) {
      const { before, after } = moneyOutImpact(data.periodRows, validAmount);
      impact = `Money out this period: ${formatPeso(before)} → ${formatPeso(after)}`;
    } else {
      const period = getPeriod(date, data.schedule);
      impact = `Goes in ${formatPeriodRange(period.start, period.end)}.`;
    }
  }

  const finish = (result: SaveExpenseResult) => {
    if (result.formError) setFormError(result.formError);
    const firstBad = FIELD_ORDER.find((f) => result.fieldErrors?.[f]);
    for (const f of FIELD_ORDER) {
      const message = result.fieldErrors?.[f];
      if (message) setError(f, { message }, { shouldFocus: f === firstBad });
    }
    if (result.ok && result.saved) onSaved(result.saved);
  };

  const onSubmit = (values: TransactionValues) => {
    setFormError(undefined);
    // Send what was typed: the Server Action parses it again with the same schema.
    const input: TransactionFormInput = {
      type: "expense",
      amount: amountText,
      categoryId: values.categoryId,
      date: values.date,
      note: values.note ?? "",
    };
    startTransition(async () => finish(await onSave(input)));
  };

  const amountField = register("amount");

  // Back from the picker: focus the chosen tile, or More if nothing was
  // picked, so keyboard and screen-reader users land where they left.
  const gridRef = useRef<HTMLDivElement>(null);
  const wasPicking = useRef(false);
  useEffect(() => {
    if (wasPicking.current && !picking) {
      const grid = gridRef.current;
      (grid?.querySelector<HTMLElement>('[aria-pressed="true"]') ?? grid?.querySelector<HTMLElement>("[data-more]"))?.focus();
    }
    wasPicking.current = picking;
  }, [picking]);

  const pick = (id: string) => {
    setValue("categoryId", id, { shouldValidate: errors.categoryId != null });
    onPickingChange(false);
  };

  return (
    <>
      {picking && data && (
        <CategoryPicker
          categories={data.categories}
          recentIds={data.recentIds}
          targets={data.targets}
          value={categoryId || undefined}
          onPick={pick}
        />
      )}
      <form onSubmit={handleSubmit(onSubmit)} noValidate hidden={picking} className="flex flex-col gap-5">
        <div className="flex flex-col gap-1">
          <label htmlFor="expense-amount" className="text-sm font-bold text-ink">
            Amount
          </label>
          <div className="flex items-baseline gap-1.5">
            <span aria-hidden className="font-display text-4xl font-semibold text-text-3">
              ₱
            </span>
            <input
              {...amountField}
              ref={(el) => {
                amountField.ref(el);
                amountRef.current = el;
              }}
              id="expense-amount"
              type="text"
              inputMode="decimal"
              autoComplete="off"
              placeholder="0"
              aria-invalid={errors.amount ? true : undefined}
              aria-describedby={errors.amount ? "expense-amount-error" : undefined}
              className="w-full min-w-0 bg-transparent font-display text-[56px] leading-[1.1] font-semibold text-ink outline-none placeholder:text-placeholder"
            />
          </div>
          {errors.amount && (
            <p id="expense-amount-error" className="text-[13px] font-bold text-bad-fg">
              {errors.amount.message}
            </p>
          )}
        </div>

        <CategoryGrid
          categories={data?.categories ?? null}
          topCount={data?.topCount ?? 5}
          loading={data == null}
          value={categoryId || undefined}
          onChange={(id) => setValue("categoryId", id, { shouldValidate: errors.categoryId != null })}
          onMore={() => onPickingChange(true)}
          error={errors.categoryId?.message}
          ref={gridRef}
        />

        <DateButton
          id="expense-date"
          value={date}
          onChange={(d) => setValue("date", d, { shouldValidate: errors.date != null })}
          today={today}
          min={data?.firstPeriodStart ?? today}
          error={errors.date?.message}
        />

        <TextField
          id="expense-note"
          label="Note (optional)"
          placeholder="Lunch"
          autoComplete="off"
          maxLength={100}
          error={errors.note?.message}
          className="h-[46px]"
          {...register("note")}
        />

        <div aria-live="polite">
          {impact && <p className="rounded-[14px] bg-mint px-4 py-3 text-sm font-bold text-link-hover">{impact}</p>}
        </div>

        <FormError message={formError} />

        <SubmitButton
          pending={pending}
          pendingLabel="Saving…"
          // Waits for the sheet's data (the first period's start and the categories).
          disabled={pending || data == null}
          // The sheet's one hero button (style-guide.md "Buttons").
          className="h-14 border-2 border-sticker bg-green-500 text-white shadow-sticker-sm hover:bg-green-500/90 aria-busy:bg-green-500 aria-busy:text-white"
        >
          Save expense
        </SubmitButton>
      </form>
    </>
  );
}
