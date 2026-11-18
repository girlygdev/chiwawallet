"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getPendingEmail, setPendingEmail } from "@/lib/auth/pending-email";
import { createClient } from "@/lib/supabase/server";
import {
  type LogInInput,
  logInSchema,
  type SignUpInput,
  signUpSchema,
} from "@/lib/validation/auth";

// What a form action returns when it doesn't redirect: errors to show.
export type FormResult<T> = {
  fieldErrors?: Partial<Record<keyof T, string>>;
  formError?: string;
};
export type SignUpResult = FormResult<SignUpInput>;
export type LogInResult = FormResult<LogInInput>;

// Turns Zod's issues into one message per field (the first one wins).
function toFieldErrors<T>(issues: { path: PropertyKey[]; message: string }[]) {
  const fieldErrors: Partial<Record<keyof T, string>> = {};
  for (const issue of issues) {
    const field = issue.path[0] as keyof T;
    fieldErrors[field] ??= issue.message;
  }
  return fieldErrors;
}

const TOO_MANY_TRIES = "Too many tries. Wait a minute, then try again.";
const SOMETHING_WRONG = "Something went wrong on our side. Please try again.";

// Where the email link should land. It must be listed under Supabase →
// Authentication → URL Configuration → Redirect URLs, or Supabase ignores it.
async function confirmUrl() {
  const h = await headers();
  const origin = h.get("origin") ?? `https://${h.get("host")}`;
  return `${origin}/auth/confirm`;
}

export async function signUp(input: SignUpInput): Promise<SignUpResult> {
  // Never trust the browser's checks: validate again on the server.
  const parsed = signUpSchema.safeParse(input);
  if (!parsed.success) return { fieldErrors: toFieldErrors<SignUpInput>(parsed.error.issues) };

  const { displayName, email, password } = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: await confirmUrl(),
      // Stored on the Supabase user. The profiles task copies these into
      // profiles.display_name and profiles.consent_at (the DPA consent record).
      data: { display_name: displayName, consent_at: new Date().toISOString() },
    },
  });

  // Privacy: an email that already has an account gets exactly the same result
  // as a new sign-up (Check your email), so nobody can use this form to find out
  // who uses Chiwawallet (decided Nov 18). Supabase signals it either as an
  // error code or, with "Confirm email" on, as a user with no identities.
  const alreadyRegistered =
    error?.code === "user_already_exists" ||
    error?.code === "email_exists" ||
    (!error && data.user?.identities?.length === 0);

  if (error && !alreadyRegistered) {
    switch (error.code) {
      case "weak_password":
        return { fieldErrors: { password: "Use at least 8 characters, with a number." } };
      case "email_address_invalid":
        return { fieldErrors: { email: "Enter a valid email, like you@example.com." } };
      case "over_email_send_rate_limit":
      case "over_request_rate_limit":
        return { formError: TOO_MANY_TRIES };
      default:
        console.error("signUp failed", error.code, error.message);
        return { formError: SOMETHING_WRONG };
    }
  }

  await setPendingEmail(email);
  redirect("/check-email");
}

export type ResendResult = { ok: true } | { ok: false; error: string };

// "Resend link" on Check your email. The email comes from the pending-email
// cookie, never from the browser, so this can't be used to email anyone else.
export async function resendConfirmation(): Promise<ResendResult> {
  const email = await getPendingEmail();
  if (!email) return { ok: false, error: "This link has expired. Sign up again to get a new one." };

  const supabase = await createClient();
  const { error } = await supabase.auth.resend({
    type: "signup",
    email,
    options: { emailRedirectTo: await confirmUrl() },
  });

  if (error) {
    if (error.code === "over_email_send_rate_limit" || error.code === "over_request_rate_limit") {
      return { ok: false, error: TOO_MANY_TRIES };
    }
    // Any other error (e.g. the email already has a confirmed account) looks
    // like a success, for the same privacy reason as in signUp. It's logged
    // on the server so real failures still show up in Vercel's logs.
    console.error("resend failed", error.code, error.message);
    return { ok: true };
  }
  return { ok: true };
}

export async function logIn(input: LogInInput): Promise<LogInResult> {
  const parsed = logInSchema.safeParse(input);
  if (!parsed.success) return { fieldErrors: toFieldErrors<LogInInput>(parsed.error.issues) };

  const { email, password } = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    switch (error.code) {
      case "invalid_credentials":
        // Never say which of the two was wrong (auth-screens.md).
        return {
          formError: "That email and password don't match. Try again or reset your password.",
        };
      case "email_not_confirmed":
        // Supabase only says this after the password matched, so it doesn't reveal
        // anything to a stranger. Send them to Check your email to resend the link.
        await setPendingEmail(email);
        redirect("/check-email");
      case "over_request_rate_limit":
        return { formError: TOO_MANY_TRIES };
      default:
        console.error("logIn failed", error.code, error.message);
        return { formError: SOMETHING_WRONG };
    }
  }

  redirect("/dashboard");
}

// Ends the session on this device only (clears the Supabase cookies).
export async function logOut() {
  const supabase = await createClient();
  await supabase.auth.signOut({ scope: "local" });
  redirect("/login");
}
