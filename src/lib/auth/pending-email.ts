import { cookies } from "next/headers";

// Remembers which email we just sent a link to, and why, so Check your email
// can show the address and the right wording, and Resend knows what to send.
// Kept in a short-lived httpOnly cookie instead of the URL, so the address
// doesn't end up in browser history or server logs.
const COOKIE = "pending_email";

export type EmailPurpose = "signup" | "reset";
export type PendingEmail = { email: string; purpose: EmailPurpose };

export async function setPendingEmail(email: string, purpose: EmailPurpose = "signup") {
  (await cookies()).set(COOKIE, JSON.stringify({ email, purpose }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60, // 1 hour, same as the email link
  });
}

export async function getPendingEmail(): Promise<PendingEmail | null> {
  const raw = (await cookies()).get(COOKIE)?.value;
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<PendingEmail>;
    if (typeof value.email !== "string") return null;
    return { email: value.email, purpose: value.purpose === "reset" ? "reset" : "signup" };
  } catch {
    return null; // an old or tampered cookie: treat as "no pending email"
  }
}

export async function clearPendingEmail() {
  (await cookies()).delete(COOKIE);
}
