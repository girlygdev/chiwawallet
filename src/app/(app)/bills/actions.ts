"use server";

import { z } from "zod";
import { todayInManila } from "@/lib/periods";
import { syncOpenPeriods } from "@/lib/plan-periods";
import { requireAppUser } from "@/lib/require-app-user";
import { createClient } from "@/lib/supabase/server";
import { type BillFormInput, type BillValues, billSchemaFor } from "@/lib/validation/bill";
import { SOMETHING_WRONG, toFieldErrors } from "@/lib/validation/field-errors";

type Result = {
  ok?: true;
  formError?: string;
  fieldErrors?: Partial<Record<keyof BillFormInput, string>>;
};

const GONE = "That bill no longer exists. Refresh the page.";

// New, Edit and Delete bill (bills.md §4, delete-pattern.md level 2). RLS
// limits every query to the user's own rows; the budget_id filter keeps
// edits inside the current budget, and the same-owner foreign keys stop a
// bill pointing at someone else's budget or category.

export async function addBill(input: BillFormInput): Promise<Result> {
  const { budget } = await requireAppUser();
  const parsed = billSchemaFor(budget.frequency).safeParse(input);
  if (!parsed.success) return { fieldErrors: toFieldErrors<BillFormInput>(parsed.error.issues) };

  const supabase = await createClient();
  const { error } = await supabase.from("recurring_bills").insert({ budget_id: budget.id, ...toRow(parsed.data) });
  if (error) return fail("add bill", error);
  // Open periods follow the change (5h-1).
  await syncOpenPeriods(supabase, budget, todayInManila(new Date()));
  return { ok: true };
}

export async function updateBill(id: string, input: BillFormInput): Promise<Result> {
  const { budget } = await requireAppUser();
  if (!z.uuid().safeParse(id).success) return { formError: SOMETHING_WRONG };
  const parsed = billSchemaFor(budget.frequency).safeParse(input);
  if (!parsed.success) return { fieldErrors: toFieldErrors<BillFormInput>(parsed.error.issues) };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("recurring_bills")
    .update(toRow(parsed.data))
    .eq("id", id)
    .eq("budget_id", budget.id)
    .select("id");
  if (error) return fail("update bill", error);
  if (data.length === 0) return { formError: GONE };
  // Open periods follow the change (5h-1).
  await syncOpenPeriods(supabase, budget, todayInManila(new Date()));
  return { ok: true };
}

/**
 * Deletes a bill (level 2, "none needed; just state it"). Nothing links to
 * bills yet; Week 5's plan items will lose only their future items.
 */
export async function deleteBill(id: string): Promise<Result> {
  const { budget } = await requireAppUser();
  if (!z.uuid().safeParse(id).success) return { formError: SOMETHING_WRONG };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("recurring_bills")
    .delete()
    .eq("id", id)
    .eq("budget_id", budget.id)
    .select("id");
  if (error) return fail("delete bill", error);
  if (data.length === 0) return { formError: GONE };
  return { ok: true };
}

function toRow(values: BillValues) {
  return {
    name: values.name,
    amount: values.amount,
    amount_varies: values.amountVaries,
    category_id: values.categoryId,
    frequency: values.frequency,
    due_day: values.dueDay,
    first_due_month: values.firstDueMonth,
    pay_slot: values.paySlot,
    remind: values.remind,
  };
}

function fail(what: string, error: { code?: string; message: string }): Result {
  // 23514 from check_bill_category(): a system or income category; 23503: a
  // category that isn't the user's (or was just deleted).
  if (error.code === "23514" || error.code === "23503") {
    return { fieldErrors: { categoryId: "Pick one of your spending categories." } };
  }
  console.error(`bills: couldn't ${what}`, error.code, error.message);
  return { formError: SOMETHING_WRONG };
}
