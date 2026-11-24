import { ChevronRight, Shapes } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PlaceholderPage } from "@/components/shell/placeholder-page";
import { CATEGORIES_HREF } from "@/lib/categories";

export const metadata: Metadata = { title: "Settings · Chiwawallet" };

// Built in Week 8 (settings.md). Log out lives here on desktop. Categories
// came early (3h) as a link to the category list; Week 8 replaces it with the
// spec's Categories card (group chips, Manage categories, + New category).
export default function SettingsPage() {
  return (
    <PlaceholderPage
      title="Settings"
      mobile={{ backHref: "/more", backLabel: "Back to More" }}
      showLogOut
    >
      <section aria-labelledby="settings-categories" className="flex w-full max-w-2xl flex-col gap-2">
        <h2 id="settings-categories" className="text-[13px] font-extrabold tracking-wide text-text-3 uppercase">
          Categories
        </h2>
        <Link
          href={CATEGORIES_HREF}
          className="flex min-h-14 items-center gap-3 rounded-2xl border-[1.5px] border-line bg-surface px-3.5 py-3 outline-link hover:bg-bg focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          <span className="flex size-10 shrink-0 items-center justify-center rounded-[12px] bg-mint text-link-hover">
            <Shapes aria-hidden size={20} />
          </span>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="font-extrabold text-ink">Manage categories</span>
            <span className="truncate text-[13px] text-text-3">Names, icons and 50/30/20 groups</span>
          </span>
          <ChevronRight aria-hidden size={20} className="shrink-0 text-text-3" />
        </Link>
      </section>
    </PlaceholderPage>
  );
}
