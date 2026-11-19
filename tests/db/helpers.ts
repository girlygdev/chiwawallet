import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Talks to local Supabase only (`npx supabase start`), never the live project.
function localEnv() {
  const url = process.env.SUPABASE_TEST_URL;
  const key = process.env.SUPABASE_TEST_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Missing SUPABASE_TEST_URL or SUPABASE_TEST_PUBLISHABLE_KEY. Run `npx supabase status` and copy the API URL and publishable key into .env.test.local.",
    );
  }
  if (!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(url)) {
    throw new Error(`SUPABASE_TEST_URL must point to local Supabase, not ${url}.`);
  }
  return { url, key };
}

function newClient() {
  const { url, key } = localEnv();
  // No saved session: each client is one user, kept in memory for the test.
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

/** A client that isn't logged in. */
export function anonClient() {
  return newClient();
}

export type TestUser = { client: SupabaseClient; id: string; email: string };

/**
 * Signs up a new user (local Supabase doesn't ask for email confirmation) and
 * returns a client logged in as them. `data` is the sign-up metadata, like the
 * sign-up form sends.
 */
export async function signUpUser(data: Record<string, unknown> = {}): Promise<TestUser> {
  const client = newClient();
  // A new email every run, so tests never clash with users from earlier runs.
  const email = `test-${randomUUID()}@example.com`;
  const { data: result, error } = await client.auth.signUp({
    email,
    password: "test-password-123",
    options: { data },
  });
  if (error || !result.user || !result.session) {
    throw new Error(`Sign-up failed: ${error?.message ?? "no session returned"}`);
  }
  return { client, id: result.user.id, email };
}
