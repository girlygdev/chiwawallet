"use client";

import { useEffect, useRef, useState } from "react";
import { formatPeso } from "@/lib/money";
import { formatPeriodRange } from "@/lib/periods";
import { oneOffImpact } from "@/lib/plan";
import { cn } from "@/lib/utils";

// "Which payday pays for it?" and its impact box, shared by Add one-off item
// (5f) and Plan a debt payment (5g-2): radio cards for the current period
// and up to 3 months ahead, and the chosen period's Not assigned yet before
// → after, fetched per period the way that period's Plan works it out.

/** A payday card: a period the item can be paid from. */
export type PaydayCard = { start: string; end: string; label: "Now" | "Next" | "Ahead" };

/** One radio card per period, NOW first. `children` goes under the cards (a suggestion line). */
export function PaydayCards({
  id,
  cards,
  value,
  onPick,
  error,
  children,
}: {
  id: string;
  cards: PaydayCard[];
  value: string;
  onPick: (start: string) => void;
  error?: string;
  children?: React.ReactNode;
}) {
  const errorId = `${id}-error`;
  return (
    <fieldset className="flex min-w-0 flex-col gap-1.5" aria-describedby={error ? errorId : undefined}>
      <legend className="mb-1.5 text-sm font-bold text-ink">Which payday pays for it?</legend>
      <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 md:-mx-6 md:px-6">
        {cards.map((c) => {
          const checked = c.start === value;
          return (
            <label
              key={c.start}
              className={cn(
                "flex min-h-11 shrink-0 cursor-pointer flex-col justify-center rounded-[14px] px-3.5 py-2 has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-link",
                checked ? "border-2 border-green-600 bg-mint text-ink" : "border-[1.5px] border-line bg-surface text-ink",
              )}
            >
              <input
                type="radio"
                name={id}
                value={c.start}
                checked={checked}
                onChange={() => onPick(c.start)}
                className="sr-only"
              />
              <span className="text-[11px] font-extrabold tracking-wide uppercase">{c.label}</span>
              <span className="text-sm font-bold whitespace-nowrap">{formatPeriodRange(c.start, c.end)}</span>
            </label>
          );
        })}
      </div>
      {children}
      {error && (
        <p id={errorId} className="text-[13px] font-bold text-bad-fg">
          {error}
        </p>
      )}
    </fieldset>
  );
}

/**
 * The chosen period's Not assigned yet: undefined while it loads, null if it
 * couldn't be worked out. Each period is fetched once, when first picked.
 */
export function usePeriodNotAssigned(
  start: string | undefined,
  load: (start: string) => Promise<number | null>,
): number | null | undefined {
  const [byStart, setByStart] = useState<Record<string, number | null>>({});
  const requested = useRef(new Set<string>());
  useEffect(() => {
    if (!start || requested.current.has(start)) return;
    requested.current.add(start);
    load(start)
      .then((n) => setByStart((all) => ({ ...all, [start]: n })))
      .catch((error) => console.error("plan: couldn't load the period's numbers", error));
  }, [start, load]);
  return start ? byStart[start] : undefined;
}

/**
 * The impact box (plan.md §6): "Nov 30 – Dec 14 not assigned: ₱23,200 →
 * ₱20,700", in yellow (never red) with "₱500 more than that period has
 * left" when it goes over. Nothing until an amount is typed.
 */
export function PeriodImpact({
  card,
  before,
  amount,
}: {
  card: PaydayCard | undefined;
  before: number | null | undefined;
  /** Centavos, or null while the amount isn't valid. */
  amount: number | null;
}) {
  const range = card ? formatPeriodRange(card.start, card.end) : "";
  const impact = amount != null && amount > 0 && before != null ? oneOffImpact(before, amount) : null;
  return (
    <div aria-live="polite">
      {impact ? (
        <div
          className={cn(
            "flex flex-col gap-0.5 rounded-[14px] px-4 py-3 text-sm",
            impact.over > 0 ? "bg-cat-yellow-bg text-cat-yellow-fg" : "bg-mint text-link-hover",
          )}
        >
          <p>
            <span className="font-bold">{range} not assigned:</span> {formatPeso(impact.before)} →{" "}
            <span className="font-extrabold">{formatPeso(impact.after)}</span>
          </p>
          <p>
            {impact.over > 0 ? `${formatPeso(impact.over)} more than that period has left.` : "It'll show in that period's plan."}
          </p>
        </div>
      ) : (
        amount != null &&
        amount > 0 &&
        before === undefined && <p className="rounded-[14px] bg-bg px-4 py-3 text-sm text-text-3">Working out {range}…</p>
      )}
    </div>
  );
}
