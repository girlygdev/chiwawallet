import { Pencil } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";
import { DeletePot } from "@/components/savings/delete-pot";
import { PotStatusTag } from "@/components/savings/pot-status-tag";
import { PageHeader } from "@/components/shell/page-header";
import { PageShell } from "@/components/shell/page-shell";
import { Skeleton, SkeletonRegion } from "@/components/skeleton";
import { CategoryIconTile } from "@/components/transactions/category-grid";
import { formatPeso } from "@/lib/money";
import { formatMonthYear, formatShortDate, type PaySlot, scheduleFromBudget, todayInManila } from "@/lib/periods";
import { potBalance, potGoalDate, potProgress, potScheduleLine, potStatus, potToGo } from "@/lib/pots";
import { requireAppUser } from "@/lib/require-app-user";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Savings pot · Chiwawallet" };

type SearchParams = Promise<{ id?: string | string[] }>;

// A pot's details (savings.md §3, mobile fix #4; week-4-tasks.md 4d-3): the
// balance and bar, its plan, what's still needed and the goal date, Edit and
// Delete pot, and its history. One page on every screen size. The id is a
// query string (/savings/details?id=…), not a [id] segment: the app shell
// reads the path, which a dynamic segment would stop the build from
// prerendering. Add money and Withdraw come with the Savings tab (4e).
export default function PotDetailsPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <PageShell>
      {/* Cache Components: the query string and the login are request data. */}
      <Suspense fallback={<PotDetailsSkeleton />}>
        <PotDetails searchParams={searchParams} />
      </Suspense>
    </PageShell>
  );
}

async function PotDetails({ searchParams }: { searchParams: SearchParams }) {
  const { id } = await searchParams;
  if (typeof id !== "string" || !z.uuid().safeParse(id).success) notFound();
  const { budget } = await requireAppUser();
  const supabase = await createClient();
  const [potRows, savingRows] = await Promise.all([
    supabase
      .from("savings_pots")
      .select(
        "id, name, icon, color, target_amount, target_date, starting_balance, planned_contribution, pay_slot, is_locked, created_at",
      )
      .order("name"),
    // Every live deposit and withdrawal: this pot's history, and the other
    // pots' balances for "Move it to…".
    supabase
      .from("transactions")
      .select("id, pot_id, amount, date, note, created_at, deleted_at")
      .eq("type", "savings")
      .not("pot_id", "is", null)
      .is("deleted_at", null)
      .order("date", { ascending: false })
      .order("created_at", { ascending: false }),
  ]);
  for (const result of [potRows, savingRows]) {
    if (result.error) throw new Error(`Couldn't load the pot: ${result.error.message}`, { cause: result.error });
  }
  // The pay_slot check constraint allows only these three.
  const pots = potRows.data!.map((p) => ({ ...p, pay_slot: p.pay_slot as PaySlot }));
  const pot = pots.find((p) => p.id === id);
  // Missing or someone else's (RLS hides it).
  if (!pot) notFound();

  const schedule = scheduleFromBudget(budget);
  const today = todayInManila(new Date());
  const rowsOf = (potId: string) => savingRows.data!.filter((r) => r.pot_id === potId);
  const history = rowsOf(pot.id);
  const balance = potBalance(pot, history);
  const progress = potProgress(balance, pot.target_amount);
  const goal = potGoalDate(pot, balance, schedule, today);
  const destinations = pots
    .filter((p) => p.id !== pot.id)
    .map((p) => ({ id: p.id, name: p.name, balance: potBalance(p, rowsOf(p.id)), target_amount: p.target_amount }));
  const percent = new Intl.NumberFormat("en-PH", { style: "percent", maximumFractionDigits: 0 });

  return (
    <>
      <PageHeader
        title={pot.name}
        eyebrow="Savings pot"
        mobile={{ backHref: "/savings", backLabel: "Back to Savings pots" }}
        desktopAction={
          <Link
            href="/savings"
            className="flex h-11 items-center rounded-md px-3 text-[15px] font-extrabold text-link-hover outline-link focus-visible:outline-2"
          >
            All pots
          </Link>
        }
      />

      <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start">
        <div className="flex flex-col gap-4">
          {/* The page's one hero: the balance (savings.md §3). */}
          <section
            aria-label="Balance"
            className="flex flex-col gap-3 rounded-xl border-2 border-sticker bg-surface p-5 shadow-sticker"
          >
            <div className="flex items-center gap-3">
              <CategoryIconTile icon={pot.icon} color={pot.color} size="lg" />
              <p className="font-display text-[30px] leading-none font-semibold text-ink">
                {formatPeso(balance)}
                {pot.target_amount != null && (
                  <span className="block pt-1 font-sans text-sm font-bold text-text-3">
                    of {formatPeso(pot.target_amount)} · {percent.format(progress ?? 0)}
                  </span>
                )}
              </p>
            </div>
            {progress != null && (
              <span aria-hidden className="block h-2.5 overflow-hidden rounded-full bg-track">
                <span className="block h-full rounded-full bg-green-600" style={{ width: `${progress * 100}%` }} />
              </span>
            )}
            <PotStatusTag status={potStatus(pot, balance, schedule, today)} />
          </section>

          {/* Three facts (savings.md §3). */}
          <dl className="grid grid-cols-3 gap-2 rounded-xl border-[1.5px] border-line bg-surface p-4 text-sm">
            <div className="flex flex-col gap-1">
              <dt className="text-[13px] font-bold text-text-3">Plan</dt>
              <dd className="font-extrabold text-ink">{potScheduleLine(pot, schedule)}</dd>
            </div>
            <div className="flex flex-col gap-1">
              <dt className="text-[13px] font-bold text-text-3">Still needed</dt>
              <dd className="font-extrabold text-ink">
                {pot.target_amount != null ? formatPeso(potToGo(balance, pot.target_amount)) : "No target"}
              </dd>
            </div>
            <div className="flex flex-col gap-1">
              <dt className="text-[13px] font-bold text-text-3">Goal date</dt>
              <dd className="font-extrabold text-ink">{goal ? formatMonthYear(goal) : "—"}</dd>
            </div>
          </dl>

          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/savings?edit=${pot.id}`}
              scroll={false}
              className="flex h-11 items-center gap-2 rounded-md border-[1.5px] border-line bg-surface px-4 font-extrabold text-ink outline-link hover:border-line-dash focus-visible:outline-2"
            >
              <Pencil aria-hidden size={18} />
              Edit pot
            </Link>
            <DeletePot
              pot={{ id: pot.id, name: pot.name, icon: pot.icon, color: pot.color, is_locked: pot.is_locked }}
              balance={balance}
              destinations={destinations}
            />
          </div>
        </div>

        {/* HISTORY (savings.md §3): newest first, ending with the starting balance. */}
        <section aria-labelledby="history-title" className="flex flex-col gap-2">
          <h2 id="history-title" className="text-xs font-extrabold tracking-wide text-text-3 uppercase">
            History
          </h2>
          <ul className="flex flex-col divide-y divide-line-soft rounded-2xl border-[1.5px] border-line bg-surface">
            {history.map((row) => (
              <li key={row.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <span className="flex min-w-0 flex-col">
                  <span className="truncate font-extrabold text-ink">
                    {row.note ?? (row.amount < 0 ? "Withdrawal" : "Deposit")}
                  </span>
                  <span className="text-[13px] text-text-3">{formatShortDate(row.date)}</span>
                </span>
                <span className="shrink-0 font-display text-lg font-semibold text-ink">
                  {formatPeso(row.amount, { signed: true })}
                </span>
              </li>
            ))}
            <li className="flex items-center justify-between gap-3 px-4 py-3">
              <span className="flex min-w-0 flex-col">
                <span className="font-extrabold text-ink">Starting balance</span>
                <span className="text-[13px] text-text-3">{formatShortDate(pot.created_at.slice(0, 10))}</span>
              </span>
              <span className="shrink-0 font-display text-lg font-semibold text-ink">
                {formatPeso(pot.starting_balance, { signed: pot.starting_balance > 0 })}
              </span>
            </li>
          </ul>
        </section>
      </div>
    </>
  );
}

function PotDetailsSkeleton() {
  return (
    <SkeletonRegion className="flex flex-col gap-4 md:gap-6">
      <div className="flex flex-col gap-1.5">
        <Skeleton className="hidden h-4 w-24 md:block" />
        <Skeleton className="h-8 w-48" />
      </div>
      <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="flex flex-col gap-4">
          <Skeleton className="h-40 rounded-xl" />
          <Skeleton className="h-20 rounded-xl" />
          <Skeleton className="h-11 w-56 rounded-md" />
        </div>
        <Skeleton className="h-56 rounded-2xl" />
      </div>
    </SkeletonRegion>
  );
}
