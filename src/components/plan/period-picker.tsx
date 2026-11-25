"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { formatPeriodRange, formatShortDate, type Period } from "@/lib/periods";
import { cn } from "@/lib/utils";

// The Plan's period picker (plan.md §2): a sideways-scrolling row of chips,
// one past period, now, and up to 3 months ahead. The chips are links to
// /plan?start=…; the one being shown has aria-current and the Deep Green
// look. A client component only to scroll that chip into view on open.
export function PeriodPicker({ periods, selected, current }: { periods: Period[]; selected: string; current: string }) {
  const row = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = row.current;
    const chip = container?.querySelector<HTMLElement>("[aria-current]");
    if (!container || !chip) return;
    // Scroll the row only, never the page: centre the chip when it's off screen.
    const left = chip.offsetLeft - container.offsetLeft;
    if (left < container.scrollLeft || left + chip.offsetWidth > container.scrollLeft + container.clientWidth) {
      container.scrollLeft = left - (container.clientWidth - chip.offsetWidth) / 2;
    }
  }, [selected]);

  const nextStart = periods.find((p) => p.start > current)?.start;

  return (
    <nav aria-label="Payday periods">
      <div ref={row} className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:px-0">
        {periods.map((p) => {
          const isSelected = p.start === selected;
          const when = p.start < current ? "past" : p.start === current ? "now" : "ahead";
          const label = when === "past" ? "Past" : when === "now" ? "Now" : p.start === nextStart ? "Next" : "Ahead";
          return (
            <Link
              key={p.start}
              href={`/plan?start=${p.start}`}
              aria-current={isSelected ? "true" : undefined}
              className={cn(
                "flex min-h-11 shrink-0 flex-col justify-center rounded-[14px] px-3.5 py-2 outline-link focus-visible:outline-2 focus-visible:outline-offset-2",
                isSelected
                  ? "border-2 border-sticker bg-green-700 text-white"
                  : when === "past"
                    ? "border-[1.5px] border-line bg-surface text-text-3"
                    : when === "now"
                      ? "border-[1.5px] border-line bg-surface text-ink"
                      : "border-[1.5px] border-dashed border-line-dash bg-surface text-ink",
              )}
            >
              <span className="text-[11px] font-extrabold tracking-wide uppercase">{label}</span>
              {/* Mobile: the range for the period shown, the start date for the others. */}
              <span className="text-sm font-bold whitespace-nowrap">
                <span className={cn(!isSelected && "md:hidden", isSelected && "hidden")}>{formatShortDate(p.start)}</span>
                <span className={cn(!isSelected && "hidden md:inline")}>{formatPeriodRange(p.start, p.end)}</span>
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
