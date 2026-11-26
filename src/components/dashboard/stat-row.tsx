import type { ReactNode } from "react";
import { type DashboardNumbers, formatPeso, type perDay } from "@/lib/money";
import { cn } from "@/lib/utils";

// The Dashboard's desktop stat row (dashboard.md §3, task 7c): Safe to spend
// (the area's one sticker), Money out so far, This period's money and Still
// due, in an auto-fit grid. Phones show the Cash card instead. Every number
// and line comes from lib/ on the server; the bar only draws spentShare.
export function StatRow({
  numbers,
  safe,
  daily,
  periodLine,
  stillDue,
  dueLine,
}: {
  numbers: DashboardNumbers;
  /** Safe to spend; can be below ₱0. */
  safe: number;
  daily: ReturnType<typeof perDay>;
  /** periodMoneyLine(): "₱25,000 income + ₱5,000 carried in". */
  periodLine: string;
  stillDue: number;
  /** stillDueBreakdown(): "1 bill, 1 debt, 1 savings transfer". */
  dueLine: string;
}) {
  const percent = Math.round(numbers.spentShare * 100);
  return (
    <section aria-label="This period's numbers" className="hidden lg:block">
      {/* 2 × 2 on narrow desktops, so it never wraps 3 + 1; the spec's auto-fit from 1280px. */}
      <ul className="grid grid-cols-2 gap-4 xl:grid-cols-[repeat(auto-fit,minmax(210px,1fr))]">
        <Stat
          label="Safe to spend"
          value={safe}
          className="border-2 border-sticker bg-green-700 text-white shadow-sticker"
          labelClass="opacity-90"
        >
          {daily.kind === "per_day" ? (
            <span className="opacity-90">
              {formatPeso(daily.amount)} a day for {daily.days} {daily.days === 1 ? "day" : "days"}
            </span>
          ) : (
            <span className="self-start rounded-full bg-bad-bg px-2 py-0.5 font-extrabold text-bad-fg">Over by {formatPeso(daily.amount)}</span>
          )}
        </Stat>
        <Stat label="Money out so far" value={numbers.moneyOut}>
          {/* The text says the same, so the bar is decorative. */}
          <span aria-hidden className="block h-2 overflow-hidden rounded-full bg-track">
            <span className="block h-full rounded-full bg-gold" style={{ width: `${percent}%` }} />
          </span>
          <span className="text-text-3">
            {percent}% of {formatPeso(numbers.periodMoney)}
          </span>
        </Stat>
        <Stat label="This period's money" value={numbers.periodMoney}>
          <span className="text-text-3">{periodLine}</span>
        </Stat>
        <Stat label="Still due" value={stillDue}>
          <span className="text-text-3">{dueLine}</span>
        </Stat>
      </ul>
    </section>
  );
}

function Stat({
  label,
  value,
  className = "border-[1.5px] border-line bg-surface text-ink",
  labelClass = "text-text-3",
  children,
}: {
  label: string;
  value: number;
  className?: string;
  labelClass?: string;
  children: ReactNode;
}) {
  return (
    <li className={cn("flex flex-col gap-2 rounded-[20px] p-[18px]", className)}>
      <span className={cn("text-[13px] font-extrabold", labelClass)}>{label}</span>
      <span className="font-display text-[32px] leading-none font-semibold">{formatPeso(value)}</span>
      <span className="flex flex-col gap-1.5 text-[13px] font-bold">{children}</span>
    </li>
  );
}
