import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseEnv } from "./env";

// Supabase client for Client Components ("use client").
// It uses the publishable key, so every query still goes through RLS.
// createBrowserClient reuses one instance per tab, so calling this often is fine.
export function createClient() {
  const { url, publishableKey } = getSupabaseEnv();
  return createBrowserClient(url, publishableKey);
}
