"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { ConfirmDelete } from "@/components/confirm-delete";
import { CardForm, type EditableCard } from "@/components/debts/card-form";
import { DebtForm, type EditableDebt } from "@/components/debts/debt-form";
import { Segmented } from "@/components/segmented";
import { Sheet } from "@/components/sheet";
import { formatPeso } from "@/lib/money";
import type { PaySchedule } from "@/lib/periods";
import { addCard, addDebt, deleteDebt, setDebtPaidOff, updateCard, updateDebt } from "./actions";

type SheetDebt = EditableDebt & {
  /** What's left, for the delete dialog. */
  left: number;
  /** Paid so far, for the "When I can" monthly hint. */
  paid: number;
};

/** A credit card (8b-2), with its balance for the delete dialog. */
type SheetCard = EditableCard & { left: number };

type Kind = "loan" | "card";

// New / Edit debt and the Delete dialog, following the page address like
// Bills, so the + button and each card's Edit link can be plain links:
//   /debts?add=1          New debt (a loan; Kind switches to a card)
//   /debts?add=card       New debt, Credit card picked (8b-2)
//   /debts?edit=<id>      Edit debt (with Mark as paid off) or Edit card (Close card)
//   /debts?delete=<id>    Delete debt? / Delete card?
// Closing clears the address.
export function DebtSheet({
  debts,
  cards,
  schedule,
  today,
}: {
  debts: SheetDebt[];
  cards: SheetCard[];
  schedule: PaySchedule;
  today: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const find = (key: string) => debts.find((d) => d.id === params.get(key));
  const findCard = (key: string) => cards.find((c) => c.id === params.get(key));
  const editing = find("edit");
  const editingCard = findCard("edit");
  const deleting = find("delete");
  const deletingCard = findCard("delete");
  const adding = params.get("add");
  const sheetOpen = adding != null || editing != null || editingCard != null;
  // New debt only: a loan or money owed, or a credit card (8b-2), from the
  // address until picked here. Editing keeps the kind (the database keeps a
  // card a card).
  const [picked, setKind] = useState<Kind | null>(null);
  const kind: Kind = picked ?? (adding === "card" ? "card" : "loan");
  const close = () => {
    setKind(null);
    router.replace(pathname, { scroll: false });
  };
  const showCard = editingCard != null || (editing == null && kind === "card");
  const deleteHref = (id: string) => () => router.replace(`${pathname}?delete=${id}`, { scroll: false });

  return (
    <>
      <Sheet
        open={sheetOpen}
        onOpenChange={(next) => !next && close()}
        title={editingCard ? "Edit card" : editing ? "Edit debt" : "New debt"}
        description={
          editingCard
            ? "A credit card: what you owe on it goes up with each purchase."
            : "Loans, credit cards, BNPL or money you owe someone."
        }
      >
        {sheetOpen && editing == null && editingCard == null && (
          <div className="mb-4">
            <Segmented
              name="debt-kind"
              legend="Kind"
              options={[
                { value: "loan", label: "Loan or money owed" },
                { value: "card", label: "Credit card" },
              ]}
              value={kind}
              onChange={setKind}
            />
          </div>
        )}
        {sheetOpen && showCard && (
          <CardForm
            key={editingCard?.id ?? "add-card"}
            schedule={schedule}
            today={today}
            card={editingCard}
            onSave={(input) => (editingCard ? updateCard(editingCard.id, input) : addCard(input))}
            onClosedChange={editingCard ? (closed) => setDebtPaidOff(editingCard.id, closed) : undefined}
            onDeleteRequest={editingCard ? deleteHref(editingCard.id) : undefined}
            onDone={close}
          />
        )}
        {sheetOpen && !showCard && (
          <DebtForm
            // A fresh form per debt, so its fields start from that debt.
            key={editing?.id ?? "add"}
            schedule={schedule}
            today={today}
            paidSoFar={editing?.paid ?? 0}
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
      {deletingCard && <DeleteDebtDialog key={deletingCard.id} debt={deletingCard} card onClose={close} />}
    </>
  );
}

// "Delete SPayLater?" (delete-pattern.md level 2, "Debt"). The spec's two
// choices are kept apart so the red button only ever deletes: "Mark it paid
// off" is offered here as a link (and in Edit), like Income's "End it instead".
// A card (8b-2) says "Close card" instead of "Mark it paid off". A card with
// purchases or payments can't be deleted at all: the action says so, and
// Close card is right there.
function DeleteDebtDialog({
  debt,
  card = false,
  onClose,
}: {
  debt: { id: string; name: string; left: number; paid_off_at: string | null };
  card?: boolean;
  onClose: () => void;
}) {
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
            It still has <strong>{formatPeso(debt.left)}</strong> {card ? "owed on it" : "left"}. It disappears from your
            debts.
          </>
        ) : (
          "It disappears from your debts."
        )
      }
      confirmLabel={card ? "Delete card" : "Delete debt"}
      onConfirm={() => run(() => deleteDebt(debt.id))}
      pending={pending}
      error={error}
    >
      {card ? (
        <p className="text-sm text-text-2">Only a card with no purchases or payments can be deleted.</p>
      ) : (
        <p className="text-sm text-text-2">Past payments stay in Activity for your records.</p>
      )}
      {debt.paid_off_at == null && card && (
        <p className="text-sm text-text-2">
          Done with it?{" "}
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => setDebtPaidOff(debt.id, true))}
            className="font-extrabold text-link outline-link hover:text-link-hover focus-visible:outline-2"
          >
            Close card
          </button>{" "}
          instead, to keep its history.
        </p>
      )}
      {debt.paid_off_at == null && !card && (
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
