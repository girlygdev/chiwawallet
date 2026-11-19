"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { isCurrent, type NavItem, SETTINGS_LINK, SIDEBAR_LINKS } from "./nav-items";

// The lists are imported here rather than passed in: nav items hold icon
// components (functions), which a Server Component can't send to the browser.
const LISTS = { main: SIDEBAR_LINKS, settings: [SETTINGS_LINK] } satisfies Record<string, NavItem[]>;

// The sidebar's links (app-shell.md §2). A client component only because it
// reads the current path to mark the open page.
export function SidebarLinks({ list }: { list: keyof typeof LISTS }) {
  const items = LISTS[list];
  const pathname = usePathname();
  return (
    <ul className="flex flex-col gap-1">
      {items.map((item) => (
        <li key={item.href}>
          <SidebarLink item={item} current={isCurrent(pathname, item)} />
        </li>
      ))}
    </ul>
  );
}

function SidebarLink({ item, current }: { item: NavItem; current: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={current ? "page" : undefined}
      className={cn(
        "flex h-11 items-center gap-3 rounded-[12px] px-3 text-[15px] outline-link focus-visible:outline-2",
        // Current: mint with Forest text. link-hover is Forest in light mode
        // and a light green in dark mode, where mint turns dark.
        current ? "bg-mint font-extrabold text-link-hover" : "font-bold text-text-2 hover:bg-bg",
      )}
    >
      <Icon aria-hidden size={20} strokeWidth={2} />
      {item.label}
    </Link>
  );
}
