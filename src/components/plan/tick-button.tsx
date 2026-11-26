"use client";

import { Check, LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deleteTransaction, restoreTransaction } from "@/app/(app)/activity/actions";
import { markPaid, unmarkPaid } from "@/app/(app)/plan/actions";
import { useShowToast } from "@/app/(app)/plan/plan-item-sheet";
import { SubmitButton } from "@/components/auth/submit-button";
import { MoneyInput } from "@/components/money-input";
import { Sheet } from "@/components/sheet";
import { formatPeso, formatPesoInput, parsePesoInput } from "@/lib/money";
import { cn } from "@/lib/utils";

export type TickItem = {
  id: string;
  name: string;
  planned_amount: number;
  paid: boolean;
  /** A pot: "Mark Travel added", "Added ₱2,000 to Travel". */
  pot: boolean;
  /** A bill whose amount changes: ask for the real amount first. */
  varies: boolean;
};

// A tick row's circle (plan.md §3 "Tick row", task 6b-1). Unpaid: a white
// circle with a dashed ring; paid: solid green with a tick. When the period
// can be paid (`canTick`), it's a button:
// - unpaid → Mark paid (a variable bill asks for the amount first), then
//   "Meralco paid · Undo"
// - paid → un-tick (deletes the payment), then "Meralco is due again · Undo"
// Otherwise it's only a picture, hidden from screen readers.
export function TickButton({ item, canTick }: { item: TickItem; canTick: boolean }) {
  const router = useRouter();
  const showToast = useShowToast();
  const [pending, startTransition] = useTransition();
  const [asking, setAsking] = useState(false);

  const circle = (
    <span
      aria-hidden
      className={cn(
        "flex size-7 shrink-0 items-center justify-center rounded-full",
        item.paid ? "bg-green-500 text-white" : "border-2 border-line-dash bg-surface",
      )}
    >
      {pending ? (
        <LoaderCircle size={16} className="animate-spin text-text-3" />
      ) : (
        item.paid && <Check size={16} strokeWidth={3} />
      )}
    </span>
  );
  if (!canTick) return circle;

  const toast = (text: string, undo?: () => Promise<{ ok?: true; formError?: string }>) =>
    showToast({
      id: Date.now(),
      text,
      ...(undo && {
        action: {
          label: "Undo",
          onClick: async () => {
            const result = await undo();
            router.refresh();
            if (!result.ok) showToast({ id: Date.now(), text: result.formError ?? "Couldn't undo." });
          },
        },
      }),
    });

  const pay = (amountText?: string) =>
    new Promise<string | undefined>((resolve) =>
      startTransition(async () => {
        const result = await markPaid(item.id, amountText);
        if (!result.saved) return resolve(result.formError ?? "Couldn't mark it paid.");
        const { transactionId, amount } = result.saved;
        router.refresh();
        setAsking(false);
        // Undo deletes the payment; the 6a trigger un-ticks the item.
        toast(item.pot ? `Added ${formatPeso(amount)} to ${item.name}` : `${item.name} paid`, () => deleteTransaction(transactionId));
        resolve(undefined);
      }),
    );

  const unpay = () =>
    startTransition(async () => {
      const result = await unmarkPaid(item.id);
      if (!result.transactionId) return toast(result.formError ?? "Couldn't change it.");
      router.refresh();
      const transactionId = result.transactionId;
      // Undo restores the same payment, which ticks the item again.
      toast(`${item.name} is due again`, () => restoreTransaction(transactionId));
    });

  const label = item.paid
    ? `Mark ${item.name} not paid`
    : item.pot
      ? `Mark ${item.name} added`
      : `Mark ${item.name} paid`;

  return (
    <>
      <button
        type="button"
        aria-label={label}
        aria-pressed={item.paid}
        disabled={pending}
        onClick={() => {
          if (item.paid) unpay();
          else if (item.varies) setAsking(true);
          else void pay().then((error) => error && toast(error));
        }}
        // A 44px tap target around the 28px circle.
        className="-m-2 flex size-11 shrink-0 items-center justify-center rounded-full outline-link focus-visible:outline-2"
      >
        {circle}
      </button>
      {item.varies && (
        <Sheet
          open={asking}
          onOpenChange={(next) => !pending && setAsking(next)}
          title={`How much was ${item.name}?`}
          description="It changes each month. Enter what you actually paid."
        >
          {asking && <AmountForm item={item} pending={pending} onPay={pay} />}
        </Sheet>
      )}
    </>
  );
}

// A variable bill's real amount (bills.md §4: "Mark paid asks for the real
// amount"), filled in with the estimate, with its effect in pesos.
function AmountForm({
  item,
  pending,
  onPay,
}: {
  item: TickItem;
  pending: boolean;
  onPay: (amountText: string) => Promise<string | undefined>;
}) {
  const [text, setText] = useState(formatPesoInput(item.planned_amount));
  const [error, setError] = useState<string>();
  const centavos = parsePesoInput(text);

  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setError(undefined);
        if (centavos == null || centavos <= 0) return setError("Enter an amount above ₱0.");
        setError(await onPay(text));
      }}
    >
      <MoneyInput id={`paid-${item.id}`} label="Amount paid" value={text} onChange={(e) => setText(e.target.value)} error={error} />
      <p aria-live="polite" className="rounded-[14px] bg-mint px-4 py-3 text-sm font-bold text-link-hover">
        {centavos != null && centavos > 0
          ? `Pays ${formatPeso(centavos)} (planned ${formatPeso(item.planned_amount)}).`
          : `Planned ${formatPeso(item.planned_amount)}.`}
      </p>
      <SubmitButton
        pending={pending}
        pendingLabel="Saving…"
        className="h-14 border-2 border-sticker bg-green-500 text-white shadow-sticker-sm hover:bg-green-500/90 aria-busy:bg-green-500 aria-busy:text-white"
      >
        Mark paid
      </SubmitButton>
    </form>
  );
}
