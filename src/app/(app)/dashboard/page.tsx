import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { logOut } from "@/app/(auth)/actions";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Dashboard · Chiwawallet" };

// Placeholder so sign-up confirmation has somewhere to land.
// The real dashboard comes later.
export default function DashboardPage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-2 px-6 py-10">
      {/* Cache Components: reading the session (cookies) must happen inside
          <Suspense>, so only this part waits for the request. */}
      <Suspense fallback={<p className="text-[15px] text-text-3">Loading…</p>}>
        <Greeting />
      </Suspense>
    </main>
  );
}

async function Greeting() {
  const supabase = await createClient();
  // getUser() asks Supabase to verify the session, so it can't be faked with a cookie.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // The proxy task will do this for every app page; until then, guard here.
  if (!user) redirect("/login");

  const name = (user.user_metadata.display_name as string | undefined) ?? "there";

  return (
    <>
      <h1 className="font-display text-[28px] leading-[1.1] font-semibold text-ink">Hi, {name}!</h1>
      <p className="text-[15px] text-text-3">You&apos;re in. Your dashboard is coming soon.</p>
      {/* A real <form> posting to a Server Action: works even before JavaScript loads.
          Temporary spot; log out moves to Settings with the app shell. */}
      <form action={logOut} className="mt-6">
        <button
          type="submit"
          className="h-[50px] w-full rounded-md border-[1.5px] border-line bg-surface text-base font-bold text-ink outline-link hover:bg-mint focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          Log out
        </button>
      </form>
    </>
  );
}
