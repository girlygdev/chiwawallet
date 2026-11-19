import { type NextRequest, NextResponse } from "next/server";
import { hasConsented } from "@/lib/auth/consent";
import { getMyProfile } from "@/lib/profiles";
import { createClient } from "@/lib/supabase/server";

// Google sends the user back here (via Supabase) with a one-time ?code=.
// Exchanging it logs the user in. If they cancelled on Google's screen, the
// URL has ?error= instead, and they go back to Log in with a short note.
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const back = (path: string) => NextResponse.redirect(new URL(path, request.url));

  if (!code) return back("/login?error=google");

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user) {
    console.error("Google callback failed", error?.code, error?.message);
    return back("/login?error=google");
  }

  // First Google sign-in: ask for consent (and a name) before the app opens.
  // The sign-up trigger has already created the profile, without consent.
  return back(hasConsented(await getMyProfile(supabase)) ? "/dashboard" : "/consent");
}
