// Where a user is in first-time setup (onboarding.md §1). Each step saves on
// Continue, and the opening balance is saved last, so these fields alone say
// which step is unfinished. No separate "onboarded" column is needed.

export type OnboardingStep = "budget" | "income" | "start";

export const ONBOARDING_PATHS: Record<OnboardingStep, string> = {
  budget: "/onboarding/budget",
  income: "/onboarding/income",
  start: "/onboarding/start",
};

type BudgetProgress = { opening_balance: number | null } | null;

/** Setup is finished once the budget has an opening balance (₱0 counts). */
export function isOnboarded(budget: BudgetProgress): boolean {
  return budget != null && budget.opening_balance != null;
}

/** The first unfinished step, or "done". */
export function nextOnboardingStep({
  budget,
  incomeCount,
}: {
  budget: BudgetProgress;
  incomeCount: number;
}): OnboardingStep | "done" {
  if (!budget) return "budget";
  if (isOnboarded(budget)) return "done";
  if (incomeCount === 0) return "income";
  return "start";
}
