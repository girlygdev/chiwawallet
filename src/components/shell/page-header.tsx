import { ArrowLeft, Plus } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { Logo } from "@/components/auth/logo";
import { getCurrentProfile } from "@/lib/current-profile";
import { AddTransactionButton } from "@/components/transactions/add-transaction-provider";
import { getGreeting } from "@/lib/greeting";

// How the header looks on mobile (app-shell.md §3):
// - "greeting": logo + "Good afternoon," and the name (Dashboard)
// - "title": the page title only (Plan, Activity, More: the bottom-bar tabs)
// - { backHref }: a back arrow + the page title (pages reached through More)
type MobileStyle = "greeting" | "title" | { backHref: string; backLabel: string };

type PageHeaderProps = {
  title: string;
  mobile: MobileStyle;
  /** A different desktop h1, e.g. "Income sources" (income.md §3). */
  desktopTitle?: string;
  /** Replaces the greeting line above the desktop title, e.g. the pay schedule. */
  eyebrow?: string;
  /** A button on the right of the mobile header, e.g. a + sticker. */
  mobileAction?: React.ReactNode;
  /** Replaces the desktop "Add transaction" button. */
  desktopAction?: React.ReactNode;
};

export function PageHeader({ title, mobile, desktopTitle, eyebrow, mobileAction, desktopAction }: PageHeaderProps) {
  return (
    <>
      {/* Only one of these two is displayed at a time, so there's one h1 on screen. */}
      <MobileHeader title={title} mobile={mobile} action={mobileAction} />
      <DesktopHeader title={desktopTitle ?? title} eyebrow={eyebrow} action={desktopAction} />
    </>
  );
}

function MobileHeader({ title, mobile, action }: { title: string; mobile: MobileStyle; action?: React.ReactNode }) {
  if (mobile === "greeting") {
    return (
      <header className="flex min-h-[52px] items-center gap-3 md:hidden">
        <Logo size={40} decorative />
        <div>
          <h1 className="sr-only">{title}</h1>
          <Suspense fallback={<GreetingSkeleton />}>
            <MobileGreeting />
          </Suspense>
        </div>
      </header>
    );
  }

  if (mobile === "title") {
    return (
      <header className="flex min-h-11 items-center justify-between gap-3 md:hidden">
        <h1 className="font-display text-[28px] leading-[1.15] font-semibold text-ink">{title}</h1>
        {action}
      </header>
    );
  }

  return (
    <header className="flex items-center gap-1 md:hidden">
      <Link
        href={mobile.backHref}
        aria-label={mobile.backLabel}
        className="-ml-2.5 flex size-11 items-center justify-center rounded-md text-ink outline-link focus-visible:outline-2"
      >
        <ArrowLeft aria-hidden size={24} />
      </Link>
      <h1 className="font-display text-[24px] leading-[1.15] font-semibold text-ink">{title}</h1>
      {action && <div className="ml-auto">{action}</div>}
    </header>
  );
}

async function MobileGreeting() {
  const profile = await getCurrentProfile();
  return (
    <p className="leading-tight">
      <span className="block text-sm font-bold text-text-3">{getGreeting(new Date())},</span>
      <span className="block font-display text-xl font-semibold text-ink">
        {profile?.display_name ?? "there"}
      </span>
    </p>
  );
}

function DesktopHeader({ title, eyebrow, action }: { title: string; eyebrow?: string; action?: React.ReactNode }) {
  return (
    <header className="hidden flex-wrap items-end justify-between gap-4 md:flex">
      <div>
        {eyebrow ? (
          <p className="text-sm font-bold text-text-3">{eyebrow}</p>
        ) : (
          <Suspense fallback={<GreetingSkeleton />}>
            <DesktopGreeting />
          </Suspense>
        )}
        <h1 className="font-display text-[30px] leading-[1.15] font-semibold text-ink">{title}</h1>
      </div>
      {action ?? <AddTransactionButton variant="header" />}
    </header>
  );
}

/** The desktop header's one sticker button: "+ Add transaction", "+ Add income source". */
export function HeaderStickerLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      scroll={false}
      className="flex h-[50px] items-center gap-2 rounded-[14px] border-2 border-sticker bg-green-500 px-5 text-[15px] font-extrabold text-white shadow-sticker-sm outline-link focus-visible:outline-2 focus-visible:outline-offset-2"
    >
      <Plus aria-hidden size={20} strokeWidth={2.5} />
      {children}
    </Link>
  );
}

async function DesktopGreeting() {
  const profile = await getCurrentProfile();
  const name = profile?.display_name;
  return (
    <p className="text-sm font-bold text-text-3">
      {getGreeting(new Date())}
      {name ? `, ${name}` : ""}
    </p>
  );
}

function GreetingSkeleton() {
  return <span aria-hidden className="block h-5 w-36 rounded bg-track" />;
}
