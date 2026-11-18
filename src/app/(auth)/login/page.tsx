import type { Metadata } from "next";
import Link from "next/link";
import { AuthSplitLayout } from "@/components/auth/auth-split-layout";
import { Logo } from "@/components/auth/logo";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Log in · Chiwawallet" };

const linkClass =
  "font-extrabold text-link outline-link hover:text-link-hover focus-visible:outline-2";

export default function LoginPage() {
  return (
    <AuthSplitLayout>
      <header className="mb-5 flex flex-col items-center gap-3 text-center lg:mb-8 lg:items-start lg:text-left">
        {/* On desktop the pitch panel already shows the logo. The title names the
            screen, and "Chiwawallet" isn't in it, so the logo keeps its alt text. */}
        <Logo size={88} className="lg:hidden" />
        <div>
          <h1 className="font-display text-[30px] leading-[1.1] font-semibold text-ink">
            Welcome back
          </h1>
          <p className="mt-1.5 text-[15px] text-text-3">Log in to plan your next payday.</p>
        </div>
      </header>

      <LoginForm />

      {/* Week 8: "Just looking? Try the demo" goes here once the demo account exists. */}

      <footer className="mt-auto flex flex-col items-center gap-3 pt-8 text-center lg:mt-8">
        <p className="text-[15px] text-ink">
          New here?{" "}
          <Link href="/signup" className={linkClass}>
            Create an account
          </Link>
        </p>
        <p className="text-xs text-text-3">
          <Link href="/privacy" className="outline-link hover:text-ink focus-visible:outline-2">
            Privacy Notice
          </Link>
          <span aria-hidden="true"> · </span>
          <Link href="/terms" className="outline-link hover:text-ink focus-visible:outline-2">
            Terms
          </Link>
        </p>
      </footer>
    </AuthSplitLayout>
  );
}
