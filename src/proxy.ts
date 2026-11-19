import type { NextRequest } from "next/server";
import { hasConsented } from "@/lib/auth/consent";
import { getMyProfile } from "@/lib/profiles";
import { createProxyClient, redirectWithCookies } from "@/lib/supabase/proxy";

// Runs before every page request (Next.js 16 renamed middleware.ts to proxy.ts).
// 1. Refreshes the Supabase session cookie, which Server Components can't do.
// 2. Sends logged-out users away from app pages, and logged-in users away
//    from Log in and Sign up.
// 3. Sends users who haven't consented yet (new Google sign-ups) to /consent.
// This is a fast first check only. Pages still check the user themselves, and
// RLS protects the data, so a bug here can't leak anyone's rows.

// App pages from CLAUDE.md. A path matches the page and everything under it.
const APP_PATHS = [
  "/dashboard",
  "/plan",
  "/activity",
  "/savings",
  "/debts",
  "/bills",
  "/income",
  "/settings",
];

// Pages only for logged-out users. Forgot password, Set new password and
// Check your email are left out on purpose: the reset flow uses them while
// logged in.
const LOGGED_OUT_ONLY_PATHS = ["/login", "/signup"];

function startsWithAny(pathname: string, paths: string[]) {
  return paths.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

export async function proxy(request: NextRequest) {
  const { supabase, getResponse } = createProxyClient(request);

  // getClaims() checks the login token (refreshing it if needed) and verifies
  // its signature locally when the project uses asymmetric signing keys, so
  // most requests don't wait on a call to Supabase. Don't put code between
  // creating the client and this call: it's what refreshes the session.
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;

  const { pathname } = request.nextUrl;
  const isAppPage = startsWithAny(pathname, APP_PATHS);

  if (!claims) {
    if (isAppPage) return redirectWithCookies(request, getResponse(), "/login");
    return getResponse();
  }

  if (startsWithAny(pathname, LOGGED_OUT_ONLY_PATHS)) {
    return redirectWithCookies(request, getResponse(), "/dashboard");
  }

  if (isAppPage && typeof claims.user_metadata?.consent_at !== "string") {
    // The token's copy of the user's details only updates when it's refreshed,
    // so right after the consent step it can still say "not consented".
    // Check the real record (profiles.consent_at, which the pages also use)
    // before redirecting, or the user would bounce between /consent and
    // /dashboard. This query only runs for users the quick check didn't pass.
    const profile = await getMyProfile(supabase);
    if (!hasConsented(profile)) {
      return redirectWithCookies(request, getResponse(), "/consent");
    }
  }

  return getResponse();
}

export const config = {
  matcher: [
    // Everything except Next.js build files, image optimisation, the favicon
    // and image files, so CSS, JS and icons never get redirected to Log in.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
