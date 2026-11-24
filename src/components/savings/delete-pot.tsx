"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deletePot } from "@/app/(app)/savings/actions";
import { FieldShell, inputClassName } from "@/components/auth/text-field";
import { ConfirmDelete } from "@/components/confirm-delete";
import { CategoryIconTile } from "@/components/transactions/category-grid";
import { formatPeso } from "@/lib/money";
import { balanceAfterMove } from "@/lib/pots";
import { cn } from "@/lib/utils";

type Destination = { id: string; name: string; balance: number; target_amount: number | null };

const CARD = cn(
  "flex cursor-pointer items-start gap-3 rounded-[14px] border-[1.5px] border-line bg-surface px-3.5 py-3",
  "has-checked:border-2 has-checked:border-green-600 has-checked:bg-mint",
  "has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-link",
);

/**
 * The pot details' "Delete pot" link and its level 2 dialog (delete-pattern.md
 * §4): with money in the pot, choose "Move it to [pot]" or "Count it as
 * withdrawn". A locked pot only offers withdrawing, after confirming the
 * money really left it. No undo: the choice is the safety net.
 */
export function DeletePot({
  pot,
  balance,
  destinations,
}: {
  pot: { id: string; name: string; icon: string; color: string; is_locked: boolean };
  balance: number;
  /** The user's other pots, with their balances. */
  destinations: Destination[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const hasMoney = balance > 0;
  const canMove = hasMoney && !pot.is_locked && destinations.length > 0;
  const [choice, setChoice] = useState<"move" | "withdraw">(canMove ? "move" : "withdraw");
  const [moveTo, setMoveTo] = useState(destinations[0]?.id ?? "");
  const [reallyLeft, setReallyLeft] = useState(false);
  const [choiceError, setChoiceError] = useState<string>();
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const destination = destinations.find((d) => d.id === moveTo);

  const confirm = () => {
    setError(undefined);
    setChoiceError(undefined);
    if (hasMoney && pot.is_locked && !reallyLeft) {
      return setChoiceError("Tick the box if the money really left this pot. Otherwise, keep it.");
    }
    startTransition(async () => {
      const result = await deletePot(pot.id, hasMoney ? choice : null, choice === "move" ? moveTo : null);
      if (result.choiceError) return setChoiceError(result.choiceError);
      if (result.formError) return setError(result.formError);
      router.push("/savings");
      router.refresh();
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="h-11 self-start rounded-md px-3 text-[15px] font-extrabold text-danger outline-link focus-visible:outline-2"
      >
        Delete pot
      </button>

      <ConfirmDelete
        open={open}
        onOpenChange={(next) => !pending && setOpen(next)}
        title={`Delete ${pot.name}?`}
        description={
          hasMoney ? (
            <>
              It still has <strong>{formatPeso(balance)}</strong>.
            </>
          ) : (
            "It's empty, so no money moves."
          )
        }
        confirmLabel={`Delete ${pot.name}`}
        onConfirm={confirm}
        pending={pending}
        error={error}
      >
        {/* The item itself (delete-pattern.md §2.2). */}
        <div className="flex items-center gap-3 rounded-[14px] bg-bg px-4 py-3">
          <CategoryIconTile icon={pot.icon} color={pot.color} size="md" />
          <p className="min-w-0 flex-1 truncate font-extrabold">{pot.name}</p>
          <p className="shrink-0 font-display text-lg font-semibold">{formatPeso(balance)}</p>
        </div>

        {hasMoney && (
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-sm font-bold text-ink">What should happen to the {formatPeso(balance)}?</legend>

            {canMove && (
              <label className={CARD}>
                <input
                  type="radio"
                  name="pot-delete-choice"
                  value="move"
                  checked={choice === "move"}
                  onChange={() => setChoice("move")}
                  className="mt-1 size-4 accent-green-600"
                />
                <span className="flex min-w-0 flex-1 flex-col gap-2">
                  <span className="font-extrabold text-ink">Move it to another pot</span>
                  {choice === "move" && (
                    <>
                      {destinations.length > 1 && (
                        <FieldShell id="move-pot" label="Pot">
                          {(describedBy) => (
                            <select
                              id="move-pot"
                              value={moveTo}
                              onChange={(e) => setMoveTo(e.target.value)}
                              aria-describedby={describedBy}
                              className={cn(inputClassName, "h-11 appearance-auto")}
                            >
                              {destinations.map((d) => (
                                <option key={d.id} value={d.id}>
                                  {d.name}
                                </option>
                              ))}
                            </select>
                          )}
                        </FieldShell>
                      )}
                      {destination && (
                        <span className="text-[13px] text-text-2">
                          {destination.name} becomes{" "}
                          <strong>{formatPeso(balanceAfterMove(destination.balance, balance))}</strong>
                          {destination.target_amount != null && ` of ${formatPeso(destination.target_amount)}`}.
                        </span>
                      )}
                    </>
                  )}
                </span>
              </label>
            )}

            <label className={CARD}>
              <input
                type="radio"
                name="pot-delete-choice"
                value="withdraw"
                checked={choice === "withdraw"}
                onChange={() => setChoice("withdraw")}
                className="mt-1 size-4 accent-green-600"
              />
              <span className="flex flex-col gap-0.5">
                <span className="font-extrabold text-ink">Count it as withdrawn</span>
                <span className="text-[13px] text-text-2">Adds {formatPeso(balance)} to this period&apos;s money.</span>
              </span>
            </label>

            {/* Locked pots: deposits only, so withdrawing needs a real reason. */}
            {pot.is_locked && (
              <label className="flex items-start gap-2.5 rounded-[12px] bg-warn-bg px-3 py-2.5 text-sm text-warn-fg">
                <input
                  type="checkbox"
                  checked={reallyLeft}
                  onChange={(e) => setReallyLeft(e.target.checked)}
                  className="mt-0.5 size-4 accent-green-600"
                />
                <span>
                  <strong>This pot is locked.</strong> Only delete it if the money really left, like a matured MP2 or time
                  deposit. Otherwise, keep it.
                </span>
              </label>
            )}
            {choiceError && <p className="text-[13px] font-bold text-bad-fg">{choiceError}</p>}
          </fieldset>
        )}

        <p className="text-sm text-text-2">Past deposits stay in Activity for your records.</p>
      </ConfirmDelete>
    </>
  );
}
