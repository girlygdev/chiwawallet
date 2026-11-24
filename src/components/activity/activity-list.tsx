"use client";

import { Pencil, Search, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { inputClassName } from "@/components/auth/text-field";
import { useTransactionSheet } from "@/components/transactions/add-transaction-provider";
import { CategoryIconTile } from "@/components/transactions/category-grid";
import type { DeleteTarget } from "@/components/transactions/delete-transaction-dialog";
import {
  type ActivityFilter,
  type ActivityRow,
  dayHeading,
  filterRows,
  rowLabels,
  typeLabel,
} from "@/lib/activity";
import { formatPeso } from "@/lib/money";
import { formatShortDate } from "@/lib/periods";
import { editImpact, groupByDay, signedAmount } from "@/lib/transactions";
import { cn } from "@/lib/utils";
import { SEARCH_INPUT_ID, useActivitySearch } from "./search-context";

const CHIPS: { value: ActivityFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "spending", label: "Spending" },
  { value: "income", label: "Income" },
  { value: "savings", label: "Savings" },
];

/**
 * What the delete dialog (and Edit's Delete link) shows for a row. Shared by
 * Activity and the Dashboard's Recent activity. `impact` is editImpact(the
 * row's period, row, 0); `periodLabel` is "this period" or "Nov 1 – 14".
 */
export function deleteTargetFor(row: ActivityRow, impact: DeleteTarget["impact"], periodLabel: string): DeleteTarget {
  const { name, detail } = rowLabels(row);
  return {
    id: row.id,
    name,
    detail: `${detail} · ${formatShortDate(row.date)}`,
    signedAmount: signedAmount(row),
    icon: row.category.icon,
    color: row.category.color,
    impact,
    periodLabel,
  };
}

// The period's rows (activity.md §1–2), filtered in the browser: the whole
// period loads at once (owner, Nov 23), so chips, search and the category
// select are instant. Mobile shows day groups of row cards; desktop a table.
//
// Every row can be edited and deleted (3e-2). Mobile: tap the row to edit,
// plus a Delete button (owner, Nov 23). Desktop: Edit and Delete buttons in
// an Actions column. Swipe is in V1.1.md.
export function ActivityList({
  rows,
  today,
  periodLabel,
}: {
  rows: ActivityRow[];
  today: string;
  /** "this period", or "Nov 1 – 14" for an older one (the delete dialog's effect line). */
  periodLabel: string;
}) {
  const { open, query, setQuery } = useActivitySearch();
  const sheet = useTransactionSheet();

  // What the delete dialog shows for a row. The effect uses every row of the
  // period, not just the ones a filter leaves.
  const deleteTarget = (row: ActivityRow) => deleteTargetFor(row, editImpact(rows, row, 0), periodLabel);
  const actions: RowActions = {
    edit: (row) => sheet.openEditSheet(row.id, deleteTarget(row)),
    remove: (row) => sheet.openDelete(deleteTarget(row)),
  };
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
          <MobileDays days={days} today={today} actions={actions} />
          <DesktopTable days={days} today={today} actions={actions} />
        </>
      )}
    </div>
  );
}

type Days = ReturnType<typeof groupByDay<ActivityRow>>;
type RowActions = { edit: (row: ActivityRow) => void; remove: (row: ActivityRow) => void };

const ICON_BUTTON =
  "flex size-11 shrink-0 items-center justify-center rounded-full text-text-2 outline-link hover:bg-bg focus-visible:outline-2";

/** A 44px icon button named for its row: "Edit Lunch", "Delete Lunch". */
function DeleteButton({ row, actions }: { row: ActivityRow; actions: RowActions }) {
  return (
    <button type="button" aria-label={`Delete ${rowLabels(row).name}`} onClick={() => actions.remove(row)} className={ICON_BUTTON}>
      <Trash2 aria-hidden size={20} />
    </button>
  );
}

/** "−₱180" for money out, "+₱25,000" (green) for money in. */
function Amount({ row, className }: { row: ActivityRow; className?: string }) {
  const signed = signedAmount(row);
  return (
    <span className={cn("shrink-0 font-display font-semibold", signed > 0 ? "text-link" : "text-ink", className)}>
      {formatPeso(signed, { signed: true })}
    </span>
  );
}

/**
 * A row's look (activity.md §1 "Transaction row"): the 40px category tile, the
 * name and detail line, and the amount. Shared with the Dashboard's Recent
 * activity, so both lists look the same.
 */
export function RowSummary({ row, name, detail }: { row: ActivityRow; name: string; detail: string }) {
  return (
    <>
      <CategoryIconTile icon={row.category.icon} color={row.category.color} size="md" />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-[15px] font-extrabold text-ink">{name}</span>
        <span className="truncate text-[13px] text-text-3">{detail}</span>
      </span>
      <Amount row={row} className="text-base" />
    </>
  );
}

// Mobile (activity.md §1.6): an h3 per day with its net, then a card of rows.
function MobileDays({ days, today, actions }: { days: Days; today: string; actions: RowActions }) {
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
                <li key={row.id} className="flex items-center gap-1 pr-1.5">
                  {/* The row is the Edit button (activity.md §1: tapping a row opens it). */}
                  <button
                    type="button"
                    onClick={() => actions.edit(row)}
                    aria-label={`Edit ${name}, ${formatPeso(signedAmount(row), { signed: true })}`}
                    className="flex min-w-0 flex-1 items-center gap-3 rounded-[14px] py-3 pl-3.5 text-left outline-link focus-visible:outline-2 focus-visible:-outline-offset-2"
                  >
                    <RowSummary row={row} name={name} detail={detail} />
                  </button>
                  <DeleteButton row={row} actions={actions} />
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
function DesktopTable({ days, today, actions }: { days: Days; today: string; actions: RowActions }) {
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
            <th scope="col" className="w-[104px]">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        {days.map((day) => (
          <tbody key={day.date}>
            <tr className="bg-bg">
              <th scope="rowgroup" colSpan={6} className="px-4 py-2 text-left text-[13px] font-extrabold text-text-3">
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
                  <td className="py-1 pr-2">
                    <span className="flex justify-end">
                      <button
                        type="button"
                        aria-label={`Edit ${name}`}
                        onClick={() => actions.edit(row)}
                        className={ICON_BUTTON}
                      >
                        <Pencil aria-hidden size={18} />
                      </button>
                      <DeleteButton row={row} actions={actions} />
                    </span>
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
