import { redirect } from "next/navigation";
import { cache } from "react";
import { hasConsented } from "@/lib/auth/consent";
import { getCurrentProfile } from "@/lib/current-profile";
import { createClient } from "@/lib/supabase/server";

// The check every app page runs before showing anything: logged in (verified
// with Supabase, so a forged cookie doesn't pass) and consented. The proxy
// already redirects, but it's only a fast first check, and a layout doesn't
// re-run when moving between pages, so each page calls this.
// cache() means calling it several times in one request costs one check.
export const requireAppUser = cache(async () => {
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
