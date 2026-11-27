"use client";

import { Menu } from "@base-ui/react/menu";
import { Ellipsis } from "lucide-react";
import Link from "next/link";
import { CATEGORIES_HREF } from "@/lib/categories";

const ITEM =
  "flex min-h-11 cursor-pointer items-center rounded-md px-3 text-[15px] font-bold text-ink outline-none select-none data-highlighted:bg-mint";

// The Plan options menu (plan.md §3, moved to 5g-2): Set a budget, Plan a
// debt payment, Edit spending budgets and Paydays overview (Use starter plan
// went in 7i). Base UI's Menu
// gives it the menu role, arrow keys, Esc and focus return. "Period
// settings" isn't designed yet, so it isn't here.
export function PlanOptionsMenu({
  periodStart,
  hasDebts,
}: {
  /** The period being viewed (not ended). */
  periodStart: string;
  /** Any debt not paid off: offers Plan a debt payment. */
  hasDebts: boolean;
}) {
  const sheet = (kind: string) => `/plan?start=${periodStart}&add=${kind}`;

  return (
    <Menu.Root>
      <Menu.Trigger
        aria-label="Plan options"
        className="flex size-11 shrink-0 items-center justify-center rounded-full border-[1.5px] border-line bg-surface text-ink outline-link focus-visible:outline-2 focus-visible:outline-offset-2 data-popup-open:bg-mint"
      >
        <Ellipsis aria-hidden size={22} />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner sideOffset={6} align="end" className="z-50">
          <Menu.Popup className="flex min-w-56 flex-col rounded-[14px] border-[1.5px] border-line bg-surface p-1.5 shadow-xl outline-none">
            <Menu.LinkItem render={<Link href={sheet("budget")} scroll={false} />} className={ITEM}>
              Set a budget
            </Menu.LinkItem>
            {hasDebts && (
              <Menu.LinkItem render={<Link href={sheet("debt")} scroll={false} />} className={ITEM}>
                Plan a debt payment
              </Menu.LinkItem>
            )}
            <Menu.LinkItem render={<Link href={CATEGORIES_HREF} />} className={ITEM}>
              Edit spending budgets
            </Menu.LinkItem>
            {/* Every payday to 6 months ahead, read only (7g-1). */}
            <Menu.LinkItem render={<Link href="/plan/paydays" />} className={ITEM}>
              Paydays overview
            </Menu.LinkItem>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}
