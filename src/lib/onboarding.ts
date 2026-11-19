import { formatShortDate } from "@/lib/periods";

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

/**
 * The "Your first period" card (onboarding.md §5–6). If the period's pay has
 * already arrived, it's inside the starting balance, so it isn't added again
 * (plan review 3.14). Centavos in and out.
 */
export function firstPeriodSummary({
  openingBalance,
  expectedIncome,
  payReceived,
}: {
  openingBalance: number | null;
  expectedIncome: number;
  payReceived: boolean | null;
}) {
  const incomeStillExpected = payReceived ? 0 : expectedIncome;
  return { incomeStillExpected, readyToPlan: (openingBalance ?? 0) + incomeStillExpected };
}

/** "Starts today" on payday, otherwise "Started Nov 15" (onboarding.md fix #1). */
export function periodTag(periodStart: string, today: string): string {
  return periodStart === today ? "Starts today" : `Started ${formatShortDate(periodStart)}`;
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
