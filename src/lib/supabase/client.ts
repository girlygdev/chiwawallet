import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseEnv } from "./env";
import type { Database } from "./types";

// Supabase client for Client Components ("use client").
// It uses the publishable key, so every query still goes through RLS.
// createBrowserClient reuses one instance per tab, so calling this often is fine.
export function createClient() {
  const { url, publishableKey } = getSupabaseEnv();
  return createBrowserClient<Database>(url, publishableKey);
}
