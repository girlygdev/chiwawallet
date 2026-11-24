"use server";

import { z } from "zod";
import { getOrCreatePeriod } from "@/lib/budget-periods";
import { todayInManila } from "@/lib/periods";
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
// budget only decides which pay slots are allowed.

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

export type DeletePotResult = { ok?: true; formError?: string; choiceError?: string };

/**
 * Deletes a pot (delete-pattern.md level 2). With money in it, `choice` says
 * what happens: "move" to `moveTo`, or "withdraw". delete_pot() writes that
 * down in today's period and deletes the pot in one database transaction.
 */
export async function deletePot(
  id: string,
  choice: "move" | "withdraw" | null,
  moveTo: string | null,
): Promise<DeletePotResult> {
  const { budget } = await requireAppUser();
  if (!z.uuid().safeParse(id).success) return { formError: SOMETHING_WRONG };
  if (choice != null && !["move", "withdraw"].includes(choice)) return { formError: SOMETHING_WRONG };
  if (choice === "move" && !z.uuid().safeParse(moveTo).success) return { choiceError: "Pick a pot to move it to." };

  const supabase = await createClient();
  const today = todayInManila(new Date());
  // The move or withdrawal is written today, in today's period (made the
  // first time it's opened, like everywhere else).
  const period = await getOrCreatePeriod(supabase, budget, today);
  const { error } = await supabase.rpc("delete_pot", {
    target_pot: id,
    on_period: period.id,
    on_date: today,
    choice: choice ?? undefined,
    move_to: choice === "move" ? (moveTo ?? undefined) : undefined,
  });
  if (!error) return { ok: true };
  switch (error.code) {
    case "P0002": // gone, or not this user's
      return { formError: "That pot no longer exists. Refresh the page." };
    case "22023": // no choice, or not an allowed pot
      return { choiceError: "Choose what happens to the money." };
    default:
      console.error("savings: couldn't delete pot", error.code, error.message);
      return { formError: SOMETHING_WRONG };
  }
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
