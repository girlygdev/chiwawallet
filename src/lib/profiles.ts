import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Tables } from "@/lib/supabase/types";

export type Profile = Tables<"profiles">;

// The logged-in user's profile, or null if there isn't one (logged out, or
// the database couldn't be reached). RLS only returns the caller's own row,
// so no user ID filter is needed; maybeSingle() turns "no row" into null.
export async function getMyProfile(supabase: SupabaseClient<Database>): Promise<Profile | null> {
  const { data, error } = await supabase.from("profiles").select("*").maybeSingle();
  if (error) {
    console.error("getMyProfile failed", error.code, error.message);
    return null;
  }
  return data;
}
