import { OpenAddSheetButton } from "@/components/transactions/add-transaction-provider";
import { formatPeso } from "@/lib/money";
import type { DashboardNumbers } from "@/lib/money";
import { formatShortDate } from "@/lib/periods";

/** A source due this period and not logged yet, for the pay prompt. */
export type DuePay = { id: string; name: string; amount: number; payday: string };

// The Dashboard's hero (dashboard.md §2.2, one sticker per area). It says
// "Cash now" until Safe to spend exists: Safe to spend is cash now minus
// what's still due, and nothing can be planned as due before Plan (Week 5),
// so the card never claims the bills are covered (owner, Nov 23).
export function CashCard({ numbers, due, today }: { numbers: DashboardNumbers; due: DuePay | null; today: string }) {
  const percent = Math.round(numbers.spentShare * 100);
  return (
    <section
      aria-labelledby="cash-title"
      className="flex flex-col gap-4 rounded-xl border-2 border-sticker bg-green-700 p-5 text-white shadow-sticker"
    >
      <div className="flex flex-col gap-1">
        <h2 id="cash-title" className="text-sm font-bold opacity-90">
          Cash now
        </h2>
        <p className="font-display text-[44px] leading-none font-semibold">{formatPeso(numbers.cashNow)}</p>
        <p className="text-sm opacity-90">What you have on hand after everything you&apos;ve logged.</p>
      </div>

      {due && (
        // The pay prompt (dashboard.md §2): a Forest panel inside the hero.
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-[14px] bg-green-800 px-4 py-3">
          <p className="text-sm font-bold">
            {formatPeso(due.amount)} from {due.name}{" "}
            {due.payday === today ? "is due today." : `was due ${formatShortDate(due.payday)}.`}
          </p>
          <OpenAddSheetButton
            options={{ tab: "income", incomeSource: due.id, amount: due.amount }}
            className="h-10 shrink-0 rounded-[10px] bg-white px-4 text-sm font-extrabold text-green-800 outline-white focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            I got paid
          </OpenAddSheetButton>
        </div>
      )}

      {/* The spend bar: money out ÷ this period's money. The text under it
          says the same, so the bar itself is decorative. */}
      <div className="flex flex-col gap-1.5">
        <div aria-hidden className="h-2.5 overflow-hidden rounded-full bg-green-800">
          <div className="h-full rounded-full bg-gold" style={{ width: `${percent}%` }} />
        </div>
        <p className="flex justify-between gap-3 text-[13px] font-bold">
          <span>{formatPeso(numbers.moneyOut)} out so far</span>
          <span className="opacity-90">of {formatPeso(numbers.periodMoney)}</span>
        </p>
        {/* Money out counts transfers to pots from Week 4; Activity shows
            them apart as To savings, so say why the two differ. */}
        {numbers.toSavings > 0 && (
          <p className="text-[13px] opacity-90">Includes {formatPeso(numbers.toSavings)} put into savings.</p>
        )}
      </div>

      {/* Three small stats. The spec's third is Cash now, which is already
          the big number, so it shows Money out instead. */}
      <dl className="grid grid-cols-3 gap-2 border-t border-white/20 pt-3">
        <Stat label="Carry-in" value={numbers.carryIn} />
        <Stat label="Income" value={numbers.income} />
        <Stat label="Money out" value={numbers.moneyOut} />
      </dl>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col">
      <dt className="text-xs font-bold opacity-90">{label}</dt>
      <dd className="font-display text-lg leading-tight font-semibold">{formatPeso(value)}</dd>
    </div>
  );
}
