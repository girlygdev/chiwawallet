"use server";

import { z } from "zod";
import { todayInManila } from "@/lib/periods";
import { syncOpenPeriods } from "@/lib/plan-periods";
import { requireAppUser } from "@/lib/require-app-user";
import { createClient } from "@/lib/supabase/server";
import { type CardFormInput, type CardValues, cardSchema, type DebtFormInput, type DebtValues, debtSchema } from "@/lib/validation/debt";
import { SOMETHING_WRONG, toFieldErrors } from "@/lib/validation/field-errors";

type Result = {
  ok?: true;
  formError?: string;
  fieldErrors?: Partial<Record<keyof DebtFormInput, string>>;
};

type CardResult = { ok?: true; formError?: string; fieldErrors?: Partial<Record<keyof CardFormInput, string>> };

const GONE = "That debt no longer exists. Refresh the page.";

// New, Edit and Delete debt, and Mark as paid off (debts.md §4,
// delete-pattern.md "Debt"). Debts belong to the user, not a budget; RLS
// limits every query to the user's own rows.

export async function addDebt(input: DebtFormInput): Promise<Result> {
  const { budget } = await requireAppUser();
  const parsed = debtSchema.safeParse(input);
  if (!parsed.success) return { fieldErrors: toFieldErrors<DebtFormInput>(parsed.error.issues) };

  const supabase = await createClient();
  const { error } = await supabase.from("debts").insert(toRow(parsed.data));
  if (error) return fail("add debt", error);
  // Open periods follow the change (5h-1).
  await syncOpenPeriods(supabase, budget, todayInManila(new Date()));
  return { ok: true };
}

export async function updateDebt(id: string, input: DebtFormInput): Promise<Result> {
  const { budget } = await requireAppUser();
  if (!z.uuid().safeParse(id).success) return { formError: SOMETHING_WRONG };
  const parsed = debtSchema.safeParse(input);
  if (!parsed.success) return { fieldErrors: toFieldErrors<DebtFormInput>(parsed.error.issues) };

  const supabase = await createClient();
  const { data, error } = await supabase.from("debts").update(toRow(parsed.data)).eq("id", id).select("id");
  if (error) return fail("update debt", error);
  if (data.length === 0) return { formError: GONE };
  // Open periods follow the change (5h-1).
  await syncOpenPeriods(supabase, budget, todayInManila(new Date()));
  return { ok: true };
}

/** New credit card (8b-2): no schedule, so open periods don't change yet (8b-4 plans its payment). */
export async function addCard(input: CardFormInput): Promise<CardResult> {
  await requireAppUser();
  const parsed = cardSchema.safeParse(input);
  if (!parsed.success) return { fieldErrors: toFieldErrors<CardFormInput>(parsed.error.issues) };
  const supabase = await createClient();
  const { error } = await supabase.from("debts").insert({ ...cardRow(parsed.data), payment_type: "card" });
  if (error) return fail("add card", error);
  return { ok: true };
}

/** Edit card (8b-2). Only a card: the database keeps a card a card, and this never changes the type. */
export async function updateCard(id: string, input: CardFormInput): Promise<CardResult> {
  await requireAppUser();
  if (!z.uuid().safeParse(id).success) return { formError: SOMETHING_WRONG };
  const parsed = cardSchema.safeParse(input);
  if (!parsed.success) return { fieldErrors: toFieldErrors<CardFormInput>(parsed.error.issues) };
  const supabase = await createClient();
  const { data, error } = await supabase.from("debts").update(cardRow(parsed.data)).eq("id", id).eq("payment_type", "card").select("id");
  if (error) return fail("update card", error);
  if (data.length === 0) return { formError: "That card no longer exists. Refresh the page." };
  return { ok: true };
}

/**
 * "Mark it paid off" (delete-pattern.md "Debt"): the debt moves to PAID OFF
 * and stops counting in Total owed, even with money left (paid outside the
 * app). `paidOff: false` moves it back to active.
 */
export async function setDebtPaidOff(id: string, paidOff: boolean): Promise<Result> {
  const { budget } = await requireAppUser();
  if (!z.uuid().safeParse(id).success) return { formError: SOMETHING_WRONG };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("debts")
    .update({ paid_off_at: paidOff ? new Date().toISOString() : null })
    .eq("id", id)
    .select("id");
  if (error) return fail("mark debt paid off", error);
  if (data.length === 0) return { formError: GONE };
  // Open periods follow the change (5h-1).
  await syncOpenPeriods(supabase, budget, todayInManila(new Date()));
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
  // 23503: a credit card with purchases or payments (8b-1). Deleting it would
  // turn its purchases into cash spending, so it can only be closed.
  if (error?.code === "23503") return { formError: "This card has purchases or payments, so it can only be closed." };
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
    target_date: values.targetDate,
  };
}

function cardRow(values: CardValues) {
  return {
    name: values.name,
    lender: values.lender,
    total_amount: values.owed,
    due_day: values.dueDay,
    pay_slot: values.paySlot,
    interest_rate: values.interestRate,
  };
}

function fail(what: string, error: { code?: string; message: string }): Result {
  console.error(`debts: couldn't ${what}`, error.code, error.message);
  return { formError: SOMETHING_WRONG };
}
