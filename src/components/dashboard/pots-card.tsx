import { Lock } from "lucide-react";
import Link from "next/link";
import { formatPeso } from "@/lib/money";
import type { potCardLine } from "@/lib/pots";
import { cn } from "@/lib/utils";

export type PotCard = { id: string; name: string; balance: number; line: ReturnType<typeof potCardLine> };

// The Dashboard's Savings pots (dashboard.md §2.5 and "Pot card", task 7a):
// one card per pot with its balance, an 8px bar and "43% of ₱30,000"; "No
// target" (no bar) without one; a locked pot shows a lock, a full line-dash
// bar and "Locked savings". On phones they scroll sideways, 150–160px each.
export function PotsCard({ pots }: { pots: PotCard[] }) {
  return (
    <section aria-labelledby="pots-title" className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h2 id="pots-title" className="text-[13px] font-extrabold tracking-wide text-text-3 uppercase">
          Savings pots
        </h2>
        <Link href="/savings" className="flex min-h-11 items-center px-1 text-sm font-extrabold text-link outline-link focus-visible:outline-2">
          See all
        </Link>
      </div>
      <ul className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1 md:mx-0 md:grid md:grid-cols-2 md:overflow-visible md:px-0">
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
    </section>
  );
}
