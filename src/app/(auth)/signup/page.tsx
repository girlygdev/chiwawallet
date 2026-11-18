import type { Metadata } from "next";
import Link from "next/link";
import { AuthSplitLayout } from "@/components/auth/auth-split-layout";
import { Logo } from "@/components/auth/logo";
import { SignUpForm } from "./signup-form";

export const metadata: Metadata = { title: "Sign up · Chiwawallet" };

export default function SignUpPage() {
  return (
    <AuthSplitLayout compact>
      {/* Mobile: logo beside the title to save height for the form. */}
      <header className="mb-4 flex items-center gap-3.5 lg:mb-8">
        <Logo size={64} className="lg:hidden" />
        <div>
          <h1 className="font-display text-[26px] leading-[1.1] font-semibold text-ink lg:text-[30px]">
            Create your account
          </h1>
          <p className="mt-1 text-sm text-text-3 lg:text-[15px]">
            <span className="lg:hidden">Budget by payday. Free, no card needed.</span>
            <span className="hidden lg:inline">Free, no card needed. Takes about a minute.</span>
          </p>
        </div>
      </header>

      <SignUpForm />

      {/* Week 8: "Just looking? Try the demo" goes here on desktop. */}

      <p className="mt-auto pt-8 text-center text-[15px] text-ink lg:mt-8">
        Already have an account?{" "}
        <Link
          href="/login"
          className="font-extrabold text-link outline-link hover:text-link-hover focus-visible:outline-2"
        >
          Log in
        </Link>
      </p>
    </AuthSplitLayout>
  );
}
