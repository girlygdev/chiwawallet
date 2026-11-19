import type { Metadata } from "next";
import { PlaceholderPage } from "@/components/shell/placeholder-page";
import { ThemeToggle } from "@/components/theme/theme-toggle";

export const metadata: Metadata = { title: "More · Chiwawallet" };

// The mobile hub, built in Week 3 (more-and-categories.md). Log out lives here
// on mobile. Appearance came early (Nov 19) so the theme is easy to switch.
export default function MorePage() {
  return (
    <PlaceholderPage title="More" mobile="title" showLogOut>
      <section aria-labelledby="appearance-title" className="flex flex-col gap-3 rounded-2xl border-[1.5px] border-line bg-surface p-4">
        <h2 id="appearance-title" className="text-xs font-extrabold tracking-wide text-text-3 uppercase">
          Appearance
        </h2>
        <ThemeToggle variant="labels" saveToProfile />
      </section>
    </PlaceholderPage>
  );
}
