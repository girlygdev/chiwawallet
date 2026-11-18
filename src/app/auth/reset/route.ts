import { type NextRequest, NextResponse } from "next/server";
import { clearPendingEmail } from "@/lib/auth/pending-email";
import { createClient } from "@/lib/supabase/server";

// The password reset email links here. Opening the link logs the user in with
// a short "recovery" session, which /reset-password then uses to set the new
// password. Handles both link styles:
//   - ?code=…  (Supabase's default template; same browser only)
//   - ?token_hash=…&type=recovery  (for when custom SMTP lets us edit templates)
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");

  const supabase = await createClient();
  let ok = false;

  if (tokenHash && searchParams.get("type") === "recovery") {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "recovery" });
    ok = !error;
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    ok = !error;
  }

  if (!ok) {
    return NextResponse.redirect(new URL("/forgot-password?error=link-expired", request.url));
  }

  await clearPendingEmail();
  return NextResponse.redirect(new URL("/reset-password", request.url));
}
