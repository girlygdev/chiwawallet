import { z } from "zod";

// Onboarding step 1 "Your budget" (onboarding.md §3). Shared by the form
// (browser) and its Server Action (server). The database checks the same
// payday rules (budgets_paydays_match_frequency), so bad data can't get in
// even if this were skipped.

export const FREQUENCIES = ["weekly", "semi_monthly", "monthly"] as const;
export type Frequency = (typeof FREQUENCIES)[number];

const day = z.number().int().min(1).max(31).nullable();

export const budgetSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, "Give your budget a name.")
      .max(40, "Keep it to 40 characters or fewer."),
    frequency: z.enum(FREQUENCIES, { error: "Pick how often you get paid." }),
    // The form keeps all three payday fields while you switch frequency, so
    // switching back doesn't lose your choice. Only the ones the frequency
    // uses are checked and saved (toBudgetRow).
    payDay1: day,
    payDay2: day,
    // 0 = Sunday … 6 = Saturday.
    payWeekday: z.number().int().min(0).max(6).nullable(),
    weekStart: z.enum(["monday", "sunday"]),
  })
  .superRefine((value, ctx) => {
    const problem = (path: "payDay1" | "payDay2" | "payWeekday", message: string) =>
      ctx.addIssue({ code: "custom", path: [path], message });

    if (value.frequency === "semi_monthly") {
      if (value.payDay1 == null) problem("payDay1", "Pick your 1st payday.");
      // Matches getPeriod(): February has 28 days, so a later 1st payday
      // could fall on the same day as the 2nd.
      else if (value.payDay1 > 27) problem("payDay1", "Pick the 27th or earlier for your 1st payday.");
      if (value.payDay2 == null) problem("payDay2", "Pick your 2nd payday.");
      else if (value.payDay1 != null && value.payDay2 <= value.payDay1) {
        problem("payDay2", "Pick a 2nd payday after the 1st.");
      }
    }
    if (value.frequency === "monthly" && value.payDay1 == null) {
      problem("payDay1", "Pick your payday.");
    }
    if (value.frequency === "weekly" && value.payWeekday == null) {
      problem("payWeekday", "Pick your payday.");
    }
  });

export type BudgetInput = z.infer<typeof budgetSchema>;

/** The `budgets` columns to save, with unused payday fields cleared. */
export function toBudgetRow(input: BudgetInput) {
  return {
    name: input.name,
    frequency: input.frequency,
    pay_day_1: input.frequency === "weekly" ? null : input.payDay1,
    pay_day_2: input.frequency === "semi_monthly" ? input.payDay2 : null,
    pay_weekday: input.frequency === "weekly" ? input.payWeekday : null,
  };
}
