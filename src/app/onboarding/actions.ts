"use server";

import { redirect } from "next/navigation";
import { getCurrentBudget } from "@/lib/current-budget";
import { isOnboarded, ONBOARDING_PATHS } from "@/lib/onboarding";
import { requireConsentedUser } from "@/lib/require-app-user";
import { createClient } from "@/lib/supabase/server";
import { type BudgetInput, budgetSchema, toBudgetRow } from "@/lib/validation/budget";
import {
  type FormResult,
  SOMETHING_WRONG,
  toFieldErrors,
} from "@/lib/validation/field-errors";

/**
 * Step 1 "Your budget": creates the budget, or updates it when the user came
 * back with Back. Also saves "Week starts on" to the profile. Redirects to
 * step 2 on success.
 */
export async function saveBudget(input: BudgetInput): Promise<FormResult<BudgetInput>> {
  // Never trust the browser's checks: validate again on the server.
  const parsed = budgetSchema.safeParse(input);
  if (!parsed.success) return { fieldErrors: toFieldErrors<BudgetInput>(parsed.error.issues) };

  const { user } = await requireConsentedUser();
  const existing = await getCurrentBudget();
  // Finished setup: budget changes belong in Settings, not here.
  if (isOnboarded(existing)) redirect("/dashboard");

  const supabase = await createClient();
  const row = toBudgetRow(parsed.data);

  if (existing) {
    const { error } = await supabase.from("budgets").update(row).eq("id", existing.id);
    if (error) return logAndFail("update budget", error);

    // Moving away from twice a month leaves no "payday 2", so income that
    // landed on one payday now lands on every payday (decided Nov 19).
    // Step 2 shows a note about it.
    if (row.frequency !== "semi_monthly") {
      const { error: incomeError } = await supabase
        .from("income_sources")
        .update({ pay_slot: "every" })
        .eq("budget_id", existing.id)
        .in("pay_slot", ["payday_1", "payday_2"]);
      if (incomeError) return logAndFail("reset income pay slots", incomeError);
    }
  } else {
    // user_id defaults to the logged-in user in the database.
    const { error } = await supabase.from("budgets").insert(row);
    if (error) return logAndFail("create budget", error);
  }

  const { error: profileError } = await supabase
    .from("profiles")
    .update({ week_start: parsed.data.weekStart })
    .eq("user_id", user.id);
  if (profileError) return logAndFail("save week start", profileError);

  redirect(ONBOARDING_PATHS.income);
}

function logAndFail(what: string, error: { code?: string; message: string }) {
  console.error(`onboarding: couldn't ${what}`, error.code, error.message);
  return { formError: SOMETHING_WRONG };
}
