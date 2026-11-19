"use client";

import { Plus } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  ADD_TRANSACTION_HREF,
  isCurrent,
  MOBILE_TABS_LEFT,
  MOBILE_TABS_RIGHT,
  type NavItem,
} from "./nav-items";

// Mobile bottom bar, under 768px (app-shell.md §1): Home, Plan, the raised +,
// Activity, More. 84px tall plus the iPhone home bar area.
export function BottomBar() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 h-[calc(84px+env(safe-area-inset-bottom))] border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <ul className="grid h-full grid-cols-5 items-center">
        {MOBILE_TABS_LEFT.map((item) => (
          <Tab key={item.href} item={item} current={isCurrent(pathname, item)} />
        ))}
        <li className="flex justify-center">
          {/* The bar's one sticker element. Raised so its top half sits above the bar. */}
          <Link
            href={ADD_TRANSACTION_HREF}
            aria-label="Add transaction"
            className="-mt-[31px] flex size-[62px] items-center justify-center rounded-full border-[3px] border-sticker bg-green-500 text-white shadow-sticker-sm outline-link focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            <Plus aria-hidden size={26} strokeWidth={2.5} />
          </Link>
        </li>
        {MOBILE_TABS_RIGHT.map((item) => (
          <Tab key={item.href} item={item} current={isCurrent(pathname, item)} />
        ))}
      </ul>
    </nav>
  );
}

function Tab({ item, current }: { item: NavItem; current: boolean }) {
  const Icon = item.icon;
  return (
    <li className="flex justify-center">
      <Link
        href={item.href}
        aria-current={current ? "page" : undefined}
        className={cn(
          // min 44×44 tap area; icon above an 11px label
          "flex min-h-11 min-w-11 flex-col items-center justify-center gap-1 rounded-md px-1 text-[11px] outline-link focus-visible:outline-2",
          // text-link is green-600 in light mode and a lighter green in dark mode
          current ? "font-extrabold text-link" : "font-bold text-text-3",
        )}
      >
        <Icon aria-hidden size={24} strokeWidth={2} />
        {item.label}
      </Link>
    </li>
  );
}
