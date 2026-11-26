import { formatPeso } from "@/lib/money";
import { describeSchedule, type PaySchedule } from "@/lib/periods";

export type ChecklistKey = "budget" | "pay" | "bills" | "pot" | "expense";

export type ChecklistStep = { key: ChecklistKey; title: string; detail: string | null; done: boolean };

/** What the steps are worked out from; the Dashboard counts the rows. */
export type ChecklistState = {
  schedule: PaySchedule;
  /** The first income source, for "₱25,000 from Main job"; none if there isn't one. */
  firstIncome: { name: string; amount: number } | null;
  hasIncome: boolean;
  hasBills: boolean;
  /** potStarted(): a pot with money in it or a target, not just the starter pots. */
  hasPots: boolean;
  hasExpense: boolean;
};

/**
 * Create a savings pot's tick (owner, Nov 26). Every account starts with
 * two empty pots (Emergency Fund, Sinking Funds, made at sign-up), so having
 * a pot isn't enough: one needs money in it or a target.
 */
export function potStarted(pots: { balance: number; target: number | null }[]): boolean {
  return pots.some((p) => p.balance > 0 || p.target != null);
}

/**
 * The Dashboard's Get started card (dashboard.md §4, 7d-1): five steps in
 * order, each done or not, and "1 of 5 done". Setting up the budget is
 * always done (onboarding did it). The card is gone once `complete`.
 */
export function checklistSteps(state: ChecklistState): {
  steps: ChecklistStep[];
  done: number;
  total: number;
  share: number;
  complete: boolean;
} {
  const pay = state.firstIncome ? `${formatPeso(state.firstIncome.amount)} from ${state.firstIncome.name}` : null;
  const steps: ChecklistStep[] = [
    { key: "budget", title: "Set up your budget", detail: describeSchedule(state.schedule), done: true },
    { key: "pay", title: "Confirm today's pay", detail: pay, done: state.hasIncome },
    { key: "bills", title: "Add your bills", detail: null, done: state.hasBills },
    { key: "pot", title: "Create a savings pot", detail: "Start with an emergency fund", done: state.hasPots },
    { key: "expense", title: "Log your first expense", detail: "Takes about 10 seconds", done: state.hasExpense },
  ];
  const done = steps.filter((s) => s.done).length;
  return { steps, done, total: steps.length, share: done / steps.length, complete: done === steps.length };
}
