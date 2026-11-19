import Link from "next/link";
import { Suspense } from "react";
import { Logo, Wordmark } from "@/components/auth/logo";
import { ProfileChip, ProfileChipSkeleton } from "./profile-chip";
import { SidebarLinks } from "./sidebar-nav";

// Desktop sidebar, 768px and up (app-shell.md §2): logo, main links, then
// Settings and the profile chip at the bottom. It stays put while the page scrolls.
export function Sidebar() {
  return (
    <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col gap-6 overflow-y-auto border-r border-line bg-surface px-4 py-6 md:flex">
      <Link
        href="/dashboard"
        className="flex items-center gap-2 rounded-md outline-link focus-visible:outline-2"
      >
        {/* The wordmark next to it says the name, so the logo is decorative here. */}
        <Logo size={40} decorative />
        <Wordmark className="text-[22px] leading-none" />
      </Link>

      <nav aria-label="Main" className="flex flex-1 flex-col justify-between gap-6">
        <SidebarLinks list="main" />
        <SidebarLinks list="settings" />
      </nav>
      {/* Reading the profile needs the request's cookies, so it streams in. */}
      <Suspense fallback={<ProfileChipSkeleton />}>
        <ProfileChip />
      </Suspense>
    </aside>
  );
}
