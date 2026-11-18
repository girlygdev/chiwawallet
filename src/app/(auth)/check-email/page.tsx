import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AuthCardLayout, MailMascot } from "@/components/auth/auth-card-layout";
import { FormError } from "@/components/auth/form-error";
import { inboxUrlFor } from "@/lib/auth/email-app";
import { getPendingEmail } from "@/lib/auth/pending-email";
import { ResendButton } from "./resend-button";

export const metadata: Metadata = { title: "Check your email · Chiwawallet" };

const linkClass =
  "font-extrabold text-link outline-link hover:text-link-hover focus-visible:outline-2";

// Shared by sign-up and password reset; only the wording changes.
// Cache Components: the cookie and searchParams reads happen inside <Suspense>,
// so the mascot and title render instantly and the rest streams in.
export default function CheckEmailPage({ searchParams }: PageProps<"/check-email">) {
  return (
    <AuthCardLayout>
      <div className="flex flex-col gap-5">
        <MailMascot />
        <h1 className="text-center font-display text-[28px] leading-[1.1] font-semibold text-ink">
          Check your email
        </h1>
        <Suspense>
          <CheckEmailDetails searchParams={searchParams} />
        </Suspense>
      </div>
    </AuthCardLayout>
  );
}

async function CheckEmailDetails({
  searchParams,
}: {
  searchParams: PageProps<"/check-email">["searchParams"];
}) {
  const { error } = await searchParams;
  const linkExpired = error === "link-expired";
  const pending = await getPendingEmail();
  const email = pending?.email;
  const isReset = pending?.purpose === "reset";

  // Nothing to show if we didn't just send a link and no link failed.
  if (!email && !linkExpired) redirect("/signup");

  const inboxUrl = email ? inboxUrlFor(email) : null;

  return (
    <>
      {email && (
        <p className="-mt-3 text-center text-[15px] leading-[1.5] text-text-2">
          We sent a link to <strong className="font-extrabold text-ink">{email}</strong>. Tap it
          to {isReset ? "reset your password" : "confirm your account"}. It expires in 1 hour.
        </p>
      )}

      {linkExpired && (
        <FormError
          message={
            email
              ? "This link has expired. We can send you a new one."
              : "This link has expired or was already used. Try logging in, or sign up again."
          }
        />
      )}

      {email && (
        <>
          {inboxUrl && (
            <a
              href={inboxUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-[54px] w-full items-center justify-center rounded-md bg-primary text-[17px] font-extrabold text-primary-foreground outline-link hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              Open email app
            </a>
          )}
          <ResendButton startReady={linkExpired} />
          <p className="rounded-[12px] bg-warn-bg px-4 py-3 text-[13px] font-semibold text-warn-fg">
            Can&apos;t find it? Check your Spam or Promotions folder.
          </p>
          <p className="text-center text-[15px] text-ink">
            Wrong email?{" "}
            <Link href={isReset ? "/forgot-password" : "/signup"} className={linkClass}>
              Change it
            </Link>
          </p>
        </>
      )}

      {!email && (
        <p className="text-center text-[15px] text-ink">
          <Link href="/login" className={linkClass}>
            Log in
          </Link>{" "}
          or{" "}
          <Link href="/signup" className={linkClass}>
            sign up again
          </Link>
        </p>
      )}
    </>
  );
}
