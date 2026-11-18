import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthCardLayout, TileMascot } from "@/components/auth/auth-card-layout";
import { FormError } from "@/components/auth/form-error";
import { ForgotPasswordForm } from "./forgot-password-form";

export const metadata: Metadata = { title: "Forgot password · Chiwawallet" };

export default function ForgotPasswordPage({ searchParams }: PageProps<"/forgot-password">) {
  return (
    <AuthCardLayout>
      <div className="flex flex-col gap-5">
        <TileMascot />
        <div className="text-center">
          <h1 className="font-display text-[28px] leading-[1.1] font-semibold text-ink">
            Forgot your password?
          </h1>
          <p className="mt-2 text-[15px] leading-[1.5] text-text-2">
            No worries. Enter the email you signed up with and we&apos;ll send you a link to reset
            it.
          </p>
        </div>
        {/* Cache Components: searchParams is request data, so read it inside <Suspense>. */}
        <Suspense>
          <ExpiredLinkNotice searchParams={searchParams} />
        </Suspense>
        <ForgotPasswordForm />
      </div>
    </AuthCardLayout>
  );
}

// Shown when a reset link was expired or already used (see /auth/reset).
async function ExpiredLinkNotice({
  searchParams,
}: {
  searchParams: PageProps<"/forgot-password">["searchParams"];
}) {
  const { error } = await searchParams;
  if (error !== "link-expired") return null;
  return <FormError message="This link has expired. We can send you a new one." />;
}
