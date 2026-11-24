import { Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { HeaderStickerLink, PageHeader } from "@/components/shell/page-header";
import { PageShell } from "@/components/shell/page-shell";
import { Skeleton, SkeletonRegion } from "@/components/skeleton";
import { CategoryIconTile } from "@/components/transactions/category-grid";
import { formatPeso } from "@/lib/money";
import { getPeriod, type PaySchedule, type PaySlot, scheduleFromBudget, todayInManila } from "@/lib/periods";
import {
  monthlySavingPlan,
  potBalance,
  potProgress,
  potScheduleLine,
  type PotStatus,
  potStatus,
  potToGo,
  totalSaved,
} from "@/lib/pots";
import { requireAppUser } from "@/lib/require-app-user";
import { createClient } from "@/lib/supabase/server";
import { PotSheet } from "./pot-sheet";
import { PotStatusTag } from "@/components/savings/pot-status-tag";

export const metadata: Metadata = { title: "Savings pots · Chiwawallet" };

const ADD_HREF = "/savings?add=1";

// The Savings screen (savings.md, week-4-tasks.md 4d-1): total saved, then a
// card per pot with its balance, progress and status. New and Edit pot open
// in a sheet (`?add=1`; 4d-2); a card opens the pot's details (4d-3). "Add
// money to a pot" comes with the add sheet's Savings tab (4e).
export default function SavingsPage() {
  return (
    <PageShell>
      {/* Cache Components: the totals come from the database (cookies). */}
      <Suspense fallback={<SavingsSkeleton />}>
        <SavingsContent />
      </Suspense>
    </PageShell>
  );
}

type Pot = {
  id: string;
  name: string;
  icon: string;
  color: string;
  target_amount: number | null;
  target_date: string | null;
  starting_balance: number;
  planned_contribution: number;
  pay_slot: PaySlot;
  is_locked: boolean;
};

async function SavingsContent() {
  const { budget } = await requireAppUser();
  const supabase = await createClient();
  const [potRows, savingRows] = await Promise.all([
    supabase
      .from("savings_pots")
      .select(
        "id, name, icon, color, target_amount, target_date, starting_balance, planned_contribution, pay_slot, is_locked",
      )
      .order("created_at")
      .order("name"),
    // Every live deposit and withdrawal, for the balances (never stored).
    supabase
      .from("transactions")
      .select("pot_id, amount, date, deleted_at")
      .eq("type", "savings")
      .not("pot_id", "is", null)
      .is("deleted_at", null),
  ]);
  for (const result of [potRows, savingRows]) {
    if (result.error) throw new Error(`Couldn't load savings: ${result.error.message}`, { cause: result.error });
  }
  // The pay_slot check constraint allows only these three.
  const pots = potRows.data as Pot[];
  const rows = savingRows.data!;

  const schedule = scheduleFromBudget(budget);
  const today = todayInManila(new Date());
  const period = getPeriod(today, schedule);
  const cards = pots.map((pot) => {
    const potRows = rows.filter((r) => r.pot_id === pot.id);
    return {
      pot,
      balance: potBalance(pot, potRows),
      // Deposits less withdrawals, without the starting balance: Edit pot's
      // projection adds them to whatever "Already saved" becomes.
      depositsSoFar: potBalance({ starting_balance: 0 }, potRows),
    };
  });
  const saved = totalSaved(cards.map((c) => c.balance));
  // Net deposits this period (savings.md §2 "+₱3,000 this period").
  const thisPeriod = potBalance(
    { starting_balance: 0 },
    rows.filter((r) => r.date >= period.start && r.date <= period.end),
  );
  const plan = monthlySavingPlan(pots, schedule);
  const potCount = pots.length === 1 ? "1 pot" : `${pots.length} pots`;

  return (
    <>
      <PageHeader
        title="Savings pots"
        eyebrow={pots.length > 0 ? `${potCount} · ${formatPeso(plan)} a month planned` : "Money you're saving up"}
        mobile={{ backHref: "/more", backLabel: "Back to More" }}
        mobileAction={
          <Link
            href={ADD_HREF}
            scroll={false}
            aria-label="Add savings pot"
            className="flex size-11 items-center justify-center rounded-[14px] border-2 border-sticker bg-green-500 text-white shadow-sticker-sm outline-link focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            <Plus aria-hidden size={22} strokeWidth={2.5} />
          </Link>
        }
        desktopAction={<HeaderStickerLink href={ADD_HREF}>New pot</HeaderStickerLink>}
      />

      {pots.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          <section aria-label="Savings totals" className="grid gap-3 md:grid-cols-3 md:gap-4">
            {/* The page's one hero: Deep Green, white text, sticker border. */}
            <div className="flex flex-col gap-1 rounded-xl border-2 border-sticker bg-green-700 p-5 text-white shadow-sticker">
              <p className="text-sm font-bold opacity-90">Total saved</p>
              <p className="font-display text-[34px] leading-none font-semibold">{formatPeso(saved)}</p>
              <p className="text-sm opacity-90">
                Across {potCount}
                {thisPeriod !== 0 && ` · ${formatPeso(thisPeriod, { signed: true })} this period`}
              </p>
            </div>
            {/* Desktop's other two stat cards (savings.md §3). */}
            <Stat label="Added this period" value={formatPeso(thisPeriod, { signed: thisPeriod !== 0 })} />
            <Stat label="Monthly saving plan" value={formatPeso(plan)} />
          </section>

          <section aria-labelledby="pots-title" className="flex flex-col gap-3">
            <h2 id="pots-title" className="text-xs font-extrabold tracking-wide text-text-3 uppercase">
              Your pots
            </h2>
            <ul className="grid gap-3 lg:grid-cols-2">
              {cards.map((card) => (
                <li key={card.pot.id}>
                  <PotCard
                    pot={card.pot}
                    balance={card.balance}
                    status={potStatus(card.pot, card.balance, schedule, today)}
                    schedule={schedule}
                  />
                </li>
              ))}
            </ul>
          </section>
        </>
      )}

      <PotSheet
        pots={cards.map(({ pot, depositsSoFar }) => ({ ...pot, depositsSoFar }))}
        schedule={schedule}
        today={today}
      />
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="hidden flex-col gap-1 rounded-xl border-[1.5px] border-line bg-surface p-4 md:flex">
      <p className="text-[13px] font-bold text-text-3">{label}</p>
      <p className="font-display text-[22px] leading-none font-semibold text-ink">{value}</p>
    </div>
  );
}

const percent = new Intl.NumberFormat("en-PH", { style: "percent", maximumFractionDigits: 0 });

// A pot card (savings.md §2): a link to the pot's details, named by its name
// and balance (§6). Progress has text next to it, not only the bar.
function PotCard({ pot, balance, status, schedule }: { pot: Pot; balance: number; status: PotStatus; schedule: PaySchedule }) {
  const progress = potProgress(balance, pot.target_amount);
  return (
    <Link
      href={`/savings/details?id=${pot.id}`}
      className="flex flex-col gap-3 rounded-2xl border-[1.5px] border-line bg-surface p-4 outline-link hover:border-line-dash focus-visible:outline-2"
    >
      <span className="flex items-start gap-3">
        <CategoryIconTile icon={pot.icon} color={pot.color} size="md" />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate font-extrabold text-ink">{pot.name}</span>
          <span className="truncate text-[13px] text-text-3">{potScheduleLine(pot, schedule)}</span>
        </span>
        <span className="shrink-0 font-display text-xl font-semibold text-ink">{formatPeso(balance)}</span>
      </span>

      {pot.target_amount != null && progress != null ? (
        <span className="flex flex-col gap-1.5">
          <span aria-hidden className="block h-2 overflow-hidden rounded-full bg-track">
            <span className="block h-full rounded-full bg-green-600" style={{ width: `${progress * 100}%` }} />
          </span>
          <span className="flex justify-between gap-2 text-[13px] text-text-2">
            <span>{formatPeso(potToGo(balance, pot.target_amount))} to go</span>
            <span>
              {percent.format(progress)} of {formatPeso(pot.target_amount)}
            </span>
          </span>
        </span>
      ) : (
        pot.is_locked && <span className="text-[13px] text-text-3">No target · long-term savings</span>
      )}

      <PotStatusTag status={status} />
    </Link>
  );
}

function EmptyState() {
  return (
    <section className="flex flex-col items-center gap-3 rounded-2xl border-[1.5px] border-line bg-surface p-8 text-center">
      {/* eslint-disable-next-line @next/next/no-img-element -- static SVG, decorative */}
      <img src="/logo-mark.svg" alt="" width={72} height={72} />
      <h2 className="font-display text-xl font-semibold text-ink">No savings pots yet</h2>
      <p className="max-w-sm text-sm text-text-2">
        Make a pot for each goal, like an emergency fund, a laptop or a trip, and save toward it each payday.
      </p>
      <Link
        href={ADD_HREF}
        scroll={false}
        className="flex h-12 items-center gap-2 rounded-md bg-primary px-5 font-extrabold text-primary-foreground outline-link focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        <Plus aria-hidden size={20} strokeWidth={2.5} />
        New pot
      </Link>
    </section>
  );
}

// The same layout as the real page, in grey.
function SavingsSkeleton() {
  return (
    <SkeletonRegion className="flex flex-col gap-4 md:gap-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-col gap-1.5">
          <Skeleton className="hidden h-4 w-48 md:block" />
          <Skeleton className="h-8 w-44" />
        </div>
        <Skeleton className="size-11 rounded-[14px] md:h-12 md:w-36" />
      </div>
      <div className="grid gap-3 md:grid-cols-3 md:gap-4">
        <Skeleton className="h-[108px] rounded-xl" />
        <Skeleton className="hidden h-[108px] rounded-xl md:block" />
        <Skeleton className="hidden h-[108px] rounded-xl md:block" />
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        <Skeleton className="h-40 rounded-2xl" />
        <Skeleton className="h-40 rounded-2xl" />
      </div>
    </SkeletonRegion>
  );
}
