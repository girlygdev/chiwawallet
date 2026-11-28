"use server";

import { setChecklistDismissed } from "@/lib/checklist-cookie";
import { loadStartEarly } from "@/lib/early-pay";
import { todayInManila } from "@/lib/periods";
import { requireAppUser } from "@/lib/require-app-user";
import { createClient } from "@/lib/supabase/server";

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

export type StartEarlyResult =
  | { ok: true; payday: string; oldStart: string; leftover: number; askOnPayday: boolean }
  | { formError: string };

// start_period_early()'s refusals (migration 20261128110000), in words.
const START_ERRORS: Record<string, string> = {
  "55000": "This period has already started, or it's closed.",
  "22023": "You can start a period up to 5 days before its payday, and not on the day the current one began.",
  P0002: "That period isn't there anymore. Refresh to see the latest.",
};

/**
 * Start my next period now (owner, Nov 28; Task D3). Takes no input: the
 * offer is worked out again here from the database (it may have changed
 * since the page loaded), and start_period_early() checks it all once more
 * with the database's clock, starts the period, moves today's rows and
 * re-dates the early pay, all at once. No undo (owner decision).
 */
export async function startNextPeriodEarly(): Promise<StartEarlyResult> {
  const { budget } = await requireAppUser();
  const supabase = await createClient();
  const offer = await loadStartEarly(supabase, budget, todayInManila(new Date()));
  if (!offer) return { formError: "Your next period can't start now. Refresh to see the latest." };

  const { error } = await supabase.rpc("start_period_early", { target_period: offer.periodId });
  if (error) {
    console.error("dashboard: couldn't start the period early", error);
    return { formError: START_ERRORS[error.code] ?? "Couldn't start your next period. Try again." };
  }
  // The Dashboard closes the old period on its next load: the payday screen
  // with Ask me on payday on, silently carried over with it off.
  return { ok: true, payday: offer.payday, oldStart: offer.oldStart, leftover: offer.leftover, askOnPayday: budget.ask_on_payday };
}
