import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabaseEnv } from "./env";
import type { Database } from "./types";

// Supabase client for Server Components, Server Actions and Route Handlers.
// Create a new one per request (never share it between users): it reads the
// logged-in user's session from that request's cookies.
export async function createClient() {
  const { url, publishableKey } = getSupabaseEnv();
  // In Next.js 16, cookies() is async.
  const cookieStore = await cookies();

  // <Database> types every query from the generated schema (types.ts).
  return createServerClient<Database>(url, publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Components can't set cookies (only Server Actions and Route
          // Handlers can). It's safe to skip here because src/proxy.ts
          // refreshes the session cookie on every request.
        }
      },
    },
  });
}
