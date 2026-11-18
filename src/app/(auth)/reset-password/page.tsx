import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AuthCardLayout } from "@/components/auth/auth-card-layout";
import { Logo } from "@/components/auth/logo";
import { createClient } from "@/lib/supabase/server";
import { SetPasswordForm } from "./set-password-form";

export const metadata: Metadata = { title: "Set a new password · Chiwawallet" };

export default function ResetPasswordPage() {
  return (
    <AuthCardLayout back={false}>
      <div className="flex flex-1 flex-col gap-[18px]">
        <header className="flex flex-col items-center gap-3 text-center">
          {/* Desktop shows the logo above the card instead. */}
          <Logo size={88} className="lg:hidden" />
          <h1 className="font-display text-[28px] leading-[1.1] font-semibold text-ink">
            Set a new password
          </h1>
        </header>
        {/* Cache Components: the session read happens inside <Suspense>. */}
        <Suspense>
          <ResetForSignedInUser />
        </Suspense>
        <p className="mt-auto pt-4 text-center text-[13px] text-text-3">
          This link expires in 1 hour.
        </p>
      </div>
    </AuthCardLayout>
  );
}

// The reset link logged the user in with a recovery session (see /auth/reset).
// Without one, the link was expired or this page was opened directly.
async function ResetForSignedInUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) redirect("/forgot-password?error=link-expired");

  return (
    <>
      {/* Show the email so a mix-up between accounts is easy to spot. */}
      <p className="-mt-2 text-center text-[15px] text-text-2">
        For <strong className="font-extrabold text-ink">{user.email}</strong>
      </p>
      <SetPasswordForm />
    </>
  );
}
