"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useState, useTransition } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { FormError } from "@/components/auth/form-error";
import { SubmitButton } from "@/components/auth/submit-button";
import { MoneyInput } from "@/components/money-input";
import { FirstPeriodCard } from "@/components/onboarding/first-period-card";
import { Segmented } from "@/components/segmented";
import { formatPeso, parsePesoInput } from "@/lib/money";
import { firstPeriodSummary, ONBOARDING_PATHS } from "@/lib/onboarding";
import { type StartFormInput, startSchema, type StartValues } from "@/lib/validation/start";
import { finishOnboarding } from "../actions";

type Props = {
  period: { start: string; end: string };
  tag: string;
  /** "Nov 15", for "Has your Nov 15 pay already arrived?" */
  paydayDate: string;
  paydayLabel: string;
  expectedIncome: number;
};

const fieldOrder = ["openingBalance", "payReceived"] as const;

// Step 3 "Starting point" (onboarding.md §5): the starting balance, whether
// this period's pay already arrived, and the live "Your first period" card.
export function StartForm({ period, tag, paydayDate, paydayLabel, expectedIncome }: Props) {
  const [formError, setFormError] = useState<string>();
  const [pending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    setError,
    control,
    formState: { errors },
  } = useForm<StartFormInput, unknown, StartValues>({
    resolver: zodResolver(startSchema),
    mode: "onTouched",
    // payReceived starts unanswered on purpose: guessing could count pay twice.
    defaultValues: { openingBalance: "", payReceived: undefined },
  });

  const balanceText = useWatch({ control, name: "openingBalance" });
  const answer = useWatch({ control, name: "payReceived" });
  const openingBalance = parsePesoInput(balanceText ?? "");
  const payReceived = answer === "yes" ? true : answer === "no" ? false : null;

  const onSubmit = () => {
    setFormError(undefined);
    // Send the raw input: the Server Action validates and parses it again.
    const input: StartFormInput = { openingBalance: balanceText ?? "", payReceived: answer };
    startTransition(async () => {
      // On success the action redirects to the Done screen.
      const result = await finishOnboarding(input);
      if (result.formError) setFormError(result.formError);
      const firstBad = fieldOrder.find((f) => result.fieldErrors?.[f]);
      for (const f of fieldOrder) {
        const message = result.fieldErrors?.[f];
        if (message) setError(f, { message }, { shouldFocus: f === firstBad });
      }
    });
  };

  return (
    <form noValidate onSubmit={handleSubmit(onSubmit)} className="flex flex-1 flex-col gap-[18px] lg:gap-8">
      <div className="flex flex-wrap items-start gap-8">
        <div className="flex max-w-[680px] min-w-0 flex-[999_1_420px] flex-col gap-6">
          <MoneyInput
            id="openingBalance"
            label="Starting balance"
            placeholder="0.00"
            hint="Everything you have right now: bank, cash and e-wallets together, including any pay that's already arrived. Overdrawn? Start with a minus sign."
            error={errors.openingBalance?.message}
            // The big money input (onboarding.md §5): 64px on mobile, 68px on
            // desktop, Fredoka amount, green border.
            className="h-16 rounded-2xl border-2 border-green-600 pl-10 font-display text-[28px] font-semibold lg:h-[68px] lg:text-[30px]"
            {...register("openingBalance")}
          />

          <div className="flex flex-col gap-2">
            <Controller
              control={control}
              name="payReceived"
              render={({ field }) => (
                <Segmented
                  name="payReceived"
                  legend={`Has your ${paydayDate} pay already arrived?`}
                  options={[
                    { value: "yes", label: "Yes, it's in" },
                    { value: "no", label: "Not yet" },
                  ]}
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.payReceived?.message}
                />
              )}
            />
            <p aria-live="polite" className="text-[13px] text-text-3">
              {/* The balance is what's really there now, so arrived pay must be
                  inside it; the app never adds it on top (decided Nov 19). */}
              {payReceived === true &&
                "Then your starting balance should include it. Type everything you have now, pay included. We won't add it again."}
              {payReceived === false &&
                `We'll expect ${formatPeso(expectedIncome)} on your ${paydayLabel} payday this period.`}
            </p>
          </div>

          {/* Mobile shows the result as one line; desktop has the card. */}
          <MobileSummary
            openingBalance={openingBalance}
            expectedIncome={expectedIncome}
            payReceived={payReceived}
          />
        </div>

        <FirstPeriodCard
          heading="Your first period"
          tag={tag}
          start={period.start}
          end={period.end}
          paydayLabel={paydayLabel}
          expectedIncome={expectedIncome}
          openingBalance={openingBalance}
          payReceived={payReceived}
          className="hidden max-w-[380px] min-w-[280px] flex-[1_1_280px] shadow-sticker-lg lg:flex"
        />
      </div>

      <div className="mt-auto flex flex-col gap-3 lg:mt-0 lg:flex-row lg:items-center lg:justify-between">
        <Link
          href={ONBOARDING_PATHS.income}
          className="hidden h-[54px] items-center justify-center rounded-md border-[1.5px] border-line bg-surface px-6 text-[17px] font-extrabold text-ink outline-link focus-visible:outline-2 lg:flex"
        >
          Back
        </Link>
        <div className="flex w-full flex-col gap-3 lg:w-64">
          <FormError message={formError} />
          <SubmitButton pending={pending} pendingLabel="Finishing…">
            Finish setup
          </SubmitButton>
        </div>
      </div>
    </form>
  );
}

// "Ready to plan ₱30,000" under the fields on phones, where the card is hidden.
function MobileSummary({
  openingBalance,
  expectedIncome,
  payReceived,
}: {
  openingBalance: number | null;
  expectedIncome: number;
  payReceived: boolean | null;
}) {
  if (openingBalance == null || payReceived == null) return null;
  const { readyToPlan } = firstPeriodSummary({ openingBalance, expectedIncome, payReceived });
  return (
    <p aria-live="polite" className="rounded-[14px] bg-mint px-4 py-3 text-sm text-link-hover lg:hidden">
      <span className="font-bold">Ready to plan this period:</span>{" "}
      <span className="font-extrabold">{formatPeso(readyToPlan)}</span>
    </p>
  );
}
