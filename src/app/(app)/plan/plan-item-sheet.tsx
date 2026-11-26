"use client";

import { LoaderCircle } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { createContext, useCallback, useContext, useState, useTransition } from "react";
import { FormError } from "@/components/auth/form-error";
import { ConfirmDelete } from "@/components/confirm-delete";
import { type EditableItem, PlanItemForm } from "@/components/plan/plan-item-form";
import { Sheet } from "@/components/sheet";
import { Toast, type ToastMessage } from "@/components/toast";
import { formatPeso } from "@/lib/money";
import { type PlanSummary, removeImpact } from "@/lib/plan";
import { addStarterPlan, removePlanItem, restorePlanItem, updatePlanItem } from "./actions";

/** A row as Edit item and Remove from plan need it. */
export type SheetItem = EditableItem & {
  detail: string;
  income_source_id: string | null;
  bill_id: string | null;
  pot_id: string | null;
  debt_id: string | null;
};

type Summary = Pick<PlanSummary, "moneyForPeriod" | "notAssigned">;

const ToastContext = createContext<(toast: ToastMessage) => void>(() => {});

// Edit item and Remove from plan (plan.md §3, task 5e), following the page
// address like Bills, so plan rows can be plain links:
//   /plan?start=2026-11-30&edit=<id>     Edit item
//   /plan?start=2026-11-30&remove=<id>   Remove … from this plan?
// Closing goes back to the period. It also owns the toast, so "Meralco
// removed · Undo" stays up after the dialog closes, and the starter button
// (inside `children`) can use it after the empty plan is gone.
export function PlanEditor({
  items,
  summary,
  periodStart,
  children,
}: {
  items: SheetItem[];
  summary: Summary;
  periodStart: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const dismissToast = useCallback(() => setToast(null), []);

  const find = (key: string) => items.find((i) => i.id === params.get(key));
  const editing = find("edit");
  const removing = find("remove");
  const periodHref = `${pathname}?start=${periodStart}`;
  const close = () => router.replace(periodHref, { scroll: false });

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
          const result = await restorePlanItem(item.id);
          router.refresh();
          setToast({ id: Date.now(), text: result.ok ? `${item.name} is back` : (result.formError ?? "Couldn't undo.") });
        },
      },
    });
  };

  return (
    <ToastContext value={setToast}>
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

      {removing && (
        <RemoveItemDialog key={removing.id} item={removing} summary={summary} onClose={close} onRemoved={onRemoved} />
      )}

      <Toast toast={toast} onDismiss={dismissToast} />
    </ToastContext>
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

// "Use this starter plan" (plan.md §5): adds the three starter items, then
// the page refreshes into the full plan and the toast says so.
export function UseStarterPlanButton({ periodStart }: { periodStart: string }) {
  const router = useRouter();
  const showToast = useContext(ToastContext);
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  const start = () => {
    setError(undefined);
    startTransition(async () => {
      const result = await addStarterPlan(periodStart);
      if (result.formError) return setError(result.formError);
      router.refresh();
      showToast({ id: Date.now(), text: "Starter plan added" });
    });
  };

  return (
    <div className="flex flex-col gap-1.5">
      <button
        type="button"
        onClick={start}
        disabled={pending}
        aria-busy={pending || undefined}
        // Primary, not Hero: the card around it is already the area's one sticker.
        className="flex h-[52px] items-center justify-center gap-2 rounded-md bg-green-600 px-5 text-base font-extrabold text-white outline-link hover:bg-green-600/90 focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-70"
      >
        {pending && <LoaderCircle aria-hidden className="size-5 animate-spin" />}
        {pending ? "Adding…" : "Use this starter plan"}
      </button>
      <p className="text-center text-[13px] text-text-3">Creates three budget lines you can split into categories later.</p>
      <FormError message={error} />
    </div>
  );
}
