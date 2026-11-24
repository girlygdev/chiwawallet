"use server";

import { z } from "zod";
import { requireAppUser } from "@/lib/require-app-user";
import { createClient } from "@/lib/supabase/server";
import { SOMETHING_WRONG, toFieldErrors } from "@/lib/validation/field-errors";
import { type PotFormInput, type PotValues, potSchemaFor } from "@/lib/validation/pot";

type Result = {
  ok?: true;
  formError?: string;
  fieldErrors?: Partial<Record<keyof PotFormInput, string>>;
};

// New and Edit pot (savings.md §4). Pots belong to the user, not a budget
// (week-4-tasks.md); RLS limits every query to the user's own rows. The
// budget only decides which pay slots are allowed. Delete pot is 4d-3.

export async function addPot(input: PotFormInput): Promise<Result> {
  const { budget } = await requireAppUser();
  const parsed = potSchemaFor(budget.frequency).safeParse(input);
  if (!parsed.success) return { fieldErrors: toFieldErrors<PotFormInput>(parsed.error.issues) };

  const supabase = await createClient();
  const { error } = await supabase.from("savings_pots").insert(toRow(parsed.data));
  if (error) return fail("add pot", error, parsed.data.name);
  return { ok: true };
}

export async function updatePot(id: string, input: PotFormInput): Promise<Result> {
  const { budget } = await requireAppUser();
  if (!z.uuid().safeParse(id).success) return { formError: SOMETHING_WRONG };
  const parsed = potSchemaFor(budget.frequency).safeParse(input);
  if (!parsed.success) return { fieldErrors: toFieldErrors<PotFormInput>(parsed.error.issues) };

  const supabase = await createClient();
  const { data, error } = await supabase.from("savings_pots").update(toRow(parsed.data)).eq("id", id).select("id");
  if (error) return fail("update pot", error, parsed.data.name);
  if (data.length === 0) return { formError: "That pot no longer exists. Refresh the page." };
  return { ok: true };
}

function toRow(values: PotValues) {
  return {
    name: values.name,
    icon: values.icon,
    color: values.color,
    target_amount: values.target,
    target_date: values.targetDate,
    starting_balance: values.startingBalance,
    planned_contribution: values.contribution,
    pay_slot: values.paySlot,
    is_locked: values.isLocked,
  };
}

function fail(what: string, error: { code?: string; message: string }, name: string): Result {
  // 23505: the unique index on the name (ignoring case and outer spaces).
  if (error.code === "23505") return { fieldErrors: { name: `You already have a pot called ${name}.` } };
  console.error(`savings: couldn't ${what}`, error.code, error.message);
  return { formError: SOMETHING_WRONG };
}
