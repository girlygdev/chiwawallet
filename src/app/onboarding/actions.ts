"use server";

import { redirect } from "next/navigation";
import { getCurrentBudget } from "@/lib/current-budget";
import { isOnboarded, ONBOARDING_PATHS } from "@/lib/onboarding";
import { getPeriod, scheduleFromBudget, todayInManila } from "@/lib/periods";
import { requireConsentedUser } from "@/lib/require-app-user";
import { createClient } from "@/lib/supabase/server";
import { type BudgetInput, budgetSchema, toBudgetRow } from "@/lib/validation/budget";
import {
  type IncomeFormInput,
  type IncomeValues,
  incomeSchemaFor,
} from "@/lib/validation/income";
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
  let movedIncome = 0;

  if (existing) {
    const { error } = await supabase.from("budgets").update(row).eq("id", existing.id);
    if (error) return logAndFail("update budget", error);

    // Moving away from twice a month leaves no "payday 2", so income that
    // landed on one payday now lands on every payday (decided Nov 19).
    // Step 2 shows a note about it.
    if (row.frequency !== "semi_monthly") {
      const { data: moved, error: incomeError } = await supabase
        .from("income_sources")
        .update({ pay_slot: "every" })
        .eq("budget_id", existing.id)
        .in("pay_slot", ["payday_1", "payday_2"])
        .select("id");
      if (incomeError) return logAndFail("reset income pay slots", incomeError);
      movedIncome = moved.length;
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

  // ?moved=N tells step 2 to show the "moved to Every payday" note.
  redirect(movedIncome > 0 ? `${ONBOARDING_PATHS.income}?moved=${movedIncome}` : ONBOARDING_PATHS.income);
}

export type IncomeResult = FormResult<IncomeFormInput> & { ok?: true };

/**
 * Step 2: the budget the income belongs to, while setup isn't finished.
 * Redirects to the right place otherwise.
 */
async function onboardingBudget() {
  await requireConsentedUser();
  const budget = await getCurrentBudget();
  if (!budget) redirect(ONBOARDING_PATHS.budget);
  if (isOnboarded(budget)) redirect("/dashboard");
  return budget;
}

/** Step 2: adds an income source. Starts at the current period (plan review 3.3). */
export async function addIncome(input: IncomeFormInput): Promise<IncomeResult> {
  const budget = await onboardingBudget();
  const parsed = incomeSchemaFor(budget.frequency).safeParse(input);
  if (!parsed.success) return { fieldErrors: toFieldErrors<IncomeFormInput>(parsed.error.issues) };

  const today = todayInManila(new Date());
  const supabase = await createClient();
  const { error } = await supabase.from("income_sources").insert({
    budget_id: budget.id,
    ...toIncomeRow(parsed.data),
    start_date: getPeriod(today, scheduleFromBudget(budget)).start,
  });
  if (error) return logAndFail("add income", error);
  return { ok: true };
}

/** Step 2: changes an income source. RLS limits it to the user's own rows. */
export async function updateIncome(id: string, input: IncomeFormInput): Promise<IncomeResult> {
  const budget = await onboardingBudget();
  const parsed = incomeSchemaFor(budget.frequency).safeParse(input);
  if (!parsed.success) return { fieldErrors: toFieldErrors<IncomeFormInput>(parsed.error.issues) };

  const supabase = await createClient();
  const { error } = await supabase
    .from("income_sources")
    .update(toIncomeRow(parsed.data))
    .eq("id", id)
    .eq("budget_id", budget.id);
  if (error) return logAndFail("update income", error);
  return { ok: true };
}

/**
 * Step 2: removes an income source. A plain delete is fine here: during setup
 * nothing has been logged against it yet (the Income screen's delete in 2e
 * follows the level 2 delete pattern).
 */
export async function removeIncome(id: string): Promise<IncomeResult> {
  const budget = await onboardingBudget();
  const supabase = await createClient();
  const { error } = await supabase.from("income_sources").delete().eq("id", id).eq("budget_id", budget.id);
  if (error) return logAndFail("remove income", error);
  return { ok: true };
}

function toIncomeRow(values: IncomeValues) {
  return {
    name: values.name,
    amount: values.amount,
    amount_varies: values.amountVaries,
    pay_slot: values.paySlot,
  };
}

function logAndFail(what: string, error: { code?: string; message: string }) {
  console.error(`onboarding: couldn't ${what}`, error.code, error.message);
  return { formError: SOMETHING_WRONG };
}
