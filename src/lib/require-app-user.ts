import { redirect } from "next/navigation";
import { cache } from "react";
import { hasConsented } from "@/lib/auth/consent";
import { getCurrentBudget } from "@/lib/current-budget";
import { getCurrentProfile } from "@/lib/current-profile";
import { isOnboarded } from "@/lib/onboarding";
import { createClient } from "@/lib/supabase/server";

// Logged in (verified with Supabase, so a forged cookie doesn't pass) and
// consented. Onboarding pages use this one: they're for users who haven't
// finished setup yet. cache() means calling it several times in one request
// costs one check.
export const requireConsentedUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const profile = await getCurrentProfile();
  // Google sign-ups must finish the consent step before using the app.
  if (!profile || !hasConsented(profile)) redirect("/consent");

  return { user, profile };
});

// The check every app page runs before showing anything: a consented user
// who has finished setup. Anyone without a finished budget goes to onboarding
// (plan review 4.1: checked here, once per page, not in the proxy on every
// request). The proxy's redirects are only a fast first check, and a layout
// doesn't re-run when moving between pages, so each page calls this.
export const requireAppUser = cache(async () => {
  const { user, profile } = await requireConsentedUser();
  const budget = await getCurrentBudget();
  if (!budget || !isOnboarded(budget)) redirect("/onboarding");
  return { user, profile, budget };
});
