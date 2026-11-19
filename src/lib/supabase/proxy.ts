import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseEnv } from "./env";

// Supabase client for src/proxy.ts. The server client can't be used there:
// it reads cookies through next/headers, which only works while rendering.
// Here, cookies come from the incoming request and go out on the response.
export function createProxyClient(request: NextRequest) {
  const { url, publishableKey } = getSupabaseEnv();
  let response = NextResponse.next({ request });

  const supabase = createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        // 1. Put the refreshed cookies on the request, so the page rendered
        //    after the proxy already sees the new session.
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        // 2. Rebuild the response from that request, then put the cookies on
        //    it too, so the browser saves them.
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
        // 3. Headers from Supabase (Cache-Control) that stop a CDN from caching
        //    a response carrying someone's session cookie.
        for (const [key, value] of Object.entries(headers)) response.headers.set(key, value);
      },
    },
  });

  return {
    supabase,
    // A function, not a value: setAll swaps the response after a refresh.
    getResponse: () => response,
  };
}

// Redirects while keeping any refreshed session cookies. Without this, a
// redirect would drop them and the browser would keep the old, expiring session.
export function redirectWithCookies(request: NextRequest, from: NextResponse, pathname: string) {
  const target = request.nextUrl.clone();
  target.pathname = pathname;
  target.search = "";
  const redirect = NextResponse.redirect(target);
  for (const cookie of from.cookies.getAll()) redirect.cookies.set(cookie);
  const cacheControl = from.headers.get("Cache-Control");
  if (cacheControl) redirect.headers.set("Cache-Control", cacheControl);
  return redirect;
}
