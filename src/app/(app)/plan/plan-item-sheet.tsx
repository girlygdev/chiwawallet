"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { type AddSheetData, getAddSheetData } from "@/app/(app)/activity/actions";
import { ConfirmDelete } from "@/components/confirm-delete";
import { DebtPaymentForm } from "@/components/plan/debt-payment-form";
import { OneOffForm } from "@/components/plan/one-off-form";
import type { PaydayCard } from "@/components/plan/payday-picker";
import { type EditableItem, PlanItemForm } from "@/components/plan/plan-item-form";
import { SetBudgetForm } from "@/components/plan/set-budget-form";
import { Sheet } from "@/components/sheet";
import { useAppToast } from "@/components/transactions/add-transaction-provider";
import type { ExpenseView } from "@/components/transactions/expense-form";
import { formatPeso } from "@/lib/money";
import { type PlanSummary, removeImpact } from "@/lib/plan";
import type { PlanDebt } from "@/lib/plan-periods";
import {
  addDebtPayment,
  type AddOneOffResult,
  addOneOffItem,
  getPeriodNotAssigned,
  removePlanItem,
  restorePlanItem,
  type SetBudgetResult,
  setBudget,
  updatePlanItem,
} from "./actions";

/** A row as Edit item and Remove from plan need it. */
export type SheetItem = EditableItem & {
  detail: string;
  /** Put back by Undo after Remove (5h-1). */
  edited: boolean;
  income_source_id: string | null;
  bill_id: string | null;
  pot_id: string | null;
  debt_id: string | null;
};

type Summary = Pick<PlanSummary, "moneyForPeriod" | "notAssigned">;

/** The app's one toast (6b-2), for the Plan and the tick buttons. */
export const useShowToast = useAppToast;

// Edit item and Remove from plan (plan.md §3, task 5e), following the page
// address like Bills, so plan rows can be plain links:
//   /plan?start=2026-11-30&edit=<id>     Edit item
//   /plan?start=2026-11-30&remove=<id>   Remove … from this plan?
//   /plan?start=2026-11-30&add=1         Add one-off item (5f)
//   /plan?start=2026-11-30&add=budget    Set a budget (5g-1)
//   /plan?start=2026-11-30&add=debt      Plan a debt payment (5g-2)
// Closing goes back to the period. Its toasts ("Meralco removed · Undo") use
// the app's one toast (6b-2), so they stay up after a dialog closes or the
// page moves to another period.
export function PlanEditor({
  items,
  summary,
  periodStart,
  cards,
  budgets,
  periodLabel,
  debts,
  children,
}: {
  items: SheetItem[];
  summary: Summary;
  periodStart: string;
  /** Add one-off item's payday cards; empty when the period has ended (no adding). */
  cards: PaydayCard[];
  /** Set a budget: this period's spending budgets, category id → amount. */
  budgets: Record<string, number>;
  /** "Nov 15 – 29" */
  periodLabel: string;
  /** Plan a debt payment's choices: debts not paid off. */
  debts: PlanDebt[];
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const setToast = useAppToast();

  const find = (key: string) => items.find((i) => i.id === params.get(key));
  const editing = find("edit");
  const removing = find("remove");
  const periodHref = `${pathname}?start=${periodStart}`;
  const close = () => router.replace(periodHref, { scroll: false });

  // Add one-off item (`add=1`) and Set a budget (`add=budget`): the add
  // sheet's categories load when one opens, fresh each time. Closing resets
  // the view and, through the key, the form. Not in an ended period.
  const addKind = cards.length > 0 ? params.get("add") : null;
  const settingBudget = addKind === "budget";
  // Only with a debt to pay: an old link with none opens nothing.
  const planningDebt = addKind === "debt" && debts.length > 0;
  const adding = addKind != null && (addKind !== "debt" || planningDebt);
  const [addData, setAddData] = useState<AddSheetData | null>(null);
  const [addView, setAddView] = useState<ExpenseView>("form");
  const [addCount, setAddCount] = useState(0);
  const nameRef = useRef<HTMLInputElement>(null);
  const reloadAddData = useCallback(async () => setAddData(await getAddSheetData()), []);
  useEffect(() => {
    if (!adding) return;
    getAddSheetData()
      .then(setAddData)
      .catch((error) => console.error("plan: couldn't load categories", error));
  }, [adding]);
  const closeAdd = () => {
    close();
    setAddView("form");
    setAddData(null);
    setAddCount((n) => n + 1);
  };
  const loadNotAssigned = useCallback(async (start: string) => (await getPeriodNotAssigned(start))?.notAssigned ?? null, []);

  // After adding: go to the period that pays for it, with Undo for 5 seconds.
  // `text` is the toast: "Dad's birthday gift added", "SPayLater payment planned".
  const onAdded = (saved: NonNullable<AddOneOffResult["saved"]>, text = `${saved.name} added`) => {
    setAddView("form");
    setAddData(null);
    setAddCount((n) => n + 1);
    router.replace(`${pathname}?start=${saved.periodStart}`, { scroll: false });
    router.refresh();
    setToast({
      id: Date.now(),
      text,
      action: {
        label: "Undo",
        onClick: async () => {
          setToast(null);
          const result = await removePlanItem(saved.id);
          router.refresh();
          setToast({ id: Date.now(), text: result.ok ? `${saved.name} removed` : (result.formError ?? "Couldn't undo.") });
        },
      },
    });
  };
  // The back arrow and Esc go one step back: New category → picker → form.
  const addBack =
    addView === "new-category"
      ? { label: "Back to Choose a category", onClick: () => setAddView("picker") }
      : addView === "picker"
        ? { label: settingBudget ? "Back to Set a budget" : "Back to Add one-off item", onClick: () => setAddView("form") }
        : undefined;

  // After Set a budget: the plan and its totals update.
  const onBudgetSet = (saved: NonNullable<SetBudgetResult["saved"]>) => {
    closeAdd();
    router.refresh();
    setToast({ id: Date.now(), text: `${saved.name} budget set · ${formatPeso(saved.amount)}` });
  };

  const onSaved = () => {
    router.refresh();
    close();
    setToast({ id: Date.now(), text: "Changes saved" });
  };

  // After Remove: the plan and its totals update, then "Meralco removed"
  // with Undo for 5 seconds, which clears deleted_at again.
  const onRemoved = (item: SheetItem) => {
    router.refresh();
    close();
    setToast({
      id: Date.now(),
      text: `${item.name} removed`,
      action: {
        label: "Undo",
        onClick: async () => {
          setToast(null);
          const result = await restorePlanItem(item.id, item.edited);
          router.refresh();
          setToast({ id: Date.now(), text: result.ok ? `${item.name} is back` : (result.formError ?? "Couldn't undo.") });
        },
      },
    });
  };

  return (
    <>
      {children}

      <Sheet
        open={editing != null}
        onOpenChange={(next) => !next && close()}
        title="Edit item"
        description={editing ? sheetNote(editing) : undefined}
      >
        {editing && (
          <PlanItemForm
            // A fresh form per item, so its fields start from that item.
            key={editing.id}
            item={editing}
            summary={summary}
            onSave={async (input) => {
              const result = await updatePlanItem(editing.id, input);
              if (result.ok) onSaved();
              return result;
            }}
            onRemoveRequest={() => router.replace(`${periodHref}&remove=${editing.id}`, { scroll: false })}
          />
        )}
      </Sheet>

      <Sheet
        open={adding}
        onOpenChange={(next, details) => {
          if (!next && addBack && details.reason === "escape-key") {
            details.cancel();
            addBack.onClick();
            return;
          }
          if (!next) closeAdd();
        }}
        title={
          addView === "picker"
            ? "Choose a category"
            : addView === "new-category"
              ? "New category"
              : settingBudget
                ? "Set a budget"
                : planningDebt
                  ? "Plan a debt payment"
                  : "Add one-off item"
        }
        description={
          addView !== "form"
            ? undefined
            : settingBudget
              ? "A spending limit for a category, like Food."
              : planningDebt
                ? "An extra payment toward a debt, from any payday."
                : "Something that happens once: a gift, event, fee or repair."
        }
        back={addBack}
        // Set a budget and Plan a debt payment start with their first choice (Base UI's default).
        initialFocus={settingBudget || planningDebt ? undefined : nameRef}
      >
        {settingBudget && (
          <SetBudgetForm
            key={addCount}
            data={addData}
            view={addView}
            onViewChange={setAddView}
            onCategoriesChanged={reloadAddData}
            budgets={budgets}
            notAssigned={summary.notAssigned}
            periodLabel={periodLabel}
            onSave={(input) => setBudget(periodStart, input)}
            onSaved={onBudgetSet}
            onCancel={closeAdd}
          />
        )}
        {planningDebt && (
          <DebtPaymentForm
            key={addCount}
            debts={debts}
            cards={cards}
            defaultStart={cards.some((c) => c.start === periodStart) ? periodStart : cards[0].start}
            loadNotAssigned={loadNotAssigned}
            onSave={addDebtPayment}
            onSaved={(saved) => onAdded(saved, `${saved.name} payment planned`)}
            onCancel={closeAdd}
          />
        )}
        {adding && !settingBudget && !planningDebt && (
          <OneOffForm
            key={addCount}
            cards={cards}
            // The period being viewed, if it's offered; otherwise the current one.
            defaultStart={cards.some((c) => c.start === periodStart) ? periodStart : cards[0].start}
            data={addData}
            view={addView}
            onViewChange={setAddView}
            onCategoriesChanged={reloadAddData}
            loadNotAssigned={loadNotAssigned}
            nameRef={nameRef}
            onSave={addOneOffItem}
            onSaved={onAdded}
            onCancel={closeAdd}
          />
        )}
      </Sheet>

      {removing && (
        <RemoveItemDialog key={removing.id} item={removing} summary={summary} onClose={close} onRemoved={onRemoved} />
      )}

    </>
  );
}

/** Under the Edit item title: what saving changes, for items made from something else. */
function sheetNote(item: SheetItem): string {
  if (item.bill_id) return "Only this period changes. Your bill stays the same.";
  if (item.pot_id) return "Only this period changes. Your pot's contribution stays the same.";
  if (item.debt_id) return "Only this period changes. Your debt's payments stay the same.";
  if (item.income_source_id) return "Only this period changes. Your income source stays the same.";
  if (item.origin === "recurring") return "Only this period changes. Your budget per payday stays the same.";
  return "Changes this period's plan.";
}

// "Remove Meralco from this plan?" (delete-pattern.md level 1): the item
// card, its effect in pesos, then Remove from plan or Keep it. A soft delete
// with Undo in the toast that follows.
function RemoveItemDialog({
  item,
  summary,
  onClose,
  onRemoved,
}: {
  item: SheetItem;
  summary: Summary;
  onClose: () => void;
  onRemoved: (item: SheetItem) => void;
}) {
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const impact = removeImpact(summary, item);

  const confirm = () => {
    setError(undefined);
    startTransition(async () => {
      const result = await removePlanItem(item.id);
      if (result.formError) return setError(result.formError);
      onRemoved(item);
    });
  };

  return (
    <ConfirmDelete
      open
      onOpenChange={(next) => !next && !pending && onClose()}
      title={`Remove ${item.name} from this plan?`}
      description={removeNote(item)}
      confirmLabel="Remove from plan"
      pendingLabel="Removing…"
      onConfirm={confirm}
      pending={pending}
      error={error}
    >
      {/* The item itself (delete-pattern.md §2.2). */}
      <div className="flex items-center justify-between gap-3 rounded-[14px] bg-bg px-4 py-3">
        <div className="min-w-0">
          <p className="truncate font-extrabold">{item.name}</p>
          <p className="truncate text-[13px] text-text-3">{item.detail}</p>
        </div>
        <p className="shrink-0 font-display text-lg font-semibold">{formatPeso(item.planned_amount)}</p>
      </div>

      {/* The effect in pesos (§2.3). */}
      {impact && (
        <p className="text-sm">
          <span className="font-bold">{impact.label}:</span> {formatPeso(impact.before)} →{" "}
          <span className="font-extrabold">{formatPeso(impact.after)}</span>
        </p>
      )}
    </ConfirmDelete>
  );
}

/**
 * A generated item isn't added back to this period (add_plan_items() skips
 * removed rows), so say so, and that what it came from stays.
 */
function removeNote(item: SheetItem): string {
  if (item.origin !== "recurring") return "You can undo this for a few seconds after.";
  const stays = item.bill_id
    ? "Your bill itself stays."
    : item.pot_id
      ? "Your pot itself stays."
      : item.debt_id
        ? "Your debt itself stays."
        : item.income_source_id
          ? "Your income source itself stays."
          : "Your budget per payday stays.";
  return `It won't be added back to this period. ${stays}`;
}

