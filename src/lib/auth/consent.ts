import type { User } from "@supabase/supabase-js";

// True once the user has agreed to the Privacy Notice and Terms: on the
// sign-up form (email) or on the one-time consent step (Google).
// Until the profiles task, the consent time lives in the user's metadata.
export function hasConsented(user: User) {
  return typeof user.user_metadata?.consent_at === "string";
}
