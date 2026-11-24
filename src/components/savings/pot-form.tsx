"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { FormError } from "@/components/auth/form-error";
import { SubmitButton } from "@/components/auth/submit-button";
import { inputClassName, TextField } from "@/components/auth/text-field";
import { PICKED_ICON, SWATCH } from "@/components/categories/category-form";
import { MoneyInput } from "@/components/money-input";
import { Segmented } from "@/components/segmented";
import { Switch } from "@/components/switch";
import { CategoryIcon } from "@/components/transactions/category-grid";
import { formatPeso, formatPesoInput, parsePesoInput } from "@/lib/money";
import { formatMonthYear, type PaySchedule, type PaySlot, paydayLabel } from "@/lib/periods";
import { potProjection } from "@/lib/pots";
import { cn } from "@/lib/utils";
import { CATEGORY_COLORS } from "@/lib/validation/category";
import { POT_ICONS, type PotFormInput, type PotValues, potSchemaFor } from "@/lib/validation/pot";

export type EditablePot = {
  id: string;
  name: string;
  icon: string;
  color: string;
  target_amount: number | null;
  target_date: string | null;
  starting_balance: number;
  planned_contribution: number;
  pay_slot: PaySlot;
  is_locked: boolean;
  /** Its balance minus its starting balance: deposits less withdrawals so far. */
  depositsSoFar: number;
};

export type PotFormResult = { ok?: true; formError?: string; fieldErrors?: Partial<Record<string, string>> };

// Each icon's colour until the user picks one (savings.md §4 "Colour").
const ICON_COLORS: Record<string, string> = {
  laptop: "blue",
  "life-buoy": "red",
  plane: "purple",
  house: "orange",
  gift: "yellow",
  "graduation-cap": "green",
  "calendar-clock": "blue",
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const FIELD_ORDER = ["name", "icon", "color", "target", "targetMonth", "startingBalance", "contribution", "paySlot"] as const;
const LEGEND = "mb-2 text-sm font-bold text-ink";
const SELECT = cn(inputClassName, "h-12 appearance-auto");

/**
 * New and Edit pot (savings.md §4). The projection box shows when the
 * target is reached at this pace and, when a target month won't be met,
 * what each payday would need.
 */
export function PotForm({
  schedule,
  today,
  pot,
  onSave,
  onDeleteRequest,
  onDone,
}: {
  schedule: PaySchedule;
  today: string;
  /** Editing an existing pot; leave out to make one. */
  pot?: EditablePot;
  onSave: (input: PotFormInput) => Promise<PotFormResult>;
  onDeleteRequest?: () => void;
  onDone: () => void;
}) {
  const router = useRouter();
  const [formError, setFormError] = useState<string>();
  const [pending, startTransition] = useTransition();
  // A new pot's colour follows its icon until one is picked.
  const [colorPicked, setColorPicked] = useState(pot != null);
  const twicePaid = schedule.frequency === "semi_monthly";
  const id = pot?.id ?? "new-pot";

  const {
    register,
    handleSubmit,
    setError,
    setValue,
    control,
    formState: { errors },
  } = useForm<PotFormInput, unknown, PotValues>({
    resolver: zodResolver(potSchemaFor(schedule.frequency)),
    mode: "onTouched",
    defaultValues: pot
      ? {
          name: pot.name,
          icon: pot.icon as PotFormInput["icon"],
          color: pot.color as PotFormInput["color"],
          target: pot.target_amount != null ? formatPesoInput(pot.target_amount) : "",
          targetMonth: pot.target_date?.slice(0, 7) ?? "",
          startingBalance: pot.starting_balance > 0 ? formatPesoInput(pot.starting_balance) : "",
          contribution: formatPesoInput(pot.planned_contribution),
          paySlot: pot.pay_slot,
          isLocked: pot.is_locked,
        }
      : {
          name: "",
          icon: "laptop",
          color: "blue",
          target: "",
          targetMonth: "",
          startingBalance: "",
          contribution: "",
          paySlot: "every",
          isLocked: false,
        },
  });

  const [color, target, targetMonth, starting, contribution, paySlot] = useWatch({
    control,
    name: ["color", "target", "targetMonth", "startingBalance", "contribution", "paySlot"],
  });

  // The projection uses what's typed so far; anything that doesn't parse yet
  // counts as empty.
  const targetAmount = parsePesoInput(target ?? "");
  const startingAmount = parsePesoInput(starting ?? "") ?? 0;
  const contributionAmount = parsePesoInput(contribution ?? "") ?? 0;
  const projection = potProjection(
    {
      target_amount: targetAmount != null && targetAmount > 0 ? targetAmount : null,
      target_date: targetMonth ? `${targetMonth}-01` : null,
      starting_balance: Math.max(startingAmount, 0),
      planned_contribution: Math.max(contributionAmount, 0),
      pay_slot: paySlot,
    },
    pot?.depositsSoFar ?? 0,
    schedule,
    today,
  );

  const onSubmit = (values: PotValues) => {
    setFormError(undefined);
    // Send what was typed: the Server Action parses it again with the same schema.
    const input: PotFormInput = {
      name: values.name,
      icon: values.icon,
      color: values.color,
      target: target ?? "",
      targetMonth: targetMonth ?? "",
      startingBalance: starting ?? "",
      contribution: contribution ?? "",
      paySlot: values.paySlot,
      isLocked: values.isLocked,
    };
    startTransition(async () => {
      const result = await onSave(input);
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
    });
  };

  // The target month as two selects; "YYYY-MM" in the form.
  const thisYear = Number(today.slice(0, 4));
  const savedYear = pot?.target_date ? Number(pot.target_date.slice(0, 4)) : thisYear;
  const years = Array.from({ length: 11 }, (_, i) => Math.min(thisYear, savedYear) + i);

  return (
    <form noValidate onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <TextField
        id={`${id}-name`}
        label="Pot name"
        placeholder="e.g. Laptop fund"
        autoComplete="off"
        maxLength={40}
        className="h-[50px]"
        error={errors.name?.message}
        {...register("name")}
      />

      <Controller
        control={control}
        name="icon"
        render={({ field }) => (
          <fieldset>
            <legend className={LEGEND}>Icon</legend>
            <div className="grid grid-cols-7 gap-1.5">
              {POT_ICONS.map((option) => {
                const picked = field.value === option.name;
                return (
                  <button
                    key={option.name}
                    type="button"
                    aria-label={option.label}
                    aria-pressed={picked}
                    onClick={() => {
                      field.onChange(option.name);
                      if (!colorPicked) setValue("color", (ICON_COLORS[option.name] ?? "green") as PotFormInput["color"]);
                    }}
                    className={cn(
                      "flex h-12 items-center justify-center rounded-[14px] outline-link focus-visible:outline-2 focus-visible:outline-offset-2",
                      picked ? PICKED_ICON[color] : "border-[1.5px] border-line bg-surface text-text-2",
                    )}
                  >
                    <CategoryIcon icon={option.name} size={22} />
                  </button>
                );
              })}
            </div>
          </fieldset>
        )}
      />

      <Controller
        control={control}
        name="color"
        render={({ field }) => (
          <fieldset>
            <legend className={LEGEND}>Color</legend>
            <div className="flex flex-wrap gap-3">
              {CATEGORY_COLORS.map((option) => {
                const picked = field.value === option.name;
                const [soft, dot] = SWATCH[option.name];
                return (
                  <button
                    key={option.name}
                    type="button"
                    aria-label={option.label}
                    aria-pressed={picked}
                    onClick={() => {
                      setColorPicked(true);
                      field.onChange(option.name);
                    }}
                    className={cn(
                      "flex size-[46px] items-center justify-center rounded-full outline-link focus-visible:outline-2 focus-visible:outline-offset-2",
                      soft,
                      picked ? "border-[3px] border-ink" : "border-[1.5px] border-line",
                    )}
                  >
                    <span aria-hidden className={cn("size-3.5 rounded-full", dot)} />
                  </button>
                );
              })}
            </div>
          </fieldset>
        )}
      />

      <div className="grid grid-cols-2 gap-3">
        <MoneyInput
          id={`${id}-target`}
          label="Target (optional)"
          placeholder="40,000"
          error={errors.target?.message}
          {...register("target")}
        />
        <Controller
          control={control}
          name="targetMonth"
          render={({ field }) => {
            const [year, month] = field.value ? field.value.split("-") : ["", ""];
            // Picking one half fills in the other, so the value is always a whole month.
            const set = (y: string, m: string) => field.onChange(y || m ? `${y || thisYear}-${m || "01"}` : "");
            return (
              <fieldset className="flex flex-col gap-1.5">
                <legend className="mb-1.5 text-sm font-bold text-ink">Target date (optional)</legend>
                <div className="grid grid-cols-2 gap-1.5">
                  <select
                    aria-label="Month"
                    value={month}
                    onChange={(e) => set(year, e.target.value)}
                    aria-invalid={errors.targetMonth ? true : undefined}
                    className={cn(SELECT, "px-2")}
                  >
                    <option value="">—</option>
                    {MONTHS.map((m, i) => (
                      <option key={m} value={String(i + 1).padStart(2, "0")}>
                        {m}
                      </option>
                    ))}
                  </select>
                  <select
                    aria-label="Year"
                    value={year}
                    onChange={(e) => set(e.target.value, month)}
                    aria-invalid={errors.targetMonth ? true : undefined}
                    className={cn(SELECT, "px-2")}
                  >
                    <option value="">—</option>
                    {years.map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                  </select>
                </div>
                {field.value && (
                  <button
                    type="button"
                    onClick={() => field.onChange("")}
                    className="self-start text-[13px] font-bold text-link outline-link focus-visible:outline-2"
                  >
                    Clear date
                  </button>
                )}
                {errors.targetMonth && <p className="text-[13px] font-bold text-bad-fg">{errors.targetMonth.message}</p>}
              </fieldset>
            );
          }}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <MoneyInput
          id={`${id}-starting`}
          label="Already saved"
          placeholder="0"
          hint={pot ? "Before you started tracking it here." : undefined}
          error={errors.startingBalance?.message}
          {...register("startingBalance")}
        />
        <MoneyInput
          id={`${id}-contribution`}
          label="Save each time"
          placeholder="2,000"
          error={errors.contribution?.message}
          {...register("contribution")}
        />
      </div>

      {/* Weekly and monthly budgets have one payday: no choice, saves "every". */}
      {twicePaid && (
        <Controller
          control={control}
          name="paySlot"
          render={({ field }) => (
            <Segmented
              name={`${id}-slot`}
              legend="From"
              options={[
                { value: "every", label: "Every payday" },
                { value: "payday_1", label: `${paydayLabel(schedule, "payday_1")} only` },
                { value: "payday_2", label: `${paydayLabel(schedule, "payday_2")} only` },
              ]}
              value={field.value}
              onChange={field.onChange}
              error={errors.paySlot?.message}
            />
          )}
        />
      )}

      <Controller
        control={control}
        name="isLocked"
        render={({ field }) => (
          <Switch
            id={`${id}-locked`}
            label="Locked savings"
            hint="Deposits only, like MP2 or time deposits."
            checked={field.value}
            onChange={field.onChange}
          />
        )}
      />

      {/* The projection box (savings.md §4), read politely as it changes. */}
      <div aria-live="polite">
        <ProjectionBox
          projection={projection}
          target={targetAmount != null && targetAmount > 0 ? targetAmount : null}
          contribution={Math.max(contributionAmount, 0)}
          targetMonth={targetMonth ? `${targetMonth}-01` : null}
        />
      </div>

      <FormError message={formError} />

      <SubmitButton
        pending={pending}
        pendingLabel="Saving…"
        // The sheet's one hero button (style-guide.md "Buttons").
        className="h-14 border-2 border-sticker bg-green-500 text-white shadow-sticker-sm hover:bg-green-500/90 aria-busy:bg-green-500 aria-busy:text-white"
      >
        {pot ? "Save changes" : "Create pot"}
      </SubmitButton>

      {pot && onDeleteRequest && (
        <button
          type="button"
          onClick={onDeleteRequest}
          className="h-11 self-center rounded-md px-3 text-[15px] font-extrabold text-danger outline-link focus-visible:outline-2"
        >
          Delete pot
        </button>
      )}
    </form>
  );
}

function ProjectionBox({
  projection,
  target,
  contribution,
  targetMonth,
}: {
  projection: ReturnType<typeof potProjection>;
  target: number | null;
  contribution: number;
  targetMonth: string | null;
}) {
  const lines: { text: string; warn?: boolean }[] = [];
  if (target != null && projection.reached) {
    lines.push({ text: `You've already reached ${formatPeso(target)}.` });
  } else if (contribution <= 0) {
    if (target != null) lines.push({ text: `Set how much to save each time to see when you'll reach ${formatPeso(target)}.` });
  } else if (target == null) {
    lines.push({
      text: `At ${formatPeso(projection.perMonth)} a month you'll save ${formatPeso(projection.perYear)} in a year.`,
    });
  } else if (projection.goalDate) {
    lines.push({
      text: `At ${formatPeso(projection.perMonth)} a month you reach ${formatPeso(target)} by ${formatMonthYear(projection.goalDate)}.`,
    });
  }
  if (projection.needed != null && targetMonth && !projection.reached) {
    lines.push({
      text: `Save ${formatPeso(projection.needed)} each payday to make it by ${formatMonthYear(targetMonth)}.`,
      warn: true,
    });
  }
  if (lines.length === 0) return null;
  return (
    <ul className="flex flex-col gap-1.5 rounded-[14px] bg-mint px-4 py-3 text-sm font-bold text-link-hover">
      {lines.map((line) => (
        <li key={line.text} className={cn(line.warn && "-mx-2 rounded-[10px] bg-warn-bg px-2 py-1 text-warn-fg")}>
          {line.text}
        </li>
      ))}
    </ul>
  );
}
