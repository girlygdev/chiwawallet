import { Suspense } from "react";
import { requireAppUser } from "@/lib/require-app-user";
import { LogOutButton } from "./log-out-button";
import { PageHeader } from "./page-header";
import { PageShell } from "./page-shell";

type HeaderProps = React.ComponentProps<typeof PageHeader>;

// A page inside the app frame that isn't built yet, so every nav link works.
// It still checks the login like a real page would.
export function PlaceholderPage({
  title,
  mobile,
  showLogOut = false,
  children,
}: HeaderProps & { showLogOut?: boolean; children?: React.ReactNode }) {
  return (
    <PageShell>
      <PageHeader title={title} mobile={mobile} />
      {/* Anything already built on a mostly-unbuilt page, e.g. More's Appearance. */}
      {children}
      {/* Cache Components: the login check reads cookies, so it sits in <Suspense>. */}
      <Suspense>
        <PlaceholderBody showLogOut={showLogOut} />
      </Suspense>
    </PageShell>
  );
}

async function PlaceholderBody({ showLogOut }: { showLogOut: boolean }) {
  await requireAppUser();
  return (
    <div className="flex flex-col items-center gap-4 py-12 text-center">
      {/* Decorative: the page title already names the screen */}
      {/* eslint-disable-next-line @next/next/no-img-element -- static SVG, no optimisation needed */}
      <img src="/logo-mark.svg" alt="" width={88} height={88} />
      <p className="text-[15px] text-text-3">This feature will come to you soon.</p>
      {showLogOut && (
        <div className="mt-6 w-full max-w-sm">
          <LogOutButton />
        </div>
      )}
    </div>
  );
}
