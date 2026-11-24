"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useRef, useState, useTransition } from "react";
import { type Resolver, useForm, useWatch } from "react-hook-form";
import type { AddSheetData, EditingTransaction, SaveExpenseResult } from "@/app/(app)/activity/actions";
import { createCategory } from "@/app/(app)/settings/categories/actions";
import { FormError } from "@/components/auth/form-error";
import { SubmitButton } from "@/components/auth/submit-button";
import { TextField } from "@/components/auth/text-field";
import { CategoryForm } from "@/components/categories/category-form";
import { formatPesoInput, parsePesoInput } from "@/lib/money";
import { todayInManila } from "@/lib/periods";
import {
  type TransactionFormInput,
  type TransactionValues,
  transactionSchemaFor,
} from "@/lib/validation/transaction";
import { AmountField } from "./amount-field";
import { CategoryGrid } from "./category-grid";
import { CategoryPicker } from "./category-picker";
import { DateButton } from "./date-button";
import { DeleteLink } from "./delete-link";
import { sheetImpact } from "./sheet-impact";

const FIELD_ORDER = ["amount", "categoryId", "date", "note"] as const;

/** What the sheet shows: the form, the category picker, or New category (3h-3). */
export type ExpenseView = "form" | "picker" | "new-category";

// The Add expense form (activity.md §3): amount → category → Save in under
// 10 seconds; date and note are optional. `data` arrives a moment after the
// sheet opens; the amount field works before that, and Save waits for it.
//
// More swaps the form for the category picker, and the picker's New category
// tile for New category (3h-3). The form stays mounted (only hidden), so what
// was typed is kept; `view` lives in the provider because the sheet's title
// and back arrow change with it. After saving a new category, the sheet's
// categories reload and the form comes back with it selected (owner, Nov 24).
//
// With `editing`, it's Edit transaction (activity.md fix #6): filled in from
// the row, Save changes, and a Delete link at the bottom.
export function ExpenseForm({
  data,
  amountRef,
  defaultAmount,
  onAmountChange,
  onSave,
  onSaved,
  view,
  onViewChange,
  onCategoriesChanged,
  editing = null,
  onDelete,
}: {
  data: AddSheetData | null;
  amountRef: React.RefObject<HTMLInputElement | null>;
  /** What was typed on the other tab, kept when switching. */
  defaultAmount: string;
  onAmountChange: (text: string) => void;
  onSave: (input: TransactionFormInput) => Promise<SaveExpenseResult>;
  onSaved: (saved: { id: string; amount: number }) => void;
  view: ExpenseView;
  onViewChange: (view: ExpenseView) => void;
  /** Reloads the sheet's data after a new category is saved. */
  onCategoriesChanged: () => Promise<void>;
  editing?: EditingTransaction | null;
  onDelete?: () => void;
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
    defaultValues: editing
      ? {
          type: "expense",
          amount: formatPesoInput(editing.amount),
          categoryId: editing.categoryId,
          date: editing.date,
          note: editing.note ?? "",
        }
      : { type: "expense", amount: defaultAmount, categoryId: "", date: today, note: "" },
  });

  const amountText = useWatch({ control, name: "amount" }) ?? "";
  useEffect(() => onAmountChange(amountText), [amountText, onAmountChange]);
  const categoryId = useWatch({ control, name: "categoryId" });
  const date = useWatch({ control, name: "date" }) ?? today;
  const centavos = parsePesoInput(amountText);
  const validAmount = centavos != null && centavos > 0 ? centavos : null;

  // The effect in pesos before saving (CLAUDE.md UI rules).
  const impact = sheetImpact({ data, editing, kind: "out", amount: validAmount, date });

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

  // Back to the form: focus the chosen tile, or More if nothing was picked,
  // so keyboard and screen-reader users land where they left.
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

  // The picker's search text becomes New category's starting name.
  const [newName, setNewName] = useState("");
  const onCategoryCreated = async (id: string) => {
    try {
      // So the grid has a tile for it. If this fails, the id still saves fine.
      await onCategoriesChanged();
    } catch (error) {
      console.error("activity: couldn't reload categories", error);
    }
    pick(id);
  };

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
        <CategoryForm targets={data.targets} defaultName={newName} onSave={createCategory} onSaved={onCategoryCreated} />
      )}
      <form onSubmit={handleSubmit(onSubmit)} noValidate hidden={view !== "form"} className="flex flex-col gap-5">
        <AmountField id="expense-amount" field={amountField} amountRef={amountRef} error={errors.amount?.message} />

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
          {editing ? "Save changes" : "Save expense"}
        </SubmitButton>

        {editing && onDelete && <DeleteLink onClick={onDelete} />}
      </form>
    </>
  );
}
