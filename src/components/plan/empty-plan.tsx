import { CreditCard, PiggyBank, Receipt, ShoppingBasket, Sparkles } from "lucide-react";
import Link from "next/link";
import { Logo } from "@/components/auth/logo";
import { formatPeso } from "@/lib/money";
import type { StarterItem, Targets } from "@/lib/plan";
import { cn } from "@/lib/utils";

const TILE: Record<StarterItem["budget_group"], string> = {
  needs: "bg-mint text-ink",
  wants: "bg-cat-yellow-bg text-cat-yellow-fg",
  savings_debt: "bg-cat-blue-bg text-cat-blue-fg",
};

// The empty plan's starter card (plan.md §5), the area's one sticker: the
// budget's split of this payday's pay as three tiles, then `action`: the
// "Use this starter plan" button (5e), left out once the period has ended.
export function StarterCard({
  pay,
  starter,
  targets,
  action,
}: {
  pay: number;
  starter: StarterItem[];
  targets: Targets;
  action?: React.ReactNode;
}) {
  const pct = { needs: targets.needs_pct, wants: targets.wants_pct, savings_debt: targets.savings_debt_pct };
  const split = `${targets.needs_pct}/${targets.wants_pct}/${targets.savings_debt_pct}`;

  return (
    <section
      aria-labelledby="starter-title"
      className="flex flex-col gap-4 rounded-[22px] border-2 border-sticker bg-surface p-[18px] shadow-sticker"
    >
      <div className="flex items-start gap-3">
        <Logo size={48} decorative />
        <div className="flex flex-col gap-0.5">
          <h2 id="starter-title" className="font-display text-xl font-semibold text-ink">
            Your plan is empty
          </h2>
          <p className="text-sm text-text-2">
            {pay > 0
              ? `Start with a ${split} split of your ${formatPeso(pay)} pay, then fine-tune.`
              : "No pay is expected this period. Add income to get a starter split."}
          </p>
        </div>
      </div>

      {starter.length > 0 && (
        <ul className="grid grid-cols-3 gap-2">
          {starter.map((s) => (
            <li key={s.budget_group} className={cn("flex flex-col gap-0.5 rounded-[14px] p-3", TILE[s.budget_group])}>
              <span className="text-xs font-extrabold">{s.name}</span>
              <span className="font-display text-lg leading-tight font-semibold">{formatPeso(s.planned_amount)}</span>
              <span className="text-xs font-bold">{pct[s.budget_group]}%</span>
            </li>
          ))}
        </ul>
      )}

      {starter.length > 0 && action}
    </section>
  );
}

const ROWS = [
  { title: "Bills", sentence: "Electricity, internet, rent. Added once, planned every payday.", action: "Add a bill", href: "/bills?add=1", Icon: Receipt },
  { title: "Debt payments", sentence: "Cards, loans or SPayLater. We schedule each payment.", action: "Add a debt", href: "/debts?add=1", Icon: CreditCard },
  { title: "Savings", sentence: "Pay yourself first. Start with an emergency fund.", action: "Create a pot", href: "/savings?add=1", Icon: PiggyBank },
  // These two open sheets on this period: their addresses are filled in by BuildRows.
  { title: "Spending budgets", sentence: "Limits for food, transport and fun.", action: "Set a budget", href: "budget", Icon: ShoppingBasket },
  { title: "One-off items", sentence: "Gifts, events or fees happening once.", action: "Add one-off", href: "one-off", Icon: Sparkles },
];

// OR BUILD IT YOURSELF (plan.md §5): five rows, each with a tile, a sentence
// and a soft button to where that kind of item is added.
export function BuildRows({ addOneOff, setBudget }: { addOneOff: string | null; setBudget: string | null }) {
  return (
    <section aria-labelledby="build-title" className="flex flex-col gap-2">
      <h2 id="build-title" className="text-[13px] font-extrabold tracking-wide text-text-3 uppercase">
        <span className="md:hidden">Or build it yourself</span>
        <span className="hidden md:inline">Or build your plan piece by piece</span>
      </h2>
      <ul className="flex flex-col divide-y divide-line-soft rounded-2xl border-[1.5px] border-line bg-surface">
        {ROWS.map(({ title, sentence, action, href: rowHref, Icon }) => {
          // Not once the period has ended (both are then empty).
          const href = rowHref === "one-off" ? addOneOff : rowHref === "budget" ? setBudget : rowHref;
          return (
          <li key={title} className="flex items-center gap-3 px-4 py-3">
            <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-[12px] bg-mint text-green-800">
              <Icon size={20} />
            </span>
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="font-extrabold text-ink">{title}</span>
              <span className="text-[13px] text-text-3">{sentence}</span>
            </div>
            {href && (
              <Link
                href={href}
                className="flex min-h-11 shrink-0 items-center rounded-[12px] bg-mint px-3 text-sm font-extrabold text-green-800 outline-link focus-visible:outline-2 focus-visible:outline-offset-2"
              >
                {action}
              </Link>
            )}
          </li>
          );
        })}
      </ul>
    </section>
  );
}
