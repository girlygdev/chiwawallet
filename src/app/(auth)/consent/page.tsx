import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AuthCardLayout } from "@/components/auth/auth-card-layout";
import { Logo } from "@/components/auth/logo";
import { hasConsented } from "@/lib/auth/consent";
import { createClient } from "@/lib/supabase/server";
import { logOut } from "../actions";
import { ConsentForm } from "./consent-form";

export const metadata: Metadata = { title: "One last thing · Chiwawallet" };

// One-time step after a first Google sign-in (decided Nov 18): Google users
// skip the sign-up form, so they give consent and a name here.
export default function ConsentPage() {
  return (
    <AuthCardLayout back={false}>
      <div className="flex flex-col gap-5">
        <header className="flex flex-col items-center gap-3 text-center">
          <Logo size={88} className="lg:hidden" />
          <div>
            <h1 className="font-display text-[28px] leading-[1.1] font-semibold text-ink">
              One last thing
            </h1>
            <p className="mt-1.5 text-[15px] text-text-3">
              Before you start budgeting, please check these.
            </p>
          </div>
        </header>
        {/* Cache Components: the session read happens inside <Suspense>. */}
        <Suspense>
          <ConsentForSignedInUser />
        </Suspense>
      </div>
    </AuthCardLayout>
  );
}

async function ConsentForSignedInUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (hasConsented(user)) redirect("/dashboard");

  // Google puts the full name in full_name / name. Suggest just the first name.
  const fullName = (user.user_metadata.full_name ?? user.user_metadata.name ?? "") as string;
  const suggestedName = fullName.trim().split(/\s+/)[0]?.slice(0, 40) ?? "";

  return (
    <>
      <ConsentForm suggestedName={suggestedName} />
      <form action={logOut} className="text-center text-[15px] text-ink">
        Not you?{" "}
        <button
          type="submit"
          className="font-extrabold text-link outline-link hover:text-link-hover focus-visible:outline-2"
        >
          Log out
        </button>
      </form>
    </>
  );
}
