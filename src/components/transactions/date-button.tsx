"use client";

import { format, parseISO, subDays } from "date-fns";
import { CalendarDays } from "lucide-react";
import { useRef } from "react";

/** "Today, Nov 23", "Yesterday, Nov 22" or "Fri, Nov 21". */
export function dateButtonLabel(date: string, today: string): string {
  const day = parseISO(date);
  if (date === today) return `Today, ${format(day, "MMM d")}`;
  if (date === format(subDays(parseISO(today), 1), "yyyy-MM-dd")) return `Yesterday, ${format(day, "MMM d")}`;
  return format(day, "EEE, MMM d");
}

// The Date field (activity.md §3, decided Nov 20): a 46px button that opens
// the browser's own date picker. The real <input type="date"> holds the value
// and the min and max; it's visually hidden but still a labelled form field.
// Browsers without showPicker() (older iPhones) get the input focused instead.
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
  const inputRef = useRef<HTMLInputElement>(null);
  const errorId = `${id}-error`;

  const open = () => {
    const input = inputRef.current;
    if (!input) return;
    try {
      input.showPicker();
    } catch {
      input.focus();
    }
  };

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-bold text-ink">
        {label}
      </label>
      <input
        ref={inputRef}
        id={id}
        type="date"
        value={value}
        min={min}
        max={today}
        // An empty value (cleared in the picker) keeps the last good date.
        onChange={(e) => e.target.value && onChange(e.target.value)}
        aria-describedby={error ? errorId : undefined}
        // Out of the Tab order: the button below is the one control, so
        // keyboard users don't land on an invisible field.
        tabIndex={-1}
        className="sr-only"
      />
      <button
        type="button"
        onClick={open}
        // The input is the labelled field; this button only opens its picker.
        aria-label={`${label}: ${dateButtonLabel(value, today)}. Change date`}
        className="flex h-[46px] items-center gap-2 rounded-md border-[1.5px] border-line bg-surface px-4 text-base font-bold text-ink outline-link focus-visible:outline-2"
      >
        <CalendarDays aria-hidden size={20} className="text-text-2" />
        {dateButtonLabel(value, today)}
      </button>
      {error && (
        <p id={errorId} className="text-[13px] font-bold text-bad-fg">
          {error}
        </p>
      )}
    </div>
  );
}
