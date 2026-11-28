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
import { Switch } from "@/components/switch";
import { type BillFrequency, billTotalsChange, suggestedBillSlot } from "@/lib/bills";
import { formatPeso, formatPesoInput, parsePesoInput } from "@/lib/money";
import { ordinal, type PaySchedule, paydayLabel } from "@/lib/periods";
import { cn } from "@/lib/utils";
import { type BillFormInput, type BillValues, billSchemaFor } from "@/lib/validation/bill";

export type EditableBill = {
  id: string;
  name: string;
  amount: number;
  amount_varies: boolean;
  category_id: string;
  frequency: BillFrequency;
  due_day: number;
  first_due_month: number | null;
  pay_slot: string;
  remind: boolean;
  /** The card it's charged to (Nov 28); empty for Cash. */
  card_id: string | null;
};

export type BillFormResult = { ok?: true; formError?: string; fieldErrors?: Partial<Record<string, string>> };

type TotalsBill = { amount: number; frequency: BillFrequency; pay_slot: string };

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DAYS = Array.from({ length: 31 }, (_, i) => i + 1);
const FIELD_ORDER = ["name", "amount", "dueDay", "firstDueMonth", "frequency", "paySlot", "categoryId", "cardId"] as const;
const SELECT = cn(inputClassName, "h-12 appearance-auto");
/** Up to this many cards, Paid with is a segmented control (as on Add expense); more, a dropdown. */
const SEGMENTED_CARDS = 3;

/**
 * New and Edit bill (bills.md §4). The payday that pays it follows the
 * suggestion (the last payday on or before the due day) until the user picks
 * one. The impact box shows each payday's bills before → after.
 */
export function BillForm({
  schedule,
  categories,
  defaultCategoryId,
  bill,
  otherBills,
  cards = [],
  onSave,
  onDeleteRequest,
  onDone,
}: {
  schedule: PaySchedule;
  /** Spending categories that aren't system ones (the database checks it too). */
  categories: { id: string; name: string }[];
  /** "Bills" by default (bills.md §4). */
  defaultCategoryId: string;
  /** Editing an existing bill; leave out to add one. */
  bill?: EditableBill;
  /** The budget's other bills, for the impact box. */
  otherBills: TotalsBill[];
  /** Paid with's choices: the user's open credit cards (Nov 28). */
  cards?: { id: string; name: string }[];
  onSave: (input: BillFormInput) => Promise<BillFormResult>;
  onDeleteRequest?: () => void;
  onDone: () => void;
}) {
  const router = useRouter();
  const [formError, setFormError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const twicePaid = schedule.frequency === "semi_monthly";
  // Editing keeps the saved payday; a new bill follows the suggestion until
  // the user picks a payday themselves.
  const [slotPicked, setSlotPicked] = useState(bill != null);
  const id = bill?.id ?? "new-bill";

  const {
    register,
    handleSubmit,
    setError,
    setValue,
    control,
    formState: { errors },
  } = useForm<BillFormInput, unknown, BillValues>({
    resolver: zodResolver(billSchemaFor(schedule.frequency)),
    mode: "onTouched",
    defaultValues: bill
      ? {
          name: bill.name,
          amount: formatPesoInput(bill.amount),
          amountVaries: bill.amount_varies,
          categoryId: bill.category_id,
          frequency: bill.frequency,
          dueDay: bill.due_day,
          firstDueMonth: bill.first_due_month,
          paySlot: bill.pay_slot as BillFormInput["paySlot"],
          remind: bill.remind,
          cardId: bill.card_id ?? "",
        }
      : {
          name: "",
          amount: "",
          amountVaries: false,
          categoryId: defaultCategoryId,
          frequency: "monthly",
          // NaN until a day is picked, which the schema reports as "Pick the day it's due."
          dueDay: Number.NaN,
          firstDueMonth: null,
          paySlot: twicePaid ? "payday_1" : "every",
          remind: true,
          cardId: "",
        },
  });

  const amountText = useWatch({ control, name: "amount" }) ?? "";
  const frequency = useWatch({ control, name: "frequency" });
  const dueDay = useWatch({ control, name: "dueDay" });
  const paySlot = useWatch({ control, name: "paySlot" });
  const amountVaries = useWatch({ control, name: "amountVaries" });
  const cardId = useWatch({ control, name: "cardId" }) ?? "";
  const card = cards.find((c) => c.id === cardId);
  const pickCard = (value: string) => setValue("cardId", value, { shouldValidate: errors.cardId != null });
  const centavos = parsePesoInput(amountText);
  const validAmount = centavos != null && centavos > 0 ? centavos : null;
  const hasDay = Number.isInteger(dueDay) && dueDay >= 1 && dueDay <= 31;
  const suggested = hasDay ? suggestedBillSlot(dueDay, schedule) : null;

  // Picking a due day moves Paid from to the suggestion, until it's picked by hand.
  const onDayChange = (day: number) => {
    setValue("dueDay", day, { shouldValidate: errors.dueDay != null });
    if (!slotPicked && Number.isInteger(day)) setValue("paySlot", suggestedBillSlot(day, schedule));
  };

  // The effect in pesos before saving (CLAUDE.md UI rules).
  const before: TotalsBill[] = bill ? [...otherBills, bill] : otherBills;
  const impact =
    validAmount && frequency
      ? billTotalsChange(before, [...otherBills, { amount: validAmount, frequency, pay_slot: paySlot }], schedule)
      : [];

  const onSubmit = (values: BillValues) => {
    setFormError(undefined);
    // Send what was typed: the Server Action parses it again with the same schema.
    // The parsed card is null for Cash; the schema reads that back from "".
    const input: BillFormInput = { ...values, amount: amountText, cardId: values.cardId ?? "" };
    startTransition(async () => {
      const result = await onSave(input);
      if (result.formError) setFormError(result.formError);
      const firstBad = FIELD_ORDER.find((f) => result.fieldErrors?.[f]);
      for (const f of FIELD_ORDER) {
        const message = result.fieldErrors?.[f];
        if (message) setError(f, { message }, { shouldFocus: f === firstBad });
      }
      if (result.ok) {
        // Re-reads the page so the list and totals update.
        router.refresh();
        onDone();
      }
    });
  };

  const dayOptions = (
    <>
      <option value="" disabled>
        Day
      </option>
      {DAYS.map((d) => (
        <option key={d} value={d}>
          {ordinal(d)}
        </option>
      ))}
    </>
  );

  return (
    <form noValidate onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <TextField
        id={`${id}-name`}
        label="Bill name"
        placeholder="e.g. Meralco"
        autoComplete="off"
        maxLength={40}
        className="h-[50px]"
        error={errors.name?.message}
        {...register("name")}
      />
      <MoneyInput
        id={`${id}-amount`}
        label="Amount"
        placeholder="2,500"
        error={errors.amount?.message}
        {...register("amount")}
      />

      <Controller
        control={control}
        name="frequency"
        render={({ field }) => (
          <Segmented
            name={`${id}-frequency`}
            legend="How often?"
            options={[
              { value: "monthly", label: "Monthly" },
              { value: "quarterly", label: "Quarterly" },
              { value: "yearly", label: "Yearly" },
            ]}
            value={field.value}
            onChange={field.onChange}
            error={errors.frequency?.message}
          />
        )}
      />

      {/* Monthly: "Due every 10th". Quarterly and yearly: "First due" month
          and day (bills.md §4). */}
      <Controller
        control={control}
        name="dueDay"
        render={({ field }) =>
          frequency === "monthly" ? (
            <FieldShell id={`${id}-day`} label="Due every" error={errors.dueDay?.message}>
              {(describedBy) => (
                <select
                  id={`${id}-day`}
                  value={Number.isInteger(field.value) ? field.value : ""}
                  onChange={(e) => onDayChange(Number(e.target.value))}
                  onBlur={field.onBlur}
                  aria-describedby={describedBy}
                  aria-invalid={errors.dueDay ? true : undefined}
                  className={SELECT}
                >
                  {dayOptions}
                </select>
              )}
            </FieldShell>
          ) : (
            <fieldset className="flex flex-col gap-1.5">
              <legend className="mb-1.5 text-sm font-bold text-ink">First due</legend>
              <div className="grid grid-cols-[minmax(0,1fr)_7rem] gap-2">
                <Controller
                  control={control}
                  name="firstDueMonth"
                  render={({ field: month }) => (
                    <select
                      aria-label="Month"
                      value={month.value ?? ""}
                      onChange={(e) => month.onChange(Number(e.target.value))}
                      onBlur={month.onBlur}
                      aria-invalid={errors.firstDueMonth ? true : undefined}
                      className={SELECT}
                    >
                      <option value="" disabled>
                        Month
                      </option>
                      {MONTHS.map((m, i) => (
                        <option key={m} value={i + 1}>
                          {m}
                        </option>
                      ))}
                    </select>
                  )}
                />
                <select
                  aria-label="Day"
                  value={Number.isInteger(field.value) ? field.value : ""}
                  onChange={(e) => onDayChange(Number(e.target.value))}
                  onBlur={field.onBlur}
                  aria-invalid={errors.dueDay ? true : undefined}
                  className={SELECT}
                >
                  {dayOptions}
                </select>
              </div>
              {(errors.firstDueMonth ?? errors.dueDay) && (
                <p className="text-[13px] font-bold text-bad-fg">
                  {errors.firstDueMonth?.message ?? errors.dueDay?.message}
                </p>
              )}
            </fieldset>
          )
        }
      />

      {/* Weekly and monthly budgets have one payday: no choice, saves "every". */}
      {twicePaid && (
        <div className="flex flex-col gap-1.5">
          <Controller
            control={control}
            name="paySlot"
            render={({ field }) => (
              <Segmented
                name={`${id}-slot`}
                legend="Paid from"
                options={[
                  { value: "payday_1", label: `${paydayLabel(schedule, "payday_1")} payday` },
                  { value: "payday_2", label: `${paydayLabel(schedule, "payday_2")} payday` },
                  { value: "split", label: "Split" },
                ]}
                value={field.value}
                onChange={(v) => {
                  setSlotPicked(true);
                  field.onChange(v);
                }}
                error={errors.paySlot?.message}
              />
            )}
          />
          {suggested && suggested !== "every" && (
            <p className="text-[13px] text-text-3">
              {/* bills.md §1: "Suggested: the 30th comes right before the 10th." */}
              {paydayLabel(schedule, suggested) === ordinal(dueDay)
                ? `Suggested: the ${paydayLabel(schedule, suggested)}, the day it's due.`
                : `Suggested: the ${paydayLabel(schedule, suggested)} comes right before the ${ordinal(dueDay)}.`}
              {paySlot === "split" && " Split pays half from each."}
            </p>
          )}
        </div>
      )}

      <FieldShell id={`${id}-category`} label="Category" error={errors.categoryId?.message}>
        {(describedBy) => (
          <select
            id={`${id}-category`}
            aria-describedby={describedBy}
            aria-invalid={errors.categoryId ? true : undefined}
            className={SELECT}
            {...register("categoryId")}
          >
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        )}
      </FieldShell>

      {/* Paid with (Nov 28): Cash, or a card the bill is charged to. Only
          with an open card (plus a closed one it's already on can't happen:
          closing a card moves its bills back to Cash). */}
      {cards.length > 0 && (
        <div className="flex flex-col gap-1.5">
          {cards.length <= SEGMENTED_CARDS ? (
            <Segmented
              name={`${id}-paid-with`}
              legend="Paid with"
              options={[{ value: "", label: "Cash" }, ...cards.map((c) => ({ value: c.id, label: c.name }))]}
              value={cardId}
              onChange={pickCard}
              wrap={cards.length === SEGMENTED_CARDS}
              error={errors.cardId?.message}
            />
          ) : (
            <FieldShell id={`${id}-paid-with`} label="Paid with" error={errors.cardId?.message}>
              {(describedBy) => (
                <select
                  id={`${id}-paid-with`}
                  value={cardId}
                  onChange={(e) => pickCard(e.target.value)}
                  aria-describedby={describedBy}
                  aria-invalid={errors.cardId ? true : undefined}
                  className={SELECT}
                >
                  <option value="">Cash</option>
                  {cards.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              )}
            </FieldShell>
          )}
          {card && (
            <p className="text-[13px] text-text-2">
              Charged to {card.name} when you mark it paid. Your cash stays the same until you pay the card.
            </p>
          )}
        </div>
      )}

      <Controller
        control={control}
        name="amountVaries"
        render={({ field }) => (
          <Switch
            id={`${id}-varies`}
            label="Amount changes each month"
            hint={
              validAmount ? `We'll treat ${formatPeso(validAmount)} as an estimate.` : "We'll treat the amount as an estimate."
            }
            checked={field.value}
            onChange={field.onChange}
          />
        )}
      />
      <Controller
        control={control}
        name="remind"
        render={({ field }) => (
          <Switch
            id={`${id}-remind`}
            label="Remind me before it's due"
            // No push notifications in the MVP (bills.md fix #3).
            hint="Shows on your dashboard 2 days before."
            checked={field.value}
            onChange={field.onChange}
          />
        )}
      />

      {/* The effect in pesos before saving (bills.md §4 impact box). */}
      <div aria-live="polite">
        {impact.length > 0 && (
          <ul className="flex flex-col gap-1 rounded-[14px] bg-mint px-4 py-3 text-sm text-link-hover">
            {impact.map((line) =>
              line.before === line.after ? (
                <li key={line.slot}>
                  {line.label} stay at <span className="font-extrabold">{formatPeso(line.after)}</span>.
                </li>
              ) : (
                <li key={line.slot}>
                  <span className="font-bold">{line.label}:</span> {formatPeso(line.before)} →{" "}
                  <span className="font-extrabold">{formatPeso(line.after)}</span>
                  {amountVaries && " (estimate)"}
                </li>
              ),
            )}
          </ul>
        )}
      </div>

      <FormError message={formError} />

      <SubmitButton
        pending={pending}
        pendingLabel="Saving…"
        // The sheet's one hero button (style-guide.md "Buttons").
        className="h-14 border-2 border-sticker bg-green-500 text-white shadow-sticker-sm hover:bg-green-500/90 aria-busy:bg-green-500 aria-busy:text-white"
      >
        {bill ? "Save changes" : "Add bill"}
      </SubmitButton>

      {bill && onDeleteRequest && (
        <button
          type="button"
          onClick={onDeleteRequest}
          className="h-11 self-center rounded-md px-3 text-[15px] font-extrabold text-danger outline-link focus-visible:outline-2"
        >
          Delete bill
        </button>
      )}
    </form>
  );
}
