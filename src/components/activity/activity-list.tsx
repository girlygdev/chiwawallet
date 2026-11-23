"use client";

import { Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { inputClassName } from "@/components/auth/text-field";
import { CategoryIconTile } from "@/components/transactions/category-grid";
import {
  type ActivityFilter,
  type ActivityRow,
  dayHeading,
  filterRows,
  rowLabels,
  typeLabel,
} from "@/lib/activity";
import { formatPeso } from "@/lib/money";
import { groupByDay, signedAmount } from "@/lib/transactions";
import { cn } from "@/lib/utils";
import { SEARCH_INPUT_ID, useActivitySearch } from "./search-context";

const CHIPS: { value: ActivityFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "spending", label: "Spending" },
  { value: "income", label: "Income" },
  { value: "savings", label: "Savings" },
];

// The period's rows (activity.md §1–2), filtered in the browser: the whole
// period loads at once (owner, Nov 23), so chips, search and the category
// select are instant. Mobile shows day groups of row cards; desktop a table.
// Edit and Delete on each row come in 3e-2.
export function ActivityList({ rows, today }: { rows: ActivityRow[]; today: string }) {
  const { open, query, setQuery } = useActivitySearch();
  const [type, setType] = useState<ActivityFilter>("all");
  const [categoryId, setCategoryId] = useState("");
  // Mobile: the header's search button shows the field; put the cursor in it.
  const searchRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (open) searchRef.current?.focus();
  }, [open]);

  // The category select lists the categories used this period, A to Z.
  const categories = [...new Map(rows.map((r) => [r.category.id, r.category])).values()].toSorted((a, b) =>
    a.name.localeCompare(b.name, "en", { sensitivity: "base" }),
  );
  const shown = filterRows(rows, { type, query, categoryId });
  const days = groupByDay(shown);
  const filtering = type !== "all" || query.trim() !== "" || categoryId !== "";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-center">
        {/* Mobile: opened by the header's search button. Desktop: always there. */}
        <div className={cn("relative md:block md:w-72", open ? "block" : "hidden")}>
          <label htmlFor={SEARCH_INPUT_ID} className="sr-only">
            Search notes or names
          </label>
          <Search
            aria-hidden
            size={20}
            className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-text-3"
          />
          <input
            ref={searchRef}
            id={SEARCH_INPUT_ID}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search notes or names"
            autoComplete="off"
            enterKeyHint="search"
            className={cn(inputClassName, "h-11 pl-11")}
          />
        </div>

        <div role="group" aria-label="Show" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:px-0 md:pb-0">
          {CHIPS.map((chip) => {
            const selected = chip.value === type;
            return (
              <button
                key={chip.value}
                type="button"
                aria-pressed={selected}
                onClick={() => setType(chip.value)}
                className={cn(
                  "h-[38px] shrink-0 rounded-full px-4 text-sm font-extrabold outline-link focus-visible:outline-2 focus-visible:outline-offset-2",
                  selected
                    ? "border-2 border-sticker bg-green-700 text-white"
                    : "border-[1.5px] border-line bg-surface text-text-2",
                )}
              >
                {chip.label}
              </button>
            );
          })}
        </div>

        {/* Desktop's category select (activity.md §2). */}
        <div className="hidden md:block">
          <label htmlFor="activity-category" className="sr-only">
            Category
          </label>
          <select
            id="activity-category"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="h-11 rounded-md border-[1.5px] border-line bg-surface px-3 text-base text-ink outline-link focus-visible:outline-2"
          >
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Announces the result of a search or filter. */}
      <p aria-live="polite" className="sr-only">
        {filtering ? `${shown.length} ${shown.length === 1 ? "transaction" : "transactions"} shown` : ""}
      </p>

      {days.length === 0 ? (
        <div className="flex flex-col items-start gap-3 rounded-2xl border-[1.5px] border-line bg-surface p-5">
          <p className="text-[15px] font-bold text-ink">No transactions match.</p>
          <button
            type="button"
            onClick={() => {
              setType("all");
              setQuery("");
              setCategoryId("");
            }}
            className="h-11 rounded-md border-[1.5px] border-line bg-surface px-4 text-sm font-extrabold text-ink outline-link focus-visible:outline-2"
          >
            Clear filters
          </button>
        </div>
      ) : (
        <>
          <MobileDays days={days} today={today} />
          <DesktopTable days={days} today={today} />
        </>
      )}
    </div>
  );
}

type Days = ReturnType<typeof groupByDay<ActivityRow>>;

/** "−₱180" for money out, "+₱25,000" (green) for money in. */
function Amount({ row, className }: { row: ActivityRow; className?: string }) {
  const signed = signedAmount(row);
  return (
    <span className={cn("shrink-0 font-display font-semibold", signed > 0 ? "text-link" : "text-ink", className)}>
      {formatPeso(signed, { signed: true })}
    </span>
  );
}

// Mobile (activity.md §1.6): an h3 per day with its net, then a card of rows.
function MobileDays({ days, today }: { days: Days; today: string }) {
  return (
    <div className="flex flex-col gap-5 md:hidden">
      {days.map((day) => (
        <section key={day.date} aria-labelledby={`day-${day.date}`} className="flex flex-col gap-2">
          {/* The net is part of the heading, so it's read with the day. */}
          <h3 id={`day-${day.date}`} className="flex justify-between text-[13px] font-extrabold text-text-3">
            <span>{dayHeading(day.date, today)}</span>
            <span>
              <span className="sr-only">Net </span>
              {formatPeso(day.net, { signed: true })}
            </span>
          </h3>
          <ul className="flex flex-col divide-y divide-line-soft rounded-2xl border-[1.5px] border-line bg-surface">
            {day.rows.map((row) => {
              const { name, detail } = rowLabels(row);
              return (
                <li key={row.id} className="flex items-center gap-3 px-3.5 py-3">
                  <CategoryIconTile icon={row.category.icon} color={row.category.color} size="md" />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-[15px] font-extrabold text-ink">{name}</span>
                    <span className="truncate text-[13px] text-text-3">{detail}</span>
                  </span>
                  <Amount row={row} className="text-base" />
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}

// Desktop (activity.md §2): one table, a full-width row per day, then its rows.
function DesktopTable({ days, today }: { days: Days; today: string }) {
  const HEAD = "px-4 py-3 text-left text-xs font-extrabold tracking-wide text-text-3 uppercase";
  return (
    <div className="hidden overflow-hidden rounded-2xl border-[1.5px] border-line bg-surface md:block">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-line">
            <th scope="col" className={HEAD}>
              Name
            </th>
            <th scope="col" className={HEAD}>
              Note
            </th>
            <th scope="col" className={HEAD}>
              Category
            </th>
            <th scope="col" className={HEAD}>
              Type
            </th>
            <th scope="col" className={cn(HEAD, "text-right")}>
              Amount
            </th>
          </tr>
        </thead>
        {days.map((day) => (
          <tbody key={day.date}>
            <tr className="bg-bg">
              <th scope="rowgroup" colSpan={5} className="px-4 py-2 text-left text-[13px] font-extrabold text-text-3">
                <span className="flex justify-between">
                  <span>{dayHeading(day.date, today)}</span>
                  <span>
                    <span className="sr-only">Net </span>
                    {formatPeso(day.net, { signed: true })}
                  </span>
                </span>
              </th>
            </tr>
            {day.rows.map((row) => {
              const { name } = rowLabels(row);
              return (
                <tr key={row.id} className="border-t border-line-soft">
                  <td className="px-4 py-2.5">
                    <span className="flex items-center gap-3">
                      <CategoryIconTile icon={row.category.icon} color={row.category.color} />
                      <span className="font-extrabold text-ink">{name}</span>
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-text-2">{row.note ?? "—"}</td>
                  <td className="px-4 py-2.5 text-text-2">{row.category.name}</td>
                  <td className="px-4 py-2.5 text-text-2">{typeLabel(row.type)}</td>
                  <td className="px-4 py-2.5 text-right">
                    <Amount row={row} className="text-base" />
                  </td>
                </tr>
              );
            })}
          </tbody>
        ))}
      </table>
    </div>
  );
}
