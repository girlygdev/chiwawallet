import { Lock } from "lucide-react";
import Link from "next/link";
import { EMPTY_BUTTON, EmptyCard } from "@/components/dashboard/empty-card";
import { formatPeso } from "@/lib/money";
import type { potCardLine } from "@/lib/pots";
import { cn } from "@/lib/utils";

export type PotCard = {
  id: string;
  name: string;
  balance: number;
  target: number | null;
  line: ReturnType<typeof potCardLine>;
  /** potPeriodLine(): "+₱3,000 this period", "₱2,000 planned this period", or none. */
  period: string | null;
};

// The Dashboard's Savings pots (dashboard.md §2.5 and "Pot card", task 7a):
// one card per pot with its balance, an 8px bar and "43% of ₱30,000"; "No
// target" (no bar) without one; a locked pot shows a lock, a full line-dash
// bar and "Locked savings". On phones they scroll sideways, 150–160px each.
// Desktop (dashboard.md §3, 7c): one card in the side column, a row per pot
// with "₱13,000 / ₱30,000" and its period line; locked pots share one
// compact `bg` row at the bottom; the link reads Manage.
export function PotsCard({ pots }: { pots: PotCard[] }) {
  const open = pots.filter((p) => !p.line.locked);
  const locked = pots.filter((p) => p.line.locked);
  // No pots yet (dashboard.md §4): the empty card on desktop only; phones
  // leave the section out.
  if (pots.length === 0) {
    return (
      <section aria-labelledby="pots-title" className="hidden flex-col gap-2 lg:flex">
        <h2 id="pots-title" className="flex min-h-11 items-center text-[13px] font-extrabold tracking-wide text-text-3 uppercase">
          Savings pots
        </h2>
        <EmptyCard
          title="No pots yet"
          action={
            <Link href="/savings?add=1" className={EMPTY_BUTTON}>
              Create a pot
            </Link>
          }
        >
          Most people start with an emergency fund of 3 to 6 months of needs.
        </EmptyCard>
      </section>
    );
  }
  return (
    <section aria-labelledby="pots-title" className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h2 id="pots-title" className="text-[13px] font-extrabold tracking-wide text-text-3 uppercase">
          Savings pots
        </h2>
        <Link href="/savings" className="flex min-h-11 items-center px-1 text-sm font-extrabold text-link outline-link focus-visible:outline-2">
          <span className="lg:hidden">See all</span>
          <span className="hidden lg:inline">Manage</span>
        </Link>
      </div>
      <ul className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1 md:mx-0 md:grid md:grid-cols-2 md:overflow-visible md:px-0 lg:hidden">
        {pots.map((p) => (
          <li key={p.id} className="w-[155px] shrink-0 md:w-auto">
            <Link
              href={`/savings/details?id=${p.id}`}
              className="flex h-full flex-col gap-2 rounded-2xl border-[1.5px] border-line bg-surface p-4 outline-link hover:bg-bg focus-visible:outline-2"
            >
              <span className="flex items-center gap-1.5">
                {p.line.locked && <Lock aria-hidden size={14} className="shrink-0 text-text-3" />}
                <span className="truncate text-sm font-extrabold text-ink">{p.name}</span>
              </span>
              <span className="font-display text-[22px] leading-none font-semibold text-ink">{formatPeso(p.balance)}</span>
              {p.line.share != null && (
                // The text below says the same, so the bar is decorative.
                <span aria-hidden className="block h-2 overflow-hidden rounded-full bg-track">
                  <span
                    className={cn("block h-full rounded-full", p.line.locked ? "bg-line-dash" : "bg-green-500")}
                    style={{ width: `${p.line.share * 100}%` }}
                  />
                </span>
              )}
              <span className="text-[13px] text-text-3">{p.line.text}</span>
            </Link>
          </li>
        ))}
      </ul>

      <div className="hidden flex-col rounded-2xl border-[1.5px] border-line bg-surface p-2 lg:flex">
        {open.length > 0 && (
          <ul className="flex flex-col">
            {open.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/savings/details?id=${p.id}`}
                  className="flex flex-col gap-1.5 rounded-[14px] px-3 py-2.5 outline-link hover:bg-bg focus-visible:outline-2"
                >
                  <span className="flex items-baseline justify-between gap-3">
                    <span className="truncate text-sm font-extrabold text-ink">{p.name}</span>
                    <span className="shrink-0 text-sm font-bold text-ink">
                      {formatPeso(p.balance)}
                      {p.target != null && <span className="text-text-3"> / {formatPeso(p.target)}</span>}
                    </span>
                  </span>
                  {p.line.share != null && (
                    <span aria-hidden className="block h-2 overflow-hidden rounded-full bg-track">
                      <span className="block h-full rounded-full bg-green-500" style={{ width: `${p.line.share * 100}%` }} />
                    </span>
                  )}
                  <span className="flex justify-between gap-3 text-[13px] text-text-3">
                    <span>{p.line.text}</span>
                    {p.period && <span className="font-bold text-link-hover">{p.period}</span>}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        {locked.length > 0 && (
          <ul className="flex flex-col gap-1 rounded-[14px] bg-bg p-1">
            {locked.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/savings/details?id=${p.id}`}
                  className="flex min-h-11 items-center gap-2 rounded-[10px] px-2.5 text-sm outline-link hover:bg-surface focus-visible:outline-2"
                >
                  <Lock aria-hidden size={14} className="shrink-0 text-text-3" />
                  <span className="min-w-0 flex-1 truncate font-extrabold text-ink">{p.name}</span>
                  <span className="shrink-0 font-bold text-ink">{formatPeso(p.balance)}</span>
                  <span className="shrink-0 text-[13px] text-text-3">{p.period ?? p.line.text}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
