import { Suspense } from "react";
import { BottomBar } from "@/components/shell/bottom-bar";
import { Sidebar } from "@/components/shell/sidebar";
import { ThemeSync } from "@/components/theme/theme-sync";
import { getCurrentProfile } from "@/lib/current-profile";

// The frame around every logged-in page (app-shell.md): the sidebar from
// 768px up, the bottom bar below that. Each page brings its own header and
// content, and checks the login itself (see requireAppUser).
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 bg-bg">
      <Sidebar />
      {/* Bottom padding = the bottom bar's height, so the last row is never
          hidden behind it on phones. */}
      <div className="flex min-w-0 flex-1 flex-col pb-[calc(84px+env(safe-area-inset-bottom))] md:pb-0">
        {children}
      </div>
      <BottomBar />
      {/* Reads the profile (cookies), so it streams in. */}
      <Suspense>
        <ProfileThemeSync />
      </Suspense>
    </div>
  );
}

// Applies the profile's saved theme on this device (decided Nov 19).
async function ProfileThemeSync() {
  const profile = await getCurrentProfile();
  return profile ? <ThemeSync profileTheme={profile.theme} /> : null;
}
