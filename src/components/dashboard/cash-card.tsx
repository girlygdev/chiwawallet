import { OpenAddSheetButton } from "@/components/transactions/add-transaction-provider";
import { formatPeso } from "@/lib/money";
import type { DashboardNumbers, perDay } from "@/lib/money";
import { formatShortDate } from "@/lib/periods";

/** A source due this period and not logged yet, for the pay prompt. */
export type DuePay = { id: string; name: string; amount: number; payday: string };

// The Dashboard's hero (dashboard.md §2.2, one sticker per area): Safe to
// spend (6c) = cash now − what's still due this period, with the per-day
// pill, the spend bar, the pay prompt, and Carry-in · Income · Cash now.
// All the numbers come from lib/money.ts on the server.
export function CashCard({
  numbers,
  safe,
  stillDue,
  daily,
  due,
  today,
}: {
  numbers: DashboardNumbers;
  /** Safe to spend; can be below ₱0. */
  safe: number;
  /** This period's unpaid bills, savings, debts and one-offs. */
  stillDue: number;
  daily: ReturnType<typeof perDay>;
  due: DuePay | null;
  today: string;
}) {
  const percent = Math.round(numbers.spentShare * 100);
  return (
    <section
      aria-labelledby="cash-title"
      className="flex flex-col gap-4 rounded-xl border-2 border-sticker bg-green-700 p-5 text-white shadow-sticker"
    >
      <div className="flex flex-col gap-1">
        <h2 id="cash-title" className="text-sm font-bold opacity-90">
          Safe to spend
        </h2>
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {/* A minus sign when it's below ₱0 (formatPeso), and the card stays green. */}
          <span className="font-display text-[44px] leading-none font-semibold">{formatPeso(safe)}</span>
          {daily.kind === "per_day" ? (
            <span className="rounded-full bg-green-800 px-2.5 py-1 text-[13px] font-extrabold text-mint">
              {formatPeso(daily.amount)} / day
            </span>
          ) : (
            <span className="rounded-full bg-bad-bg px-2.5 py-1 text-[13px] font-extrabold text-bad-fg">
              Over by {formatPeso(daily.amount)}
            </span>
          )}
        </p>
        <p className="text-sm opacity-90">
          {stillDue > 0
            ? `After ${formatPeso(stillDue)} in bills, savings and debts still due this period.`
            : "Nothing planned is still due this period."}
        </p>
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

      {/* Three small stats (dashboard.md §2): Carry-in · Income · Cash now. */}
      <dl className="grid grid-cols-3 gap-2 border-t border-white/20 pt-3">
        <Stat label="Carry-in" value={numbers.carryIn} />
        <Stat label="Income" value={numbers.income} />
        <Stat label="Cash now" value={numbers.cashNow} />
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
