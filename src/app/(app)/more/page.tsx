import type { Metadata } from "next";
import { PlaceholderPage } from "@/components/shell/placeholder-page";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { MoneySection } from "./money-section";

export const metadata: Metadata = { title: "More · Chiwawallet" };

// The mobile hub (more-and-categories.md), built in Week 3. Two parts came
// early (Nov 19): MONEY, so Income is reachable on phones, and Appearance, so
// the theme is easy to switch. Log out lives here on mobile.
export default function MorePage() {
  return (
    <PlaceholderPage title="More" mobile="title" showLogOut>
      <MoneySection />
      <section aria-labelledby="appearance-title" className="flex flex-col gap-2">
        <h2 id="appearance-title" className="text-[13px] font-extrabold tracking-wide text-text-3 uppercase">
          Appearance
        </h2>
        <div className="rounded-2xl border-[1.5px] border-line bg-surface p-4">
          <ThemeToggle variant="labels" saveToProfile />
        </div>
      </section>
    </PlaceholderPage>
  );
}
