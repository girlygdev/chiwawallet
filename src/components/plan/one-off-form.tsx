"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useRef, useState, useTransition } from "react";
import { useForm, useWatch } from "react-hook-form";
import type { AddSheetData } from "@/app/(app)/activity/actions";
import type { AddOneOffResult } from "@/app/(app)/plan/actions";
import { createCategory } from "@/app/(app)/settings/categories/actions";
import { FormError } from "@/components/auth/form-error";
import { SubmitButton } from "@/components/auth/submit-button";
import { TextField } from "@/components/auth/text-field";
import { CategoryForm } from "@/components/categories/category-form";
import { MoneyInput } from "@/components/money-input";
import { CategoryGrid } from "@/components/transactions/category-grid";
import { CategoryPicker } from "@/components/transactions/category-picker";
import type { ExpenseView } from "@/components/transactions/expense-form";
import { formatPeso, parsePesoInput } from "@/lib/money";
import { formatPeriodRange, formatShortDate } from "@/lib/periods";
import { oneOffImpact, suggestedPeriodStart } from "@/lib/plan";
import type { BudgetGroup } from "@/lib/transactions";
import { cn } from "@/lib/utils";
import { type OneOffItem, type OneOffItemInput, oneOffItemSchema } from "@/lib/validation/plan-item";

/** A payday card: a period the one-off can be paid from. */
export type PaydayCard = { start: string; end: string; label: "Now" | "Next" | "Ahead" };

const FIELD_ORDER = ["name", "amount", "neededBy", "periodStart", "categoryId"] as const;
const GROUP_NAMES: Record<BudgetGroup, string> = { needs: "Needs", wants: "Wants", savings_debt: "Savings & debt payoff" };

/**
 * Add one-off item (plan.md §6, task 5f). Which payday pays for it follows
 * Needed by ("the payday just before Dec 5") until a card is picked by hand.
 * The impact box shows the chosen period's Not assigned yet before → after;
 * `loadNotAssigned` fetches it per period, the way that period's Plan works it out.
 */
export function OneOffForm({
  cards,
  defaultStart,
  data,
  view,
  onViewChange,
  onCategoriesChanged,
  loadNotAssigned,
  nameRef,
  onSave,
  onSaved,
  onCancel,
}: {
  /** The current period and up to 3 months ahead, oldest first. */
  cards: PaydayCard[];
  /** The period being viewed, picked at first. */
  defaultStart: string;
  /** The add sheet's categories, most used first; empty while loading. */
  data: AddSheetData | null;
  view: ExpenseView;
  onViewChange: (view: ExpenseView) => void;
  /** Reloads `data` after New category, so the grid has its tile. */
  onCategoriesChanged: () => Promise<void>;
  loadNotAssigned: (start: string) => Promise<number | null>;
  /** The first field, focused when the sheet opens. */
  nameRef: React.RefObject<HTMLInputElement | null>;
  onSave: (input: OneOffItemInput) => Promise<AddOneOffResult>;
  onSaved: (saved: NonNullable<AddOneOffResult["saved"]>) => void;
  onCancel: () => void;
}) {
  const [formError, setFormError] = useState<string>();
  const [pending, startTransition] = useTransition();
  // Needed by moves the payday until one is picked by hand.
  const [periodPicked, setPeriodPicked] = useState(false);

  const {
    register,
    handleSubmit,
    setError,
    setValue,
    getValues,
    control,
    formState: { errors },
  } = useForm<OneOffItemInput, unknown, OneOffItem>({
    resolver: zodResolver(oneOffItemSchema),
    mode: "onTouched",
    defaultValues: { name: "", amount: "", neededBy: "", periodStart: defaultStart, categoryId: "" },
  });

  const amountText = useWatch({ control, name: "amount" }) ?? "";
  const neededBy = useWatch({ control, name: "neededBy" }) ?? "";
  const periodStart = useWatch({ control, name: "periodStart" });
  const categoryId = useWatch({ control, name: "categoryId" });
  const centavos = parsePesoInput(amountText);
  const validNeededBy = /^\d{4}-\d{2}-\d{2}$/.test(neededBy) ? neededBy : null;
  const suggested = validNeededBy ? suggestedPeriodStart(validNeededBy, cards) : null;

  const onNeededByChange = (date: string) => {
    if (periodPicked || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
    const start = suggestedPeriodStart(date, cards);
    if (start) setValue("periodStart", start);
  };

  // Each period's Not assigned yet, fetched once when its card is first picked.
  const [notAssigned, setNotAssigned] = useState<Record<string, number | null>>({});
  const requested = useRef(new Set<string>());
  useEffect(() => {
    if (!periodStart || requested.current.has(periodStart)) return;
    requested.current.add(periodStart);
    loadNotAssigned(periodStart)
      .then((n) => setNotAssigned((all) => ({ ...all, [periodStart]: n })))
      .catch((error) => console.error("plan: couldn't load the period's numbers", error));
  }, [periodStart, loadNotAssigned]);

  const card = cards.find((c) => c.start === periodStart);
  const range = card ? formatPeriodRange(card.start, card.end) : "";
  const before = periodStart ? notAssigned[periodStart] : undefined;
  const impact = centavos != null && centavos > 0 && before != null ? oneOffImpact(before, centavos) : null;
  const category = data?.categories.find((c) => c.id === categoryId);

  // Back to the form from the picker: focus the chosen tile, or More.
  const gridRef = useRef<HTMLDivElement>(null);
  const wasAway = useRef(false);
  useEffect(() => {
    if (wasAway.current && view === "form") {
      const grid = gridRef.current;
      (grid?.querySelector<HTMLElement>('[aria-pressed="true"]') ?? grid?.querySelector<HTMLElement>("[data-more]"))?.focus();
    }
    wasAway.current = view !== "form";
  }, [view]);

  const pick = (id: string) => {
    setValue("categoryId", id, { shouldValidate: errors.categoryId != null });
    onViewChange("form");
  };
  const [newName, setNewName] = useState("");

  const onSubmit = () => {
    setFormError(undefined);
    // Send what was typed: the Server Action parses it again with the same schema.
    const input = getValues();
    startTransition(async () => {
      const result = await onSave(input);
      if (result.formError) setFormError(result.formError);
      const firstBad = FIELD_ORDER.find((f) => result.fieldErrors?.[f]);
      for (const f of FIELD_ORDER) {
        const message = result.fieldErrors?.[f];
        if (message) setError(f, { message }, { shouldFocus: f === firstBad });
      }
      if (result.saved) onSaved(result.saved);
    });
  };

  const nameField = register("name");
  const neededByField = register("neededBy", { onChange: (e) => onNeededByChange(e.target.value) });

  return (
    <>
      {view === "picker" && data && (
        <CategoryPicker
          categories={data.categories}
          recentIds={data.recentIds}
          targets={data.targets}
          value={categoryId || undefined}
          onPick={pick}
          onNew={(name) => {
            setNewName(name);
            onViewChange("new-category");
          }}
        />
      )}
      {view === "new-category" && data && (
        <CategoryForm
          targets={data.targets}
          defaultName={newName}
          onSave={createCategory}
          onSaved={async (id) => {
            try {
              await onCategoriesChanged();
            } catch (error) {
              console.error("plan: couldn't reload categories", error);
            }
            pick(id);
          }}
        />
      )}

      <form noValidate onSubmit={handleSubmit(onSubmit)} hidden={view !== "form"} className="flex flex-col gap-4">
        <TextField
          id="one-off-name"
          label="What is it for?"
          placeholder="Dad's birthday gift"
          autoComplete="off"
          maxLength={40}
          className="h-[50px]"
          error={errors.name?.message}
          {...nameField}
          ref={(el) => {
            nameField.ref(el);
            nameRef.current = el;
          }}
        />
        <MoneyInput id="one-off-amount" label="Amount" placeholder="2,500" className="h-[50px]" error={errors.amount?.message} {...register("amount")} />
        {/* Future dates are the point here, so a plain date input, like Edit item. */}
        <TextField
          id="one-off-needed-by"
          type="date"
          label="Needed by (optional)"
          className="h-12"
          error={errors.neededBy?.message}
          {...neededByField}
        />

        {/* Which payday pays for it: one radio card per period, NOW first. */}
        <fieldset className="flex min-w-0 flex-col gap-1.5" aria-describedby={errors.periodStart ? "one-off-period-error" : undefined}>
          <legend className="mb-1.5 text-sm font-bold text-ink">Which payday pays for it?</legend>
          <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 md:-mx-6 md:px-6">
            {cards.map((c) => {
              const checked = c.start === periodStart;
              return (
                <label
                  key={c.start}
                  className={cn(
                    "flex min-h-11 shrink-0 cursor-pointer flex-col justify-center rounded-[14px] px-3.5 py-2 has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-link",
                    checked ? "border-2 border-green-600 bg-mint text-ink" : "border-[1.5px] border-line bg-surface text-ink",
                  )}
                >
                  <input
                    type="radio"
                    name="one-off-period"
                    value={c.start}
                    checked={checked}
                    onChange={() => {
                      setPeriodPicked(true);
                      setValue("periodStart", c.start, { shouldValidate: errors.periodStart != null });
                    }}
                    className="sr-only"
                  />
                  <span className="text-[11px] font-extrabold tracking-wide uppercase">{c.label}</span>
                  <span className="text-sm font-bold whitespace-nowrap">{formatPeriodRange(c.start, c.end)}</span>
                </label>
              );
            })}
          </div>
          {suggested && validNeededBy && (
            <p className="text-[13px] text-text-3">
              {/* Names the payday only when another card is picked. */}
              {suggested === periodStart
                ? `Suggested: the payday just before ${formatShortDate(validNeededBy)}.`
                : `Suggested: ${formatShortDate(suggested)}, the payday just before ${formatShortDate(validNeededBy)}.`}
            </p>
          )}
          {errors.periodStart && (
            <p id="one-off-period-error" className="text-[13px] font-bold text-bad-fg">
              {errors.periodStart.message}
            </p>
          )}
        </fieldset>

        <div className="flex flex-col gap-1.5">
          <CategoryGrid
            categories={data?.categories ?? null}
            topCount={data?.topCount ?? 5}
            loading={data == null}
            value={categoryId || undefined}
            onChange={(id) => setValue("categoryId", id, { shouldValidate: errors.categoryId != null })}
            onMore={() => onViewChange("picker")}
            error={errors.categoryId?.message}
            ref={gridRef}
          />
          {/* Which 50/30/20 group it counts in (plan.md §6). */}
          <p aria-live="polite" className="text-[13px] text-text-3">
            {category?.budget_group ? `Counts as ${GROUP_NAMES[category.budget_group as BudgetGroup]}` : ""}
          </p>
        </div>

        {/* The effect in pesos before saving: yellow, not red, below ₱0. */}
        <div aria-live="polite">
          {impact ? (
            <div
              className={cn(
                "flex flex-col gap-0.5 rounded-[14px] px-4 py-3 text-sm",
                impact.over > 0 ? "bg-cat-yellow-bg text-cat-yellow-fg" : "bg-mint text-link-hover",
              )}
            >
              <p>
                <span className="font-bold">{range} not assigned:</span> {formatPeso(impact.before)} →{" "}
                <span className="font-extrabold">{formatPeso(impact.after)}</span>
              </p>
              <p>
                {impact.over > 0
                  ? `${formatPeso(impact.over)} more than that period has left.`
                  : "It'll show in that period's plan."}
              </p>
            </div>
          ) : (
            centavos != null &&
            centavos > 0 &&
            before === undefined && <p className="rounded-[14px] bg-bg px-4 py-3 text-sm text-text-3">Working out {range}…</p>
          )}
        </div>

        <FormError message={formError} />

        <div className="flex flex-col gap-2 md:flex-row-reverse">
          <SubmitButton
            pending={pending}
            pendingLabel="Adding…"
            // The sheet's one hero button (style-guide.md "Buttons").
            className="h-14 border-2 border-sticker bg-green-500 text-white shadow-sticker-sm hover:bg-green-500/90 aria-busy:bg-green-500 aria-busy:text-white md:flex-1"
          >
            Add to plan
          </SubmitButton>
          {/* Desktop adds Cancel (plan.md §6); phones close with the X or a swipe. */}
          <button
            type="button"
            onClick={onCancel}
            className="hidden h-14 items-center justify-center rounded-md border-[1.5px] border-line bg-surface px-5 text-base font-extrabold text-ink outline-link focus-visible:outline-2 focus-visible:outline-offset-2 md:flex md:flex-1"
          >
            Cancel
          </button>
        </div>
      </form>
    </>
  );
}
