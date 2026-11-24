"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { FormError } from "@/components/auth/form-error";
import { SubmitButton } from "@/components/auth/submit-button";
import { FieldShell, inputClassName, TextField } from "@/components/auth/text-field";
import { MoneyInput } from "@/components/money-input";
import { Segmented } from "@/components/segmented";
import { type DebtTerms, debtSchedule, paydayFor } from "@/lib/debts";
import { formatPeso, formatPesoInput, parsePesoInput } from "@/lib/money";
import { formatShortDate, type PaySchedule } from "@/lib/periods";
import { cn } from "@/lib/utils";
import {
  type DebtFormInput,
  type DebtValues,
  debtSchema,
  lastPaymentNote,
  suggestedPayment,
} from "@/lib/validation/debt";

export type EditableDebt = DebtTerms & {
  id: string;
  name: string;
  lender: string | null;
  interest_rate: number | null;
  paid_off_at: string | null;
};

export type DebtFormResult = { ok?: true; formError?: string; fieldErrors?: Partial<Record<string, string>> };

const FIELD_ORDER = ["name", "lender", "total", "numPayments", "firstDueDate", "payment", "interestRate"] as const;
const COUNTS = Array.from({ length: 59 }, (_, i) => i + 2);
/** The preview shows this many payments, then "…", then the last one. */
const PREVIEW_ROWS = 6;

/**
 * New and Edit debt (debts.md §4). "Each payment" fills in total ÷ number of
 * payments until the user types their own. The schedule preview shows each
 * payment's date and payday, the debt-free date, and (in yellow) what the
 * last payment becomes when the payments don't add up to the total.
 */
export function DebtForm({
  schedule,
  debt,
  onSave,
  onPaidOffChange,
  onDeleteRequest,
  onDone,
}: {
  schedule: PaySchedule;
  /** Editing an existing debt; leave out to add one. */
  debt?: EditableDebt;
  onSave: (input: DebtFormInput) => Promise<DebtFormResult>;
  /** Edit only: "Mark as paid off" or "Move back to active". */
  onPaidOffChange?: (paidOff: boolean) => Promise<DebtFormResult>;
  onDeleteRequest?: () => void;
  onDone: () => void;
}) {
  const router = useRouter();
  const [formError, setFormError] = useState<string>();
  const [pending, startTransition] = useTransition();
  // A new debt's payment follows total ÷ number until it's typed by hand.
  const [paymentTyped, setPaymentTyped] = useState(debt != null);
  const id = debt?.id ?? "new-debt";

  const {
    register,
    handleSubmit,
    setError,
    setValue,
    control,
    formState: { errors },
  } = useForm<DebtFormInput, unknown, DebtValues>({
    resolver: zodResolver(debtSchema),
    mode: "onTouched",
    defaultValues: debt
      ? {
          name: debt.name,
          lender: debt.lender ?? "",
          total: formatPesoInput(debt.total_amount),
          paymentType: debt.payment_type,
          numPayments: debt.payment_type === "one_time" ? 3 : debt.num_payments,
          payment: formatPesoInput(debt.payment_amount),
          firstDueDate: debt.first_due_date,
          interestRate: debt.interest_rate != null ? String(debt.interest_rate) : "",
        }
      : {
          name: "",
          lender: "",
          total: "",
          paymentType: "installments",
          numPayments: 3,
          payment: "",
          firstDueDate: "",
          interestRate: "",
        },
  });

  const [totalText, paymentType, numPayments, paymentText, firstDueDate] = useWatch({
    control,
    name: ["total", "paymentType", "numPayments", "payment", "firstDueDate"],
  });
  const installments = paymentType === "installments";
  const total = parsePesoInput(totalText ?? "");
  const validTotal = total != null && total > 0 ? total : null;

  // Fill in "Each payment" from the total and the number, unless typed.
  const fillPayment = (nextTotal: number | null, count: number) => {
    if (paymentTyped || nextTotal == null || nextTotal <= 0) return;
    setValue("payment", formatPesoInput(suggestedPayment(nextTotal, count)));
  };

  // The preview, once everything it needs is valid.
  const payment = installments ? parsePesoInput(paymentText ?? "") : validTotal;
  const terms: DebtTerms | null =
    validTotal != null &&
    payment != null &&
    payment > 0 &&
    /^\d{4}-\d{2}-\d{2}$/.test(firstDueDate ?? "") &&
    (!installments || payment * (numPayments - 1) < validTotal)
      ? {
          total_amount: validTotal,
          payment_type: paymentType,
          num_payments: installments ? numPayments : 1,
          payment_amount: payment,
          first_due_date: firstDueDate!,
        }
      : null;
  const preview = terms ? debtSchedule(terms) : [];
  const note = terms && installments ? lastPaymentNote(terms.total_amount, terms.num_payments, terms.payment_amount) : null;
  const shown =
    preview.length > PREVIEW_ROWS + 1 ? [...preview.slice(0, PREVIEW_ROWS), null, preview[preview.length - 1]] : preview;

  const finish = (result: DebtFormResult) => {
    if (result.formError) setFormError(result.formError);
    const firstBad = FIELD_ORDER.find((f) => result.fieldErrors?.[f]);
    for (const f of FIELD_ORDER) {
      const message = result.fieldErrors?.[f];
      if (message) setError(f, { message }, { shouldFocus: f === firstBad });
    }
    if (result.ok) {
      router.refresh();
      onDone();
    }
  };

  const onSubmit = (values: DebtValues) => {
    setFormError(undefined);
    // Send what was typed: the Server Action parses it again with the same schema.
    const input: DebtFormInput = {
      name: values.name,
      lender: values.lender ?? "",
      total: totalText ?? "",
      paymentType: values.paymentType,
      numPayments: installments ? values.numPayments : 1,
      payment: paymentText ?? "",
      firstDueDate: values.firstDueDate,
      interestRate: values.interestRate != null ? String(values.interestRate) : "",
    };
    startTransition(async () => finish(await onSave(input)));
  };

  const togglePaidOff = () => {
    if (!onPaidOffChange || !debt) return;
    setFormError(undefined);
    startTransition(async () => finish(await onPaidOffChange(debt.paid_off_at == null)));
  };

  const totalField = register("total");

  return (
    <form noValidate onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <TextField
        id={`${id}-name`}
        label="Debt name"
        placeholder="e.g. Credit card"
        autoComplete="off"
        maxLength={40}
        className="h-[50px]"
        error={errors.name?.message}
        {...register("name")}
      />
      <TextField
        id={`${id}-lender`}
        label="Lender (optional)"
        placeholder="e.g. bank or app"
        autoComplete="off"
        maxLength={40}
        className="h-12"
        error={errors.lender?.message}
        {...register("lender")}
      />
      <MoneyInput
        id={`${id}-total`}
        label="Total amount owed"
        placeholder="15,000"
        error={errors.total?.message}
        {...totalField}
        onChange={(e) => {
          void totalField.onChange(e);
          fillPayment(parsePesoInput(e.target.value), numPayments);
        }}
      />

      <Controller
        control={control}
        name="paymentType"
        render={({ field }) => (
          <Segmented
            name={`${id}-type`}
            legend="How will you pay it?"
            options={[
              { value: "installments", label: "In installments" },
              { value: "one_time", label: "One payment" },
            ]}
            value={field.value}
            onChange={field.onChange}
            error={errors.paymentType?.message}
          />
        )}
      />

      <div className={cn("grid gap-3", installments && "grid-cols-2")}>
        {installments && (
          <Controller
            control={control}
            name="numPayments"
            render={({ field }) => (
              <FieldShell id={`${id}-count`} label="Number of payments" error={errors.numPayments?.message}>
                {(describedBy) => (
                  <select
                    id={`${id}-count`}
                    value={field.value}
                    onChange={(e) => {
                      const count = Number(e.target.value);
                      field.onChange(count);
                      fillPayment(validTotal, count);
                    }}
                    onBlur={field.onBlur}
                    aria-describedby={describedBy}
                    className={cn(inputClassName, "h-12 appearance-auto")}
                  >
                    {COUNTS.map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                )}
              </FieldShell>
            )}
          />
        )}
        {/* Future dates are the point here, so a plain date input, not the add sheet's DateButton. */}
        <TextField
          id={`${id}-due`}
          type="date"
          label={installments ? "First due date" : "Due date"}
          className="h-12"
          error={errors.firstDueDate?.message}
          {...register("firstDueDate")}
        />
      </div>

      {installments && (
        <MoneyInput
          id={`${id}-payment`}
          label="Each payment"
          placeholder="5,000"
          hint={paymentTyped ? undefined : "Total ÷ number of payments. You can change it."}
          error={errors.payment?.message}
          {...register("payment", { onChange: () => setPaymentTyped(true) })}
        />
      )}

      <TextField
        id={`${id}-interest`}
        label="Interest rate % (optional)"
        placeholder="0"
        inputMode="decimal"
        autoComplete="off"
        hint="For your records. It doesn't change the payments."
        className="h-12"
        error={errors.interestRate?.message}
        {...register("interestRate")}
      />

      {/* The live schedule preview (debts.md §4), read politely as it changes. */}
      <div aria-live="polite">
        {preview.length > 0 && (
          <section aria-label="Payment schedule" className="flex flex-col gap-2 rounded-[14px] bg-mint px-4 py-3 text-sm text-link-hover">
            <p className="text-xs font-extrabold tracking-wide uppercase">Payment schedule</p>
            <ol className="flex flex-col gap-1">
              {shown.map((p, i) =>
                p == null ? (
                  <li key="more" aria-hidden className="text-center font-bold">
                    …
                  </li>
                ) : (
                  <li key={p.number ?? i} className="flex justify-between gap-3">
                    <span>
                      <span className="font-extrabold">{p.number}</span> · {formatShortDate(p.due)} · Paid from{" "}
                      {formatShortDate(paydayFor(p.due, schedule))} payday
                    </span>
                    <span className="shrink-0 font-extrabold">{formatPeso(p.amount)}</span>
                  </li>
                ),
              )}
            </ol>
            <p className="font-bold">Debt-free by {formatShortDate(preview[preview.length - 1].due)}.</p>
            {note && <p className="-mx-2 rounded-[10px] bg-warn-bg px-2 py-1 font-bold text-warn-fg">{note}</p>}
          </section>
        )}
      </div>

      <p className="text-[13px] text-text-3">
        Planned payments count as Needs; anything extra counts as Savings &amp; debt payoff.
      </p>

      <FormError message={formError} />

      <SubmitButton
        pending={pending}
        pendingLabel="Saving…"
        // The sheet's one hero button (style-guide.md "Buttons").
        className="h-14 border-2 border-sticker bg-green-500 text-white shadow-sticker-sm hover:bg-green-500/90 aria-busy:bg-green-500 aria-busy:text-white"
      >
        {debt ? "Save changes" : "Add debt"}
      </SubmitButton>

      {debt && (
        <div className="flex flex-wrap items-center justify-center gap-2">
          {onPaidOffChange && (
            <button
              type="button"
              onClick={togglePaidOff}
              disabled={pending}
              className="h-11 rounded-md px-3 text-[15px] font-extrabold text-link outline-link hover:text-link-hover focus-visible:outline-2"
            >
              {debt.paid_off_at == null ? "Mark as paid off" : "Move back to active"}
            </button>
          )}
          {onDeleteRequest && (
            <button
              type="button"
              onClick={onDeleteRequest}
              className="h-11 rounded-md px-3 text-[15px] font-extrabold text-danger outline-link focus-visible:outline-2"
            >
              Delete debt
            </button>
          )}
        </div>
      )}
    </form>
  );
}
