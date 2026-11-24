"use server";

import { z } from "zod";
import { requireAppUser } from "@/lib/require-app-user";
import { createClient } from "@/lib/supabase/server";
import {
  type CategoryFormInput,
  type CategoryValues,
  categorySchema,
  duplicateNameMessage,
} from "@/lib/validation/category";
import { SOMETHING_WRONG, toFieldErrors } from "@/lib/validation/field-errors";

export type CategoryResult = {
  ok?: true;
  /** The saved category, so the caller can select it (3h-3's picker). */
  id?: string;
  formError?: string;
  fieldErrors?: Partial<Record<keyof CategoryFormInput, string>>;
};

const GONE = "That category no longer exists. Refresh the page.";

// New and Edit category (more-and-categories.md §2). RLS limits every query
// to the user's own rows; the column grants stop anything but these fields
// changing. kind is always expense: users can't make income categories.

export async function createCategory(input: CategoryFormInput): Promise<CategoryResult> {
  await requireAppUser();
  const parsed = categorySchema.safeParse(input);
  if (!parsed.success) return { fieldErrors: toFieldErrors<CategoryFormInput>(parsed.error.issues) };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("categories")
    .insert({ kind: "expense", ...toRow(parsed.data) })
    .select("id")
    .single();
  if (error) return fail("add category", error, parsed.data.name);
  return { ok: true, id: data.id };
}

export async function updateCategory(id: string, input: CategoryFormInput): Promise<CategoryResult> {
  await requireAppUser();
  if (!z.uuid().safeParse(id).success) return { formError: SOMETHING_WRONG };
  const parsed = categorySchema.safeParse(input);
  if (!parsed.success) return { fieldErrors: toFieldErrors<CategoryFormInput>(parsed.error.issues) };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("categories")
    .update(toRow(parsed.data))
    .eq("id", id)
    // System categories are read-only in the app (owner, Nov 24), and income
    // ones have no group to set. The database also locks their name and group.
    .eq("kind", "expense")
    .is("system_key", null)
    .select("id");
  if (error) return fail("update category", error, parsed.data.name);
  // Nothing updated: deleted, a system category, or not this user's.
  if (data.length === 0) return { formError: GONE };
  return { ok: true, id };
}

/**
 * Deletes a category (delete-pattern.md level 2). If transactions use it,
 * `moveTo` is required: delete_category() moves them there and deletes the
 * category in one database transaction, so neither happens without the other.
 */
export async function deleteCategory(id: string, moveTo: string | null): Promise<CategoryResult & { moveError?: string }> {
  await requireAppUser();
  if (!z.uuid().safeParse(id).success) return { formError: SOMETHING_WRONG };
  if (moveTo != null && !z.uuid().safeParse(moveTo).success) return { moveError: MOVE_MESSAGE };

  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_category", { target_category: id, move_to: moveTo ?? undefined });
  if (!error) return { ok: true };
  switch (error.code) {
    case "P0002": // gone, or not this user's
      return { formError: GONE };
    case "22023": // no destination, or not an allowed one
      return { moveError: MOVE_MESSAGE };
    case "23503": // a transaction was added between the move and the delete
      return { formError: "Something new uses this category. Try again." };
    default:
      console.error("categories: couldn't delete category", error.code, error.message);
      return { formError: SOMETHING_WRONG };
  }
}

const MOVE_MESSAGE = "Pick a category to move them to.";

function toRow(values: CategoryValues) {
  return { name: values.name, budget_group: values.budgetGroup, icon: values.icon, color: values.color };
}

function fail(what: string, error: { code?: string; message: string }, name: string): CategoryResult {
  // 23505: the unique index on the name (ignoring case and outer spaces).
  if (error.code === "23505") return { fieldErrors: { name: duplicateNameMessage(name) } };
  console.error(`categories: couldn't ${what}`, error.code, error.message);
  return { formError: SOMETHING_WRONG };
}
