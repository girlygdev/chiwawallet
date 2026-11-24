import { ChevronRight, Shapes } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PlaceholderPage } from "@/components/shell/placeholder-page";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { CATEGORIES_HREF } from "@/lib/categories";
import { MoneySection } from "./money-section";

export const metadata: Metadata = { title: "More · Chiwawallet" };

const HEADING = "text-[13px] font-extrabold tracking-wide text-text-3 uppercase";

// The mobile hub (more-and-categories.md), built in Week 3. Two parts came
// early (Nov 19): MONEY, so Income is reachable on phones, and Appearance, so
// the theme is easy to switch. BUDGET has only Categories so far (3h); Budget
// settings and Budgeting model join it in Week 8. Log out lives here on mobile.
export default function MorePage() {
  return (
    <PlaceholderPage title="More" mobile="title" showLogOut>
      <MoneySection />
      <section aria-labelledby="budget-title" className="flex flex-col gap-2">
        <h2 id="budget-title" className={HEADING}>
          Budget
        </h2>
        <div className="overflow-hidden rounded-2xl border-[1.5px] border-line bg-surface">
          <Link
            href={CATEGORIES_HREF}
            className="flex min-h-14 items-center gap-3 px-3.5 py-3 outline-link hover:bg-bg focus-visible:outline-2 focus-visible:-outline-offset-2"
          >
            <span className="flex size-10 shrink-0 items-center justify-center rounded-[12px] bg-mint text-link-hover">
              <Shapes aria-hidden size={20} />
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="font-extrabold text-ink">Categories</span>
              <span className="truncate text-[13px] text-text-3">Names, icons and 50/30/20 groups</span>
            </span>
            <ChevronRight aria-hidden size={20} className="shrink-0 text-text-3" />
          </Link>
        </div>
      </section>
      <section aria-labelledby="appearance-title" className="flex flex-col gap-2">
        <h2 id="appearance-title" className={HEADING}>
          Appearance
        </h2>
        <div className="rounded-2xl border-[1.5px] border-line bg-surface p-4">
          <ThemeToggle variant="labels" saveToProfile />
        </div>
      </section>
    </PlaceholderPage>
  );
}
