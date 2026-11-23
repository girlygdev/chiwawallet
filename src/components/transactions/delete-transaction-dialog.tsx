"use client";

import { useState, useTransition } from "react";
import { deleteTransaction } from "@/app/(app)/activity/actions";
import { ConfirmDelete } from "@/components/confirm-delete";
import { formatPeso } from "@/lib/money";
import { CategoryIconTile } from "./category-grid";

/** What the delete dialog shows: the item and its effect, worked out by the caller. */
export type DeleteTarget = {
  id: string;
  /** "Lunch" */
  name: string;
  /** "Food · Nov 23" */
  detail: string;
  /** Signed for display: −₱180, +₱25,000. */
  signedAmount: number;
  icon: string;
  color: string;
  /** From editImpact(rows, row, 0). */
  impact: { line: "in" | "out" | "savings"; before: number; after: number };
  /** "this period", or "Nov 1 – 14" for an older one. */
  periodLabel: string;
};

const LINE_LABELS = { in: "Money in", out: "Money out", savings: "To savings" } as const;

// "Delete this transaction?" (delete-pattern.md §3, level 1): the item card,
// its effect in pesos, then Delete transaction or Keep it. Deleting is a soft
// delete, and the toast that follows has Undo. Not yet: "Food budget left"
// (needs Plan budgets, Week 5).
export function DeleteTransactionDialog({
  target,
  onClose,
  onDeleted,
}: {
  target: DeleteTarget;
  onClose: () => void;
  onDeleted: (target: DeleteTarget) => void;
}) {
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  const confirm = () => {
    setError(undefined);
    startTransition(async () => {
      const result = await deleteTransaction(target.id);
      if (result.formError) return setError(result.formError);
      onDeleted(target);
    });
  };

  const { line, before, after } = target.impact;
  const where = target.periodLabel === "this period" ? "this period" : `in ${target.periodLabel}`;

  return (
    <ConfirmDelete
      open
      onOpenChange={(next) => !next && !pending && onClose()}
      title="Delete this transaction?"
      description="You can undo this for a few seconds after."
      confirmLabel="Delete transaction"
      onConfirm={confirm}
      pending={pending}
      error={error}
    >
      {/* The item itself (delete-pattern.md §3). */}
      <div className="flex items-center gap-3 rounded-[14px] bg-bg px-4 py-3">
        <CategoryIconTile icon={target.icon} color={target.color} size="md" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-extrabold">{target.name}</p>
          <p className="truncate text-[13px] text-text-3">{target.detail}</p>
        </div>
        <p className="shrink-0 font-display text-lg font-semibold">{formatPeso(target.signedAmount, { signed: true })}</p>
      </div>

      {/* The effect in pesos. */}
      <p className="text-sm">
        <span className="font-bold">
          {LINE_LABELS[line]} {where}:
        </span>{" "}
        {formatPeso(before)} → <span className="font-extrabold">{formatPeso(after)}</span>
      </p>
    </ConfirmDelete>
  );
}
