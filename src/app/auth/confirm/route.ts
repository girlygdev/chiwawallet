import type { EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";
import { clearPendingEmail } from "@/lib/auth/pending-email";
import { createClient } from "@/lib/supabase/server";

// Only the link types this route is meant to handle. Recovery is added in 3e.
const ALLOWED_TYPES: EmailOtpType[] = ["email", "signup"];

// The confirmation email links here. Supabase's "Confirm signup" template must use:
//   {{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=email
// verifyOtp checks the token and logs the user in (it sets the session cookie).
// Unlike the default ?code= link, this works even if the email is opened in a
// different browser or device from the one used to sign up.
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const code = searchParams.get("code");

  const supabase = await createClient();
  let ok = false;

  if (tokenHash && type && ALLOWED_TYPES.includes(type)) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    ok = !error;
  } else if (code) {
    // Fallback for the default template's ?code= link (same browser only).
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    ok = !error;
  }

  if (!ok) {
    return NextResponse.redirect(new URL("/check-email?error=link-expired", request.url));
  }

  await clearPendingEmail();
  // The design says onboarding; it doesn't exist yet, so go to the dashboard (decided Nov 18).
  return NextResponse.redirect(new URL("/dashboard", request.url));
}
