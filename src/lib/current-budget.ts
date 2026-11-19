import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/supabase/types";

export type Budget = Tables<"budgets">;

// The logged-in user's budget for Server Components, or null if they haven't
// made one. Users have one budget until budget switching (Week 9), so this is
// the oldest (decided Nov 19). RLS returns only the caller's own rows.
// cache() runs the query once per request.
export const getCurrentBudget = cache(async (): Promise<Budget | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("budgets")
    .select("*")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) {
    // Thrown, not null: null means "no budget yet" and would send the user to
    // onboarding, where they'd create a second budget.
    throw new Error(`Couldn't load the budget: ${error.message}`, { cause: error });
  }
  return data;
});

/** How many income sources the budget has (onboarding step 2 needs one). */
export const countIncomeSources = cache(async (budgetId: string): Promise<number> => {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("income_sources")
    .select("id", { count: "exact", head: true })
    .eq("budget_id", budgetId);
  if (error) throw new Error(`Couldn't count income sources: ${error.message}`, { cause: error });
  return count ?? 0;
});
