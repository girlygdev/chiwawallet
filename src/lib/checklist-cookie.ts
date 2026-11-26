import { cookies } from "next/headers";

// Remembers that Get started was dismissed (7d-1, owner Nov 26: a cookie,
// not a column, so no data model change). Per browser: dismissing on a phone
// doesn't hide it on a laptop. The value is the budget's id, so another
// account signing in on the same browser still sees its own card.
const COOKIE = "gs_dismissed";

export async function isChecklistDismissed(budgetId: string): Promise<boolean> {
  return (await cookies()).get(COOKIE)?.value === budgetId;
}

export async function setChecklistDismissed(budgetId: string, dismissed: boolean) {
  const jar = await cookies();
  if (!dismissed) {
    jar.delete(COOKIE);
    return;
  }
  jar.set(COOKIE, budgetId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365, // a year
  });
}
