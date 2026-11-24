"use server";

import { z } from "zod";
import { requireAppUser } from "@/lib/require-app-user";
import { createClient } from "@/lib/supabase/server";
import { type DebtFormInput, type DebtValues, debtSchema } from "@/lib/validation/debt";
import { SOMETHING_WRONG, toFieldErrors } from "@/lib/validation/field-errors";

type Result = {
  ok?: true;
  formError?: string;
  fieldErrors?: Partial<Record<keyof DebtFormInput, string>>;
};

const GONE = "That debt no longer exists. Refresh the page.";

// New, Edit and Delete debt, and Mark as paid off (debts.md §4,
// delete-pattern.md "Debt"). Debts belong to the user, not a budget; RLS
// limits every query to the user's own rows.

export async function addDebt(input: DebtFormInput): Promise<Result> {
  await requireAppUser();
  const parsed = debtSchema.safeParse(input);
  if (!parsed.success) return { fieldErrors: toFieldErrors<DebtFormInput>(parsed.error.issues) };

  const supabase = await createClient();
  const { error } = await supabase.from("debts").insert(toRow(parsed.data));
  if (error) return fail("add debt", error);
  return { ok: true };
}

export async function updateDebt(id: string, input: DebtFormInput): Promise<Result> {
  await requireAppUser();
  if (!z.uuid().safeParse(id).success) return { formError: SOMETHING_WRONG };
  const parsed = debtSchema.safeParse(input);
  if (!parsed.success) return { fieldErrors: toFieldErrors<DebtFormInput>(parsed.error.issues) };

  const supabase = await createClient();
  const { data, error } = await supabase.from("debts").update(toRow(parsed.data)).eq("id", id).select("id");
  if (error) return fail("update debt", error);
  if (data.length === 0) return { formError: GONE };
  return { ok: true };
}

/**
 * "Mark it paid off" (delete-pattern.md "Debt"): the debt moves to PAID OFF
 * and stops counting in Total owed, even with money left (paid outside the
 * app). `paidOff: false` moves it back to active.
 */
export async function setDebtPaidOff(id: string, paidOff: boolean): Promise<Result> {
  await requireAppUser();
  if (!z.uuid().safeParse(id).success) return { formError: SOMETHING_WRONG };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("debts")
    .update({ paid_off_at: paidOff ? new Date().toISOString() : null })
    .eq("id", id)
    .select("id");
  if (error) return fail("mark debt paid off", error);
  if (data.length === 0) return { formError: GONE };
  return { ok: true };
}

/**
 * Deletes a debt (level 2). Its past payments stay in Activity with the link
 * emptied (on delete set null, plan review 3.6). Week 5 also removes its
 * future plan items.
 */
export async function deleteDebt(id: string): Promise<Result> {
  await requireAppUser();
  if (!z.uuid().safeParse(id).success) return { formError: SOMETHING_WRONG };
  const supabase = await createClient();
  const { data, error } = await supabase.from("debts").delete().eq("id", id).select("id");
  if (error) return fail("delete debt", error);
  if (data.length === 0) return { formError: GONE };
  return { ok: true };
}

function toRow(values: DebtValues) {
  return {
    name: values.name,
    lender: values.lender,
    total_amount: values.total,
    payment_type: values.paymentType,
    num_payments: values.numPayments,
    payment_amount: values.payment,
    first_due_date: values.firstDueDate,
    interest_rate: values.interestRate,
  };
}

function fail(what: string, error: { code?: string; message: string }): Result {
  console.error(`debts: couldn't ${what}`, error.code, error.message);
  return { formError: SOMETHING_WRONG };
}
