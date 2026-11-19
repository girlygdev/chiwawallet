"use server";

import { requireAppUser } from "@/lib/require-app-user";
import { createClient } from "@/lib/supabase/server";
import { SOMETHING_WRONG, toFieldErrors } from "@/lib/validation/field-errors";
import { type IncomeFormInput, type IncomeValues, incomeSchemaFor } from "@/lib/validation/income";

type Result = {
  ok?: true;
  formError?: string;
  fieldErrors?: Partial<Record<keyof IncomeFormInput, string>>;
};

// The Income screen's add and edit (income.md §4). Unlike onboarding, the user
// picks "Starts" and may set "Ends". RLS limits every query to the user's own
// rows; the budget_id filter keeps edits inside the current budget.

export async function addIncomeSource(input: IncomeFormInput): Promise<Result> {
  const { budget } = await requireAppUser();
  const parsed = incomeSchemaFor(budget.frequency, { requireStartDate: true }).safeParse(input);
  if (!parsed.success) return { fieldErrors: toFieldErrors<IncomeFormInput>(parsed.error.issues) };

  const supabase = await createClient();
  const { error } = await supabase.from("income_sources").insert({ budget_id: budget.id, ...toRow(parsed.data) });
  if (error) return fail("add income source", error);
  return { ok: true };
}

export async function updateIncomeSource(id: string, input: IncomeFormInput): Promise<Result> {
  const { budget } = await requireAppUser();
  const parsed = incomeSchemaFor(budget.frequency, { requireStartDate: true }).safeParse(input);
  if (!parsed.success) return { fieldErrors: toFieldErrors<IncomeFormInput>(parsed.error.issues) };

  const supabase = await createClient();
  const { error } = await supabase
    .from("income_sources")
    .update(toRow(parsed.data))
    .eq("id", id)
    .eq("budget_id", budget.id);
  if (error) return fail("update income source", error);
  return { ok: true };
}

/**
 * Deletes an income source (delete-pattern.md level 2). Nothing points at
 * income sources until transactions arrive in Week 3, so there's no choice
 * to make yet; Week 3 adds "past income stays in Activity" (plan review 3.6).
 */
export async function deleteIncomeSource(id: string): Promise<Result> {
  const { budget } = await requireAppUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("income_sources")
    .delete()
    .eq("id", id)
    .eq("budget_id", budget.id)
    .select("id");
  if (error) return fail("delete income source", error);
  // Nothing deleted: already gone, or not this user's (RLS hides it).
  if (data.length === 0) return { formError: "That income source no longer exists. Refresh the page." };
  return { ok: true };
}

function toRow(values: IncomeValues) {
  return {
    name: values.name,
    amount: values.amount,
    amount_varies: values.amountVaries,
    pay_slot: values.paySlot,
    // requireStartDate guarantees it's set.
    start_date: values.startDate!,
    end_date: values.endDate,
  };
}

function fail(what: string, error: { code?: string; message: string }): Result {
  console.error(`income: couldn't ${what}`, error.code, error.message);
  return { formError: SOMETHING_WRONG };
}
