"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getPendingEmail, setPendingEmail } from "@/lib/auth/pending-email";
import { createClient } from "@/lib/supabase/server";
import { type SignUpInput, signUpSchema } from "@/lib/validation/auth";

export type SignUpResult = {
  fieldErrors?: Partial<Record<keyof SignUpInput, string>>;
  formError?: string;
};

const TOO_MANY_TRIES = "Too many tries. Wait a minute, then try again.";

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
  if (!parsed.success) {
    const fieldErrors: SignUpResult["fieldErrors"] = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0] as keyof SignUpInput;
      fieldErrors[field] ??= issue.message;
    }
    return { fieldErrors };
  }

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

  if (error) {
    switch (error.code) {
      case "weak_password":
        return { fieldErrors: { password: "Use at least 8 characters, with a number." } };
      case "email_address_invalid":
        return { fieldErrors: { email: "Enter a valid email, like you@example.com." } };
      case "user_already_exists":
      case "email_exists":
        return { formError: "There's already an account with this email. Log in instead?" };
      case "over_email_send_rate_limit":
      case "over_request_rate_limit":
        return { formError: TOO_MANY_TRIES };
      default:
        console.error("signUp failed", error.code, error.message);
        return { formError: "Something went wrong on our side. Please try again." };
    }
  }

  // With "Confirm email" on, Supabase doesn't return an error for an email that
  // already has an account; it returns a user with no identities instead.
  if (data.user && data.user.identities?.length === 0) {
    return { formError: "There's already an account with this email. Log in instead?" };
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
    console.error("resend failed", error.code, error.message);
    return { ok: false, error: "We couldn't send it. Please try again in a minute." };
  }
  return { ok: true };
}
