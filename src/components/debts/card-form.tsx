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
import { suggestedBillSlot } from "@/lib/bills";
import { cardNextPayment } from "@/lib/cards";
import { formatPesoInput } from "@/lib/money";
import { formatShortDate, ordinal, paydayLabel, type PaySchedule } from "@/lib/periods";
import { cn } from "@/lib/utils";
import { type CardFormInput, type CardValues, cardSchema } from "@/lib/validation/debt";

/** A card being edited (8b-2). */
export type EditableCard = {
  id: string;
  name: string;
  lender: string | null;
  /** What was owed when it was added (its starting balance). */
  total_amount: number;
  due_day: number;
  pay_slot: string;
  interest_rate: number | null;
  paid_off_at: string | null;
};

export type CardFormResult = { ok?: true; formError?: string; fieldErrors?: Partial<Record<string, string>> };

const FIELD_ORDER = ["name", "lender", "owed", "dueDay", "paySlot", "interestRate"] as const;
const DAYS = Array.from({ length: 31 }, (_, i) => i + 1);

/**
 * New and Edit card (Week 8 task 8b-2). A credit card has no schedule: what's
 * owed on it today, the day its payment is due each month and the payday
 * that pays it. The preview says which payday pays the next payment.
 */
export function CardForm({
  schedule,
  today,
  card,
  onSave,
  onClosedChange,
  onDeleteRequest,
  onDone,
}: {
  schedule: PaySchedule;
  /** Manila "YYYY-MM-DD", for the next payment in the preview. */
  today: string;
  /** Editing an existing card; leave out to add one. */
  card?: EditableCard;
  onSave: (input: CardFormInput) => Promise<CardFormResult>;
  /** Edit only: "Close card" or "Reopen card". */
  onClosedChange?: (closed: boolean) => Promise<CardFormResult>;
  onDeleteRequest?: () => void;
  onDone: () => void;
}) {
  const router = useRouter();
  const [formError, setFormError] = useState<string>();
  const [pending, startTransition] = useTransition();
  // A new card's payday follows the due day until it's picked by hand.
  const [slotPicked, setSlotPicked] = useState(card != null);
  const id = card?.id ?? "new-card";
  const twicePaid = schedule.frequency === "semi_monthly";

  const {
    register,
    handleSubmit,
    setError,
    setValue,
    control,
    formState: { errors },
  } = useForm<CardFormInput, unknown, CardValues>({
    resolver: zodResolver(cardSchema),
    mode: "onTouched",
    defaultValues: card
      ? {
          name: card.name,
          lender: card.lender ?? "",
          owed: formatPesoInput(card.total_amount),
          dueDay: card.due_day,
          paySlot: card.pay_slot as CardFormInput["paySlot"],
          interestRate: card.interest_rate != null ? String(card.interest_rate) : "",
        }
      : {
          name: "",
          lender: "",
          owed: "",
          dueDay: Number.NaN,
          paySlot: twicePaid ? "payday_2" : "every",
          interestRate: "",
        },
  });

  const [dueDay, paySlot] = useWatch({ control, name: ["dueDay", "paySlot"] });
  const hasDay = Number.isInteger(dueDay) && dueDay >= 1 && dueDay <= 31;
  // "Your Nov 30 payday pays the Dec 5 payment." (lib/cards.ts)
  const next = hasDay && paySlot ? cardNextPayment({ due_day: dueDay, pay_slot: paySlot }, today, schedule) : null;

  const finish = (result: CardFormResult) => {
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

  const onSubmit = (values: CardValues) => {
    setFormError(undefined);
    // Send what was typed: the Server Action parses it again with the same schema.
    const input: CardFormInput = {
      name: values.name,
      lender: values.lender ?? "",
      owed: formatPesoInput(values.owed),
      dueDay: values.dueDay,
      paySlot: values.paySlot,
      interestRate: values.interestRate != null ? String(values.interestRate) : "",
    };
    startTransition(async () => finish(await onSave(input)));
  };

  const toggleClosed = () => {
    if (!onClosedChange || !card) return;
    setFormError(undefined);
    startTransition(async () => finish(await onClosedChange(card.paid_off_at == null)));
  };

  return (
    <form noValidate onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <TextField
        id={`${id}-name`}
        label="Card name"
        placeholder="e.g. BPI card"
        autoComplete="off"
        maxLength={40}
        className="h-[50px]"
        error={errors.name?.message}
        {...register("name")}
      />
      <TextField
        id={`${id}-lender`}
        label="Bank (optional)"
        placeholder="e.g. BPI"
        autoComplete="off"
        maxLength={40}
        className="h-12"
        error={errors.lender?.message}
        {...register("lender")}
      />
      <MoneyInput
        id={`${id}-owed`}
        label={card ? "Owed when you added it" : "Owed on it today"}
        placeholder="0"
        hint={
          card
            ? "Purchases and payments since then are added to it."
            : "Enter 0 if it's paid up. Purchases and payments are added to it."
        }
        error={errors.owed?.message}
        {...register("owed")}
      />

      <Controller
        control={control}
        name="dueDay"
        render={({ field }) => (
          <FieldShell id={`${id}-due`} label="Payment due each month" error={errors.dueDay?.message}>
            {(describedBy) => (
              <select
                id={`${id}-due`}
                value={Number.isInteger(field.value) ? field.value : ""}
                onChange={(e) => {
                  const day = Number(e.target.value);
                  field.onChange(day);
                  // Like bills: the payday right before the due day, until picked by hand.
                  if (!slotPicked) setValue("paySlot", suggestedBillSlot(day, schedule) as CardFormInput["paySlot"]);
                }}
                onBlur={field.onBlur}
                aria-describedby={describedBy}
                aria-invalid={errors.dueDay ? true : undefined}
                className={cn(inputClassName, "h-12 appearance-auto")}
              >
                <option value="" disabled>
                  Pick a day
                </option>
                {DAYS.map((d) => (
                  <option key={d} value={d}>
                    {ordinal(d)}
                  </option>
                ))}
              </select>
            )}
          </FieldShell>
        )}
      />

      {/* Weekly and monthly budgets have one payday: no choice, saves "every". */}
      {twicePaid && (
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
              ]}
              value={field.value === "every" ? undefined : field.value}
              onChange={(v) => {
                setSlotPicked(true);
                field.onChange(v);
              }}
              error={errors.paySlot?.message}
            />
          )}
        />
      )}

      <TextField
        id={`${id}-interest`}
        label="Interest rate % (optional)"
        placeholder="0"
        inputMode="decimal"
        autoComplete="off"
        hint="For your records. It doesn't change any number."
        className="h-12"
        error={errors.interestRate?.message}
        {...register("interestRate")}
      />

      {/* The effect before saving (CLAUDE.md UI rules), read politely as it changes. */}
      <div aria-live="polite">
        {next && (
          <p className="rounded-[14px] bg-mint px-4 py-3 text-sm font-bold text-link-hover">
            Your {formatShortDate(next.payday)} payday pays the {formatShortDate(next.due)} payment.
          </p>
        )}
      </div>

      <p className="text-[13px] text-text-3">
        Purchases on the card count as spending when you buy. Paying the card takes the cash, but isn&apos;t counted as
        spending again.
      </p>

      <FormError message={formError} />

      <SubmitButton
        pending={pending}
        pendingLabel="Saving…"
        // The sheet's one hero button (style-guide.md "Buttons").
        className="h-14 border-2 border-sticker bg-green-500 text-white shadow-sticker-sm hover:bg-green-500/90 aria-busy:bg-green-500 aria-busy:text-white"
      >
        {card ? "Save changes" : "Add card"}
      </SubmitButton>

      {card && (
        <div className="flex flex-wrap items-center justify-center gap-2">
          {onClosedChange && (
            <button
              type="button"
              onClick={toggleClosed}
              disabled={pending}
              className="h-11 rounded-md px-3 text-[15px] font-extrabold text-link outline-link hover:text-link-hover focus-visible:outline-2"
            >
              {card.paid_off_at == null ? "Close card" : "Reopen card"}
            </button>
          )}
          {onDeleteRequest && (
            <button
              type="button"
              onClick={onDeleteRequest}
              className="h-11 rounded-md px-3 text-[15px] font-extrabold text-danger outline-link focus-visible:outline-2"
            >
              Delete card
            </button>
          )}
        </div>
      )}
    </form>
  );
}
