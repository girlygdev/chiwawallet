import { cookies } from "next/headers";

// Remembers which email we just sent a link to, so Check your email can show it
// and Resend knows where to send. Kept in a short-lived httpOnly cookie instead
// of the URL, so the address doesn't end up in browser history or server logs.
const COOKIE = "pending_email";

export async function setPendingEmail(email: string) {
  (await cookies()).set(COOKIE, email, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60, // 1 hour, same as the email link
  });
}

export async function getPendingEmail() {
  return (await cookies()).get(COOKIE)?.value ?? null;
}

export async function clearPendingEmail() {
  (await cookies()).delete(COOKIE);
}
