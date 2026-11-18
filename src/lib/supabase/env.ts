// Reads the two public Supabase values and fails loudly if one is missing,
// instead of letting the client send requests to "undefined".
// The variables are written out in full (not process.env[name]) because
// Next.js only inlines NEXT_PUBLIC_ values into browser code when it sees the exact name.
export function getSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !publishableKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY. Copy .env.example to .env.local and fill them in.",
    );
  }

  return { url, publishableKey };
}
