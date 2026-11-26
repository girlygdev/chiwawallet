"use server";

import { setChecklistDismissed } from "@/lib/checklist-cookie";
import { requireAppUser } from "@/lib/require-app-user";

// Get started's Dismiss and its Undo (7d-1). There's no input to validate:
// the cookie's value is the signed-in user's own budget id. Setting a cookie
// in a Server Action refreshes the page, so the card goes or comes back.
export async function dismissChecklist(): Promise<void> {
  const { budget } = await requireAppUser();
  await setChecklistDismissed(budget.id, true);
}

export async function undoDismissChecklist(): Promise<void> {
  await requireAppUser();
  await setChecklistDismissed("", false);
}
