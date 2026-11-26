"use client";

import { Check, ChevronRight, X } from "lucide-react";
import Link from "next/link";
import { type ReactNode, useId, useTransition } from "react";
import { dismissChecklist, undoDismissChecklist } from "@/app/(app)/dashboard/actions";
import { OpenAddSheetButton, useAppToast } from "@/components/transactions/add-transaction-provider";
import type { ChecklistKey, checklistSteps } from "@/lib/checklist";
import { cn } from "@/lib/utils";

const ROW = "flex min-h-14 w-full items-center gap-3 rounded-[14px] px-3 py-2 text-left outline-link hover:bg-bg focus-visible:outline-2";

// Get started (dashboard.md §4, 7d-1): "1 of 5 done", an 8px bar and the
// five steps as an <ol> of link rows. An undone step goes to its task (a
// sheet or an add page); a done one to where that thing lives. Dismiss hides
// it with an Undo toast. Shown until all five are done or it's dismissed.
export function GetStartedCard({
  list,
  payOptions,
}: {
  list: ReturnType<typeof checklistSteps>;
  /** Confirm today's pay opens Add income with the first source, like I got paid. */
  payOptions: { incomeSource: string; amount: number } | null;
}) {
  const titleId = useId();
  const toast = useAppToast();
  const [pending, start] = useTransition();

  const dismiss = () =>
    start(async () => {
      await dismissChecklist();
      toast({
        id: Date.now(),
        text: "Get started hidden",
        action: { label: "Undo", onClick: () => start(() => undoDismissChecklist()) },
      });
    });

  return (
    <section
      aria-labelledby={titleId}
      className="flex flex-col gap-3 rounded-xl border-2 border-sticker bg-surface p-5 shadow-sticker"
    >
      <div className="flex items-start gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <h2 id={titleId} className="font-display text-xl font-semibold text-ink">
            Get started
          </h2>
          <p className="hidden text-sm text-text-2 lg:block">A few minutes now makes every payday easier.</p>
        </div>
        <button
          type="button"
          onClick={dismiss}
          disabled={pending}
          aria-label="Dismiss Get started"
          className="-mt-2 -mr-2 flex size-11 shrink-0 items-center justify-center rounded-full text-text-3 outline-link hover:bg-bg focus-visible:outline-2"
        >
          <X aria-hidden size={20} />
        </button>
      </div>
      <div className="flex flex-col gap-1.5">
        <p className="text-sm font-extrabold text-ink">
          {list.done} of {list.total} done
        </p>
        {/* The line above says the same, so the bar is decorative. */}
        <span aria-hidden className="block h-2 overflow-hidden rounded-full bg-track">
          <span className="block h-full rounded-full bg-green-500" style={{ width: `${list.share * 100}%` }} />
        </span>
      </div>
      <ol className="flex flex-col">
        {list.steps.map((step) => (
          <li key={step.key}>
            <StepAction stepKey={step.key} done={step.done} payOptions={payOptions}>
              {step.done ? (
                <span aria-hidden className="flex size-7 shrink-0 items-center justify-center rounded-full bg-green-500 text-white">
                  <Check size={16} strokeWidth={3} />
                </span>
              ) : (
                <span aria-hidden className="size-7 shrink-0 rounded-full border-2 border-dashed border-line-dash" />
              )}
              <span className="flex min-w-0 flex-1 flex-col">
                <span className={cn("font-extrabold", step.done ? "text-text-3" : "text-ink")}>
                  {step.title}
                  <span className="sr-only">{step.done ? ", done" : ", not done yet"}</span>
                </span>
                {step.detail && <span className="truncate text-[13px] text-text-3">{step.detail}</span>}
              </span>
              <ChevronRight aria-hidden size={18} className="shrink-0 text-text-3" />
            </StepAction>
          </li>
        ))}
      </ol>
    </section>
  );
}

/** Where each step goes: undone → its task; done → where it lives. */
const DONE_HREF: Record<ChecklistKey, string> = {
  budget: "/settings",
  pay: "/activity",
  bills: "/bills",
  pot: "/savings",
  expense: "/activity",
};
// Create a savings pot goes to Savings, not the add sheet: the starter pots
// are already there, waiting for money or a target.
const TODO_HREF: Partial<Record<ChecklistKey, string>> = { budget: "/settings", bills: "/bills?add=1", pot: "/savings" };

function StepAction({
  stepKey,
  done,
  payOptions,
  children,
}: {
  stepKey: ChecklistKey;
  done: boolean;
  payOptions: { incomeSource: string; amount: number } | null;
  children: ReactNode;
}) {
  if (!done && stepKey === "pay") {
    return (
      <OpenAddSheetButton options={{ tab: "income", ...payOptions }} className={ROW}>
        {children}
      </OpenAddSheetButton>
    );
  }
  if (!done && stepKey === "expense") {
    return (
      <OpenAddSheetButton options={{ tab: "expense" }} className={ROW}>
        {children}
      </OpenAddSheetButton>
    );
  }
  return (
    <Link href={(done ? DONE_HREF[stepKey] : TODO_HREF[stepKey]) ?? DONE_HREF[stepKey]} className={ROW}>
      {children}
    </Link>
  );
}
