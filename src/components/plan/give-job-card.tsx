import { ChevronRight, CreditCard, PiggyBank, Wallet } from "lucide-react";
import Link from "next/link";
import { formatPeso } from "@/lib/money";
import type { AssignDestination } from "@/lib/plan-periods";
import { potProgress } from "@/lib/pots";

const percent = new Intl.NumberFormat("en-PH", { style: "percent", maximumFractionDigits: 0 });

// The desktop side card "Give ₱8,800 a job" (plan.md §4, task 6f): three
// shortcuts that open Give leftover a job with that choice filled in. The
// pot is the first one with a target that isn't full; the debt, the earliest
// with something owed. A shortcut without a pot or debt is left out.
export function GiveJobCard({
  notAssigned,
  assignHref,
  pot,
  debt,
}: {
  notAssigned: number;
  /** /plan/assign?start=… */
  assignHref: string;
  pot: Extract<AssignDestination, { kind: "pot" }> | null;
  debt: Extract<AssignDestination, { kind: "debt" }> | null;
}) {
  const rows = [
    pot && {
      href: `${assignHref}&preset=pot`,
      Icon: PiggyBank,
      title: `Top up ${pot.name}`,
      detail: pot.target ? `${percent.format(potProgress(pot.balance, pot.target) ?? 0)} full` : `${formatPeso(pot.balance)} saved`,
    },
    debt && { href: `${assignHref}&preset=debt`, Icon: CreditCard, title: `Pay extra on ${debt.name}`, detail: `${formatPeso(debt.left)} owed` },
    { href: `${assignHref}&preset=buffer`, Icon: Wallet, title: "Keep as buffer", detail: "Carries over" },
  ].filter((r) => r != null);

  return (
    <section aria-labelledby="give-job-title" className="flex flex-col gap-3 rounded-2xl border-[1.5px] border-line bg-surface p-5">
      <div className="flex flex-col gap-1">
        <h2 id="give-job-title" className="font-display text-lg font-semibold text-ink">
          Give {formatPeso(notAssigned)} a job
        </h2>
        <p className="text-sm text-text-2">Money without a plan tends to disappear. Put it somewhere useful.</p>
      </div>
      <ul className="flex flex-col divide-y divide-line-soft">
        {rows.map(({ href, Icon, title, detail }) => (
          <li key={href}>
            <Link
              href={href}
              className="flex min-h-14 items-center gap-3 rounded-md py-2 outline-link hover:bg-bg focus-visible:outline-2"
            >
              <span aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-mint text-green-800">
                <Icon size={20} />
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate font-extrabold text-ink">{title}</span>
                <span className="text-[13px] text-text-3">{detail}</span>
              </span>
              <ChevronRight aria-hidden size={18} className="shrink-0 text-text-3" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
