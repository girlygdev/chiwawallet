"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { BillForm, type EditableBill } from "@/components/bills/bill-form";
import { ConfirmDelete } from "@/components/confirm-delete";
import { Sheet } from "@/components/sheet";
import { billScheduleLine, billTotalsChange } from "@/lib/bills";
import { formatPeso } from "@/lib/money";
import { upcomingLine } from "@/lib/plan";
import type { PaySchedule } from "@/lib/periods";
import { addBill, deleteBill, updateBill } from "./actions";

// New / Edit bill and the Delete dialog, following the page address like
// Income, so the + button and each bill row can be plain links:
//   /bills?add=1          New bill
//   /bills?edit=<id>      Edit bill
//   /bills?delete=<id>    Delete bill?
// Closing clears the address.
export function BillSheet({
  bills,
  upcoming,
  categories,
  defaultCategoryId,
  schedule,
  today,
}: {
  bills: EditableBill[];
  /** Each bill's unpaid plan items in periods that haven't ended (5h-3). */
  upcoming: Record<string, number>;
  categories: { id: string; name: string }[];
  defaultCategoryId: string;
  schedule: PaySchedule;
  today: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const find = (key: string) => bills.find((b) => b.id === params.get(key));
  const editing = find("edit");
  const deleting = find("delete");
  const adding = params.get("add") != null;
  const sheetOpen = adding || editing != null;
  const close = () => router.replace(pathname, { scroll: false });
  const others = (except?: EditableBill) => bills.filter((b) => b.id !== except?.id);

  return (
    <>
      <Sheet
        open={sheetOpen}
        onOpenChange={(next) => !next && close()}
        title={editing ? "Edit bill" : "New bill"}
        description="A bill that repeats, like utilities, rent or subscriptions."
      >
        {sheetOpen && (
          <BillForm
            // A fresh form per bill, so its fields start from that bill.
            key={editing?.id ?? "add"}
            schedule={schedule}
            categories={categories}
            defaultCategoryId={defaultCategoryId}
            bill={editing}
            otherBills={others(editing)}
            onSave={(input) => (editing ? updateBill(editing.id, input) : addBill(input))}
            onDeleteRequest={
              editing ? () => router.replace(`${pathname}?delete=${editing.id}`, { scroll: false }) : undefined
            }
            onDone={close}
          />
        )}
      </Sheet>

      {deleting && (
        <DeleteBillDialog
          key={deleting.id}
          bill={deleting}
          all={bills}
          upcoming={upcoming[deleting.id] ?? 0}
          schedule={schedule}
          today={today}
          onClose={close}
        />
      )}
    </>
  );
}

// "Delete Meralco?" (delete-pattern.md level 2, "Bill"): no choice needed,
// just say what happens. Keep it is focused first; there's no undo.
function DeleteBillDialog({
  bill,
  all,
  upcoming,
  schedule,
  today,
  onClose,
}: {
  bill: EditableBill;
  all: EditableBill[];
  /** "Planned in N upcoming paydays" (delete-pattern.md §4). */
  upcoming: number;
  schedule: PaySchedule;
  today: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const effects = billTotalsChange(
    all,
    all.filter((b) => b.id !== bill.id),
    schedule,
  ).filter((line) => line.before !== line.after);

  const confirm = () => {
    setError(undefined);
    startTransition(async () => {
      const result = await deleteBill(bill.id);
      if (result.formError) return setError(result.formError);
      router.refresh();
      onClose();
    });
  };

  return (
    <ConfirmDelete
      open
      onOpenChange={(next) => !next && !pending && onClose()}
      title={`Delete ${bill.name}?`}
      description="It disappears from your bills. Past payments stay in Activity."
      confirmLabel="Delete bill"
      onConfirm={confirm}
      pending={pending}
      error={error}
    >
      {/* The item itself (delete-pattern.md §2.2). */}
      <div className="flex items-center justify-between gap-3 rounded-[14px] bg-bg px-4 py-3">
        <div className="min-w-0">
          <p className="truncate font-extrabold">{bill.name}</p>
          <p className="text-[13px] text-text-3">{billScheduleLine(bill, today)}</p>
        </div>
        <p className="shrink-0 font-display text-lg font-semibold">{formatPeso(bill.amount)}</p>
      </div>

      {/* The effect in pesos (§2.3). */}
      <ul className="flex flex-col gap-1 text-sm">
        {effects.map((line) => (
          <li key={line.slot}>
            <span className="font-bold">{line.label}:</span> {formatPeso(line.before)} →{" "}
            <span className="font-extrabold">{formatPeso(line.after)}</span>
          </li>
        ))}
        {upcomingLine(upcoming) && <li>{upcomingLine(upcoming)}</li>}
      </ul>
    </ConfirmDelete>
  );
}
