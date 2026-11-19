"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getPendingEmail, setPendingEmail } from "@/lib/auth/pending-email";
import { CONSENT_VERSION } from "@/lib/legal";
import { createClient } from "@/lib/supabase/server";
import {
  type ConsentInput,
  consentSchema,
  type ForgotPasswordInput,
  forgotPasswordSchema,
  type LogInInput,
  logInSchema,
  type SetPasswordInput,
  setPasswordSchema,
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

// Full URL for an email link to land on. It must be covered by Supabase →
// Authentication → URL Configuration → Redirect URLs, or Supabase ignores it.
async function appUrl(path: string) {
  const h = await headers();
  const origin = h.get("origin") ?? `https://${h.get("host")}`;
  return `${origin}${path}`;
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
      emailRedirectTo: await appUrl("/auth/confirm"),
      // Stored on the Supabase user. The sign-up trigger copies them into
      // profiles: display_name, consent_at (the DPA consent record, using the
      // database's own time) and consent_version.
      data: {
        display_name: displayName,
        consent_at: new Date().toISOString(),
        consent_version: CONSENT_VERSION,
      },
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

// "Resend link" on Check your email: a new confirmation or reset link,
// depending on what was sent first. The email comes from the pending-email
// cookie, never from the browser, so this can't be used to email anyone else.
export async function resendEmailLink(): Promise<ResendResult> {
  const pending = await getPendingEmail();
  if (!pending) return { ok: false, error: "This link has expired. Start again to get a new one." };

  const error =
    pending.purpose === "reset"
      ? await sendResetEmail(pending.email)
      : (
          await (await createClient()).auth.resend({
            type: "signup",
            email: pending.email,
            options: { emailRedirectTo: await appUrl("/auth/confirm") },
          })
        ).error;

  if (error && isRateLimited(error.code)) return { ok: false, error: TOO_MANY_TRIES };
  // Any other error (e.g. the email already has a confirmed account) looks
  // like a success, for the same privacy reason as in signUp. It's logged
  // on the server so real failures still show up in Vercel's logs.
  if (error) console.error("resend failed", error.code, error.message);
  return { ok: true };
}

function isRateLimited(code: string | undefined) {
  return code === "over_email_send_rate_limit" || code === "over_request_rate_limit";
}

async function sendResetEmail(email: string) {
  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: await appUrl("/auth/reset"),
  });
  return error;
}

export type ForgotPasswordResult = FormResult<ForgotPasswordInput>;

export async function requestPasswordReset(
  input: ForgotPasswordInput,
): Promise<ForgotPasswordResult> {
  const parsed = forgotPasswordSchema.safeParse(input);
  if (!parsed.success) {
    return { fieldErrors: toFieldErrors<ForgotPasswordInput>(parsed.error.issues) };
  }

  const { email } = parsed.data;
  const error = await sendResetEmail(email);
  if (error && isRateLimited(error.code)) return { formError: TOO_MANY_TRIES };
  // Every other case, including "no account with this email", goes to
  // Check your email, so this form can't tell anyone who has an account.
  if (error) console.error("resetPasswordForEmail failed", error.code, error.message);

  await setPendingEmail(email, "reset");
  redirect("/check-email");
}

export type SetPasswordResult = FormResult<SetPasswordInput>;

// Set new password. The reset link logged the user in (see /auth/reset),
// so updateUser changes the password of whoever that link belonged to.
export async function setNewPassword(input: SetPasswordInput): Promise<SetPasswordResult> {
  const parsed = setPasswordSchema.safeParse(input);
  if (!parsed.success) {
    return { fieldErrors: toFieldErrors<SetPasswordInput>(parsed.error.issues) };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/forgot-password?error=link-expired");

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    switch (error.code) {
      case "same_password":
        return { fieldErrors: { password: "That's your old password. Pick a new one." } };
      case "weak_password":
        return { fieldErrors: { password: "Use at least 8 characters, with a number." } };
      case "over_request_rate_limit":
        return { formError: TOO_MANY_TRIES };
      default:
        console.error("updateUser failed", error.code, error.message);
        return { formError: SOMETHING_WRONG };
    }
  }

  // auth-screens.md: sign out other sessions if the box is ticked, then go to Log in.
  // "global" ends every session, this one included; "local" ends just this one.
  await supabase.auth.signOut({ scope: parsed.data.signOutOthers ? "global" : "local" });
  redirect("/login?password=updated");
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

// "Continue with Google" / "Sign up with Google". Asks Supabase for Google's
// sign-in page and sends the browser there. Google returns to /auth/callback.
export async function signInWithGoogle(): Promise<{ error: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: await appUrl("/auth/callback") },
  });
  if (error || !data.url) {
    console.error("signInWithOAuth failed", error?.code, error?.message);
    return { error: "Google sign-in isn't working right now. Try again or use your email." };
  }
  redirect(data.url);
}

export type ConsentResult = FormResult<ConsentInput>;

// The one-time consent step for Google sign-ups (decided Nov 18): they skip the
// sign-up form, so this records the same consent and name it asks for.
export async function giveConsent(input: ConsentInput): Promise<ConsentResult> {
  const parsed = consentSchema.safeParse(input);
  if (!parsed.success) return { fieldErrors: toFieldErrors<ConsentInput>(parsed.error.issues) };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // 1. The record: profiles.consent_at, consent_version and the name, written by
  //    the record_consent database function (users can't write them directly).
  const { error: consentError } = await supabase.rpc("record_consent", {
    name: parsed.data.displayName,
    version: CONSENT_VERSION,
  });
  if (consentError) {
    console.error("record_consent failed", consentError.code, consentError.message);
    return { formError: SOMETHING_WRONG };
  }

  // 2. The same facts on the login data, which the proxy checks quickly on
  //    every request. If this fails, the profile already holds the consent, so
  //    the pages still let the user in.
  const { error } = await supabase.auth.updateUser({
    data: {
      display_name: parsed.data.displayName,
      consent_at: new Date().toISOString(),
      consent_version: CONSENT_VERSION,
    },
  });
  if (error) console.error("giveConsent updateUser failed", error.code, error.message);
  redirect("/dashboard");
}
