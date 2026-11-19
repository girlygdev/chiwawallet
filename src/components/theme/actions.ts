"use server";

import { createClient } from "@/lib/supabase/server";
import { isTheme } from "@/lib/theme";

/**
 * Saves the theme to the logged-in user's profile (profiles.theme), so it
 * follows them to other devices. Does nothing when logged out: the choice is
 * still kept on the device.
 */
export async function saveThemeToProfile(theme: unknown): Promise<void> {
  // Validate on the server too: only the three choices reach the database.
  if (!isTheme(theme)) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  // RLS and the column grants allow users to update only their own theme.
  const { error } = await supabase.from("profiles").update({ theme }).eq("user_id", user.id);
  if (error) console.error("theme: couldn't save to profile", error.code, error.message);
}
