import type { SupabaseClient } from "@supabase/supabase-js";
import { cardCharged } from "@/lib/cards";
import type { Database } from "@/lib/supabase/types";

// Credit cards (8b-2): every live purchase made with a card, for their
// balances wherever debts are listed (Debts, More, the Plan, the add sheet).
// Server only; RLS limits it to the user's own rows.

export type CardChargeRow = { type: string; amount: number; card_id: string | null; date: string; deleted_at: string | null };

export async function loadCardCharges(supabase: SupabaseClient<Database>): Promise<CardChargeRow[]> {
  const { data, error } = await supabase
    .from("transactions")
    .select("type, amount, card_id, date, deleted_at")
    .eq("type", "expense")
    .not("card_id", "is", null)
    .is("deleted_at", null);
  if (error) throw new Error(`Couldn't load card purchases: ${error.message}`, { cause: error });
  return data;
}

/**
 * A debt's `charged` for debtLeft() and debtsSummary(): everything bought
 * with it when it's a card, otherwise nothing.
 */
export function chargedFor(debt: { id: string; payment_type: string }, charges: CardChargeRow[]): number {
  return debt.payment_type === "card" ? cardCharged(charges, debt.id) : 0;
}
