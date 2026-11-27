"use client";

import { Menu } from "@base-ui/react/menu";
import { Ellipsis } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { addStarterPlan } from "@/app/(app)/plan/actions";
import { useShowToast } from "@/app/(app)/plan/plan-item-sheet";
import { CATEGORIES_HREF } from "@/lib/categories";

const ITEM =
  "flex min-h-11 cursor-pointer items-center rounded-md px-3 text-[15px] font-bold text-ink outline-none select-none data-highlighted:bg-mint";

// The Plan options menu (plan.md §3, moved to 5g-2): Set a budget, Plan a
// debt payment, Use starter plan and Edit spending budgets. Base UI's Menu
// gives it the menu role, arrow keys, Esc and focus return. "Period
// settings" isn't designed yet, so it isn't here.
export function PlanOptionsMenu({
  periodStart,
  hasDebts,
  canUseStarter,
}: {
  /** The period being viewed (not ended). */
  periodStart: string;
  /** Any debt not paid off: offers Plan a debt payment. */
  hasDebts: boolean;
  /** A starter group is missing and pay is expected: offers Use starter plan. */
  canUseStarter: boolean;
}) {
  const router = useRouter();
  const showToast = useShowToast();
  const [, startTransition] = useTransition();
  const sheet = (kind: string) => `/plan?start=${periodStart}&add=${kind}`;

  const applyStarter = () =>
    startTransition(async () => {
      const result = await addStarterPlan(periodStart);
      router.refresh();
      showToast({ id: Date.now(), text: result.ok ? "Starter plan added" : (result.formError ?? "Couldn't add it.") });
    });

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
            {canUseStarter && (
              <Menu.Item onClick={applyStarter} className={ITEM}>
                Use starter plan
              </Menu.Item>
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
