"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { ConfirmDelete } from "@/components/confirm-delete";
import { DebtForm, type EditableDebt } from "@/components/debts/debt-form";
import { Sheet } from "@/components/sheet";
import { formatPeso } from "@/lib/money";
import type { PaySchedule } from "@/lib/periods";
import { addDebt, deleteDebt, setDebtPaidOff, updateDebt } from "./actions";

type SheetDebt = EditableDebt & {
  /** What's left, for the delete dialog. */
  left: number;
};

// New / Edit debt and the Delete dialog, following the page address like
// Bills, so the + button and each card's Edit link can be plain links:
//   /debts?add=1          New debt
//   /debts?edit=<id>      Edit debt (with Mark as paid off)
//   /debts?delete=<id>    Delete debt?
// Closing clears the address.
export function DebtSheet({ debts, schedule }: { debts: SheetDebt[]; schedule: PaySchedule }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const find = (key: string) => debts.find((d) => d.id === params.get(key));
  const editing = find("edit");
  const deleting = find("delete");
  const sheetOpen = params.get("add") != null || editing != null;
  const close = () => router.replace(pathname, { scroll: false });

  return (
    <>
      <Sheet
        open={sheetOpen}
        onOpenChange={(next) => !next && close()}
        title={editing ? "Edit debt" : "New debt"}
        description="Loans, credit cards, BNPL or money you owe someone."
      >
        {sheetOpen && (
          <DebtForm
            // A fresh form per debt, so its fields start from that debt.
            key={editing?.id ?? "add"}
            schedule={schedule}
            debt={editing}
            onSave={(input) => (editing ? updateDebt(editing.id, input) : addDebt(input))}
            onPaidOffChange={editing ? (paidOff) => setDebtPaidOff(editing.id, paidOff) : undefined}
            onDeleteRequest={
              editing ? () => router.replace(`${pathname}?delete=${editing.id}`, { scroll: false }) : undefined
            }
            onDone={close}
          />
        )}
      </Sheet>

      {deleting && <DeleteDebtDialog key={deleting.id} debt={deleting} onClose={close} />}
    </>
  );
}

// "Delete SPayLater?" (delete-pattern.md level 2, "Debt"). The spec's two
// choices are kept apart so the red button only ever deletes: "Mark it paid
// off" is offered here as a link (and in Edit), like Income's "End it instead".
function DeleteDebtDialog({ debt, onClose }: { debt: SheetDebt; onClose: () => void }) {
  const router = useRouter();
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  const run = (action: () => Promise<{ ok?: true; formError?: string }>) => {
    setError(undefined);
    startTransition(async () => {
      const result = await action();
      if (result.formError) return setError(result.formError);
      router.refresh();
      onClose();
    });
  };

  return (
    <ConfirmDelete
      open
      onOpenChange={(next) => !next && !pending && onClose()}
      title={`Delete ${debt.name}?`}
      description={
        debt.left > 0 ? (
          <>
            It still has <strong>{formatPeso(debt.left)}</strong> left. It disappears from your debts.
          </>
        ) : (
          "It disappears from your debts."
        )
      }
      confirmLabel="Delete debt"
      onConfirm={() => run(() => deleteDebt(debt.id))}
      pending={pending}
      error={error}
    >
      <p className="text-sm text-text-2">Past payments stay in Activity for your records.</p>
      {debt.paid_off_at == null && (
        <p className="text-sm text-text-2">
          Paid it off outside the app?{" "}
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => setDebtPaidOff(debt.id, true))}
            className="font-extrabold text-link outline-link hover:text-link-hover focus-visible:outline-2"
          >
            Mark it paid off
          </button>{" "}
          instead, to keep it in Paid off.
        </p>
      )}
    </ConfirmDelete>
  );
}
