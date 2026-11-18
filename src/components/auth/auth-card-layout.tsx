import { ChevronLeft, Mail } from "lucide-react";
import Link from "next/link";
import { Logo, Wordmark } from "./logo";

const backLinkClass =
  "font-extrabold text-link outline-link hover:text-link-hover focus-visible:outline-2";

// Centered-card auth layout (auth-screens.md §2) for Forgot password,
// Check your email and Set new password.
// Mobile: full screen on `bg`, a back arrow at the top left.
// Desktop (1024px+): mint page, logo + wordmark on top, one white sticker card
// (the hero element of this screen), and "Back to log in" under it.
// `back={false}`: no back arrow on mobile (Set new password starts with the logo instead).
export function AuthCardLayout({
  children,
  back = true,
}: {
  children: React.ReactNode;
  back?: boolean;
}) {
  return (
    <div className="flex flex-1 flex-col bg-bg lg:items-center lg:justify-center lg:bg-mint lg:px-6 lg:py-12">
      <div className="hidden items-center gap-3 lg:mb-8 lg:flex">
        <Logo size={48} decorative />
        <Wordmark className="text-[24px]" />
      </div>

      <main
        className={`flex flex-1 flex-col px-6 pb-7 lg:w-full lg:max-w-[460px] lg:flex-none lg:rounded-xl lg:border-2 lg:border-sticker lg:bg-surface lg:p-8 lg:shadow-sticker-lg ${back ? "pt-5" : "pt-10"}`}
      >
        {back && (
          <Link
            href="/login"
            aria-label="Back to log in"
            className="-ml-3 mb-2 flex size-11 items-center justify-center rounded-sm text-ink outline-link focus-visible:outline-2 lg:hidden"
          >
            <ChevronLeft aria-hidden="true" className="size-6" />
          </Link>
        )}
        {children}
      </main>

      <Link href="/login" className={`mt-6 hidden lg:block ${backLinkClass}`}>
        Back to log in
      </Link>
    </div>
  );
}

// Logo on a 112px mint tile with 32px corners (Forgot password header).
// Decorative: the page title right below names the screen.
export function TileMascot() {
  return (
    <div className="mx-auto flex size-28 items-center justify-center rounded-[32px] bg-mint">
      <Logo size={84} decorative />
    </div>
  );
}

// Logo on a mint circle with a white mail badge (Check your email header).
// The heading below names the screen, so the art is decorative.
export function MailMascot() {
  return (
    <div className="relative mx-auto flex size-[168px] items-center justify-center rounded-full bg-mint">
      <Logo size={116} decorative />
      <span className="absolute right-2 bottom-2 flex size-[52px] items-center justify-center rounded-full border-[3px] border-ink bg-surface text-link">
        <Mail aria-hidden="true" className="size-6" strokeWidth={2.25} />
      </span>
    </div>
  );
}
