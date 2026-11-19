import type { Profile } from "@/lib/profiles";

// True once the user has agreed to the Privacy Notice and Terms: on the
// sign-up form (email) or on the one-time consent step (Google).
// profiles.consent_at is the record (the DPA consent record). The proxy only
// does a quick check on the login data; pages use this.
export function hasConsented(profile: Profile | null) {
  return profile?.consent_at != null;
}
