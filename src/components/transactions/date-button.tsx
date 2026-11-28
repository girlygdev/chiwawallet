"use client";

import { format, parseISO, subDays } from "date-fns";
import { CalendarDays } from "lucide-react";

/** "Today, Nov 23", "Yesterday, Nov 22" or "Fri, Nov 21". */
export function dateButtonLabel(date: string, today: string): string {
  const day = parseISO(date);
  if (date === today) return `Today, ${format(day, "MMM d")}`;
  if (date === format(subDays(parseISO(today), 1), "yyyy-MM-dd")) return `Yesterday, ${format(day, "MMM d")}`;
  return format(day, "EEE, MMM d");
}

// The Date field (activity.md §3, decided Nov 20): looks like a 46px button
// ("Today, Nov 28") and opens the browser's own date picker. The real
// <input type="date"> lies invisibly on top of it (fixed Nov 28): phones open
// their picker when the input itself is tapped, but ignored the old way of
// opening it from a separate button (showPicker() on a hidden input), so
// tapping did nothing. Desktop browsers only open the picker from the small
// calendar icon, so a mouse click (or Enter) still calls showPicker().
export function DateButton({
  id,
  label = "Date",
  value,
  onChange,
  today,
  min,
  error,
}: {
  id: string;
  /** "Date" (Expense) or "Date received" (Income). */
  label?: string;
  value: string;
  onChange: (date: string) => void;
  today: string;
  min: string;
  error?: string;
}) {
  const errorId = `${id}-error`;

  const openPicker = (e: React.MouseEvent<HTMLInputElement>) => {
    // A tap already opens the phone's picker; asking again could close it.
    if ((e.nativeEvent as PointerEvent).pointerType === "touch") return;
    try {
      e.currentTarget.showPicker();
    } catch {
      // No showPicker() (older browsers): the focused input still takes typing.
    }
  };

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-bold text-ink">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type="date"
          value={value}
          min={min}
          max={today}
          // An empty value (cleared in the picker) keeps the last good date.
          onChange={(e) => e.target.value && onChange(e.target.value)}
          onClick={openPicker}
          aria-label={`${label}: ${dateButtonLabel(value, today)}. Change date`}
          aria-describedby={error ? errorId : undefined}
          // Invisible but on top, covering the look-alike button below. 16px
          // text so iPhones don't zoom in when it's tapped.
          className="peer absolute inset-0 z-10 h-full w-full cursor-pointer appearance-none text-base opacity-0"
        />
        {/* What the field looks like; the input above takes every tap and key. */}
        <div
          aria-hidden
          className="flex h-[46px] items-center gap-2 rounded-md border-[1.5px] border-line bg-surface px-4 text-base font-bold text-ink outline-link peer-focus-visible:outline-2"
        >
          <CalendarDays size={20} className="text-text-2" />
          {dateButtonLabel(value, today)}
        </div>
      </div>
      {error && (
        <p id={errorId} className="text-[13px] font-bold text-bad-fg">
          {error}
        </p>
      )}
    </div>
  );
}
