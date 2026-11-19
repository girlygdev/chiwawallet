"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CircleAlert } from "lucide-react";
import { useState, useTransition } from "react";
import { type FieldError, useForm, useWatch } from "react-hook-form";
import { FormError } from "@/components/auth/form-error";
import { SubmitButton } from "@/components/auth/submit-button";
import { inputClassName, TextField } from "@/components/auth/text-field";
import {
  formatPeriodRange,
  nextPeriods,
  ordinal,
  type PaySchedule,
  paydayLabel,
} from "@/lib/periods";
import { cn } from "@/lib/utils";
import { type BudgetInput, budgetSchema, type Frequency } from "@/lib/validation/budget";
import { saveBudget } from "../actions";

const FREQUENCY_CARDS: { value: Frequency; name: string; hint: string }[] = [
  { value: "weekly", name: "Weekly", hint: "Same day every week" },
  { value: "semi_monthly", name: "Twice a month", hint: "Two paydays, like the 15th and 30th" },
  { value: "monthly", name: "Monthly", hint: "One payday a month" },
];

// Monday first, like a Philippine calendar; values are 0 = Sunday … 6 = Saturday.
const WEEKDAY_OPTIONS = [
  [1, "Monday"],
  [2, "Tuesday"],
  [3, "Wednesday"],
  [4, "Thursday"],
  [5, "Friday"],
  [6, "Saturday"],
  [0, "Sunday"],
] as const;

const days = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => from + i);

// Inside the app, fields are 48px (plan review 4.11); auth keeps 52px.
const selectClassName = cn(inputClassName, "h-12 appearance-auto pr-3");

// <select> values are strings; the schema wants a number or null.
const toNumberOrNull = (value: unknown) => (value === "" || value == null ? null : Number(value));

const fieldOrder = ["name", "frequency", "payDay1", "payDay2", "payWeekday", "weekStart"] as const;

// Step 1 "Your budget" (onboarding.md §3). `today` comes from the server in
// Manila time, so the preview matches the real periods.
export function BudgetForm({ defaults, today }: { defaults: BudgetInput; today: string }) {
  const [formError, setFormError] = useState<string>();
  const [pending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    setError,
    control,
    formState: { errors },
  } = useForm<BudgetInput>({
    resolver: zodResolver(budgetSchema),
    mode: "onTouched",
    defaultValues: defaults,
  });

  const values = useWatch({ control });
  const frequency = values.frequency ?? "semi_monthly";

  const onSubmit = (input: BudgetInput) => {
    setFormError(undefined);
    startTransition(async () => {
      // On success the action redirects to step 2.
      const result = await saveBudget(input);
      if (result.formError) setFormError(result.formError);
      const firstBad = fieldOrder.find((f) => result.fieldErrors?.[f]);
      for (const f of fieldOrder) {
        const message = result.fieldErrors?.[f];
        if (message) setError(f, { message }, { shouldFocus: f === firstBad });
      }
    });
  };

  // "Short month? …" whenever a payday in use could be past a month's end.
  const usedDays =
    frequency === "semi_monthly" ? [values.payDay1, values.payDay2] : frequency === "monthly" ? [values.payDay1] : [];
  const showShortMonthHint = usedDays.some((d) => d != null && d >= 29);

  return (
    <form noValidate onSubmit={handleSubmit(onSubmit)} className="flex flex-1 flex-col gap-[18px] lg:gap-8">
      <div className="flex flex-wrap items-start gap-8">
        <div className="flex max-w-[680px] min-w-0 flex-[999_1_420px] flex-col gap-[18px] lg:gap-6">
          <TextField
            id="name"
            label="Budget name"
            autoComplete="off"
            className="h-12"
            error={errors.name?.message}
            {...register("name")}
          />

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-sm font-bold text-ink">How often do you get paid?</legend>
            <div className="grid gap-2 lg:grid-cols-[repeat(auto-fit,minmax(170px,1fr))] lg:gap-3">
              {FREQUENCY_CARDS.map((card) => (
                <label
                  key={card.value}
                  className="flex cursor-pointer items-start gap-3 rounded-[14px] border-[1.5px] border-line bg-surface px-3.5 py-3 has-checked:border-2 has-checked:border-green-600 has-checked:bg-mint has-focus-visible:outline-2 has-focus-visible:outline-link lg:flex-col lg:gap-2 lg:rounded-2xl lg:p-4"
                >
                  <input
                    type="radio"
                    value={card.value}
                    className="mt-0.5 size-5 shrink-0 accent-green-600"
                    {...register("frequency")}
                  />
                  <span className="flex flex-col">
                    <span className="text-[15px] font-extrabold text-ink lg:text-base">{card.name}</span>
                    <span className="text-[13px] text-text-3">{card.hint}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <div className="flex flex-col gap-1.5">
            <p className="text-sm font-bold text-ink">Your paydays</p>
            {frequency === "semi_monthly" && (
              <div className="grid grid-cols-2 gap-3">
                <DaySelect
                  id="payDay1"
                  label="1st payday"
                  // 1–31 like the spec, even though the 1st must be by the
                  // 27th: a menu missing the saved day would show it blank.
                  // The schema explains what to fix instead.
                  options={days(1, 31)}
                  error={errors.payDay1}
                  {...register("payDay1", { setValueAs: toNumberOrNull })}
                />
                <DaySelect
                  id="payDay2"
                  label="2nd payday"
                  options={days(1, 31)}
                  error={errors.payDay2}
                  {...register("payDay2", { setValueAs: toNumberOrNull })}
                />
              </div>
            )}
            {frequency === "monthly" && (
              <DaySelect
                id="payDay1"
                label="Payday"
                options={days(1, 31)}
                error={errors.payDay1}
                {...register("payDay1", { setValueAs: toNumberOrNull })}
              />
            )}
            {frequency === "weekly" && (
              <SmallLabelField id="payWeekday" label="Payday" error={errors.payWeekday}>
                <select
                  id="payWeekday"
                  aria-invalid={errors.payWeekday ? true : undefined}
                  className={selectClassName}
                  {...register("payWeekday", { setValueAs: toNumberOrNull })}
                >
                  <option value="">Pick a day</option>
                  {WEEKDAY_OPTIONS.map(([value, name]) => (
                    <option key={value} value={value}>
                      {name}
                    </option>
                  ))}
                </select>
              </SmallLabelField>
            )}
            {showShortMonthHint && (
              <p className="text-xs text-text-3">Short month? We&apos;ll use its last day, like Feb 28.</p>
            )}
          </div>

          <fieldset>
            <legend className="mb-2 text-sm font-bold text-ink">Week starts on</legend>
            {/* A segmented control built from real radio buttons, so arrow keys
                and screen readers work without extra code. */}
            <div className="inline-flex rounded-[14px] bg-track p-1">
              {(["monday", "sunday"] as const).map((day) => (
                <label
                  key={day}
                  className="flex h-10 min-w-[110px] cursor-pointer items-center justify-center rounded-[10px] px-4 text-[15px] font-bold text-text-2 has-checked:bg-surface has-checked:font-extrabold has-checked:text-ink has-checked:shadow-sm has-focus-visible:outline-2 has-focus-visible:outline-link"
                >
                  <input type="radio" value={day} className="sr-only" {...register("weekStart")} />
                  {day === "monday" ? "Monday" : "Sunday"}
                </label>
              ))}
            </div>
          </fieldset>
        </div>

        <PeriodsPreview today={today} values={values} />
      </div>

      <div className="mt-auto flex flex-col gap-3 lg:mt-0 lg:items-end">
        <div className="w-full lg:max-w-[1104px]">
          <FormError message={formError} />
        </div>
        <div className="w-full lg:w-64">
          <SubmitButton pending={pending} pendingLabel="Saving…">
            <span className="lg:hidden">Continue</span>
            <span className="hidden lg:inline">Continue to income</span>
          </SubmitButton>
        </div>
      </div>
    </form>
  );
}

type DaySelectProps = React.ComponentProps<"select"> & {
  id: string;
  label: string;
  options: number[];
  error?: FieldError;
};

function DaySelect({ id, label, options, error, ...selectProps }: DaySelectProps) {
  return (
    <SmallLabelField id={id} label={label} error={error}>
      <select
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className={selectClassName}
        {...selectProps}
      >
        <option value="">Pick a day</option>
        {options.map((d) => (
          <option key={d} value={d}>
            {ordinal(d)}
          </option>
        ))}
      </select>
    </SmallLabelField>
  );
}

// Payday fields use 12px sub-labels under "Your paydays" (onboarding.md §3).
function SmallLabelField({
  id,
  label,
  error,
  children,
}: {
  id: string;
  label: string;
  error?: FieldError;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-xs font-bold text-text-3">
        {label}
      </label>
      {children}
      {error?.message && (
        <p id={`${id}-error`} className="flex items-center gap-1.5 text-[13px] font-bold text-bad-fg">
          <CircleAlert aria-hidden className="size-4 shrink-0" />
          {error.message}
        </p>
      )}
    </div>
  );
}

// "YOUR NEXT PAYDAY PERIODS" (desktop only, onboarding.md §3). Uses the same
// getPeriod() as the app, so it can't disagree with the real periods.
function PeriodsPreview({ today, values }: { today: string; values: Partial<BudgetInput> }) {
  const schedule = toSchedule(values);
  const parsed = schedule ? safeNextPeriods(today, schedule) : null;

  return (
    <section
      aria-labelledby="periods-preview-title"
      className="hidden max-w-[380px] min-w-[280px] flex-[1_1_280px] flex-col gap-3 rounded-[20px] border-2 border-sticker bg-surface p-5 shadow-sticker-lg lg:flex"
    >
      <h2 id="periods-preview-title" className="text-xs font-extrabold tracking-wide text-text-3 uppercase">
        Your next payday periods
      </h2>
      <div aria-live="polite">
        {parsed && schedule ? (
          <ol className="flex flex-col gap-1.5">
            {parsed.map((p, i) => (
              <li
                key={p.start}
                className={cn(
                  "flex items-center justify-between gap-3 rounded-[12px] px-3 py-2.5 text-sm",
                  i === 0 ? "bg-mint font-extrabold text-ink" : "bg-bg text-text-2",
                )}
              >
                <span>{formatPeriodRange(p.start, p.end)}</span>
                <span className="rounded-full bg-surface px-2 py-0.5 text-xs font-bold text-text-2">
                  {paydayLabel(schedule, p.paySlot)}
                </span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-sm text-text-3">Pick your paydays to see your periods.</p>
        )}
      </div>
      <p className="text-xs text-text-3">Each period runs from one payday to the day before the next.</p>
    </section>
  );
}

// The form's current values as a schedule, or null while they're incomplete.
function toSchedule(values: Partial<BudgetInput>): PaySchedule | null {
  const { frequency, payDay1, payDay2, payWeekday } = values;
  if (frequency === "semi_monthly" && payDay1 != null && payDay2 != null && payDay2 > payDay1) {
    return { frequency, payDay1, payDay2 };
  }
  if (frequency === "monthly" && payDay1 != null) return { frequency, payDay1 };
  if (frequency === "weekly" && payWeekday != null) return { frequency, payWeekday };
  return null;
}

// getPeriod() throws on schedules the database would reject (like a 1st
// payday after the 27th); the preview just waits for a valid one.
function safeNextPeriods(today: string, schedule: PaySchedule) {
  try {
    return nextPeriods(today, schedule, 4);
  } catch {
    return null;
  }
}
