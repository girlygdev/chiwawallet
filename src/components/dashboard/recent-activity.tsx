"use client";

import Link from "next/link";
import { Amount, deleteTargetFor, RowSummary } from "@/components/activity/activity-list";
import { EMPTY_BUTTON, EmptyCard } from "@/components/dashboard/empty-card";
import { CategoryIconTile } from "@/components/transactions/category-grid";
import { OpenAddSheetButton, useTransactionSheet } from "@/components/transactions/add-transaction-provider";
import type { DeleteTarget } from "@/components/transactions/delete-transaction-dialog";
import { type ActivityRow, dayHeading, rowLabels } from "@/lib/activity";
import { formatPeso } from "@/lib/money";
import { signedAmount } from "@/lib/transactions";

/** A recent row plus what its Delete link shows, worked out on the server. */
export type RecentRow = ActivityRow & {
  /** editImpact(the row's period, row, 0) */
  impact: DeleteTarget["impact"];
  /** "this period", or "Nov 1 – 14" for an older one. */
  periodLabel: string;
};

/** Phones show the last four (dashboard.md §2.7); the desktop table the last five (§3). */
const MOBILE_ROWS = 4;

// Recent activity (dashboard.md §2.7): the last four transactions, in
// Activity's row style, then See all. Desktop (§3, 7c): a table of the last
// five, DESCRIPTION · CATEGORY · DATE · AMOUNT, then All transactions. Tapping a row opens Edit transaction,
// the same sheet as Activity, with its Delete link (owner, Nov 24). The
// provider refreshes the page after a save or delete, so the cards update.
const HEAD = "px-4 py-3 text-left text-xs font-extrabold tracking-wide text-text-3 uppercase";

export function RecentActivity({ rows, today }: { rows: RecentRow[]; today: string }) {
  const sheet = useTransactionSheet();

  return (
    <section aria-labelledby="recent-title" className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h2 id="recent-title" className="font-display text-lg font-semibold text-ink">
          Recent activity
        </h2>
        {rows.length > 0 && (
          <Link
            href="/activity"
            className="flex h-11 items-center rounded-md px-2 text-sm font-extrabold text-link outline-link hover:text-link-hover focus-visible:outline-2"
          >
            <span className="lg:hidden">
              See all<span className="sr-only"> activity</span>
            </span>
            <span className="hidden lg:inline">All transactions</span>
          </Link>
        )}
      </div>

      {rows.length === 0 ? (
        // dashboard.md §6 "Recent activity" empty state.
        <EmptyCard title="Nothing logged yet" action={<OpenAddSheetButton className={EMPTY_BUTTON}>Log an expense</OpenAddSheetButton>}>
          <span className="md:hidden">Tap the + button below to log your first expense.</span>
          <span className="hidden md:inline">Your income and expenses will show up here.</span>
        </EmptyCard>
      ) : (
        <>
          <ul className="flex flex-col divide-y divide-line-soft rounded-2xl border-[1.5px] border-line bg-surface lg:hidden">
            {rows.slice(0, MOBILE_ROWS).map((row) => {
              const { name, detail } = rowLabels(row);
              return (
                <li key={row.id}>
                  {/* The row is the Edit button, like Activity's mobile rows. */}
                  <button
                    type="button"
                    onClick={() => sheet.openEditSheet(row.id, deleteTargetFor(row, row.impact, row.periodLabel))}
                    aria-label={`Edit ${name}, ${formatPeso(signedAmount(row), { signed: true })}`}
                    className="flex w-full items-center gap-3 rounded-[14px] px-3.5 py-3 text-left outline-link hover:bg-bg focus-visible:outline-2 focus-visible:-outline-offset-2"
                  >
                    <RowSummary row={row} name={name} detail={`${detail} · ${dayHeading(row.date, today)}`} />
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="hidden overflow-hidden rounded-2xl border-[1.5px] border-line bg-surface lg:block">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-line">
                  <th scope="col" className={HEAD}>
                    Description
                  </th>
                  <th scope="col" className={`${HEAD} hidden xl:table-cell`}>
                    Category
                  </th>
                  <th scope="col" className={HEAD}>
                    Date
                  </th>
                  <th scope="col" className={`${HEAD} text-right`}>
                    Amount
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const { name } = rowLabels(row);
                  return (
                    <tr key={row.id} className="border-t border-line-soft first:border-t-0">
                      <td className="px-2 py-1">
                        {/* The description opens Edit transaction, like a tapped row on mobile. */}
                        <button
                          type="button"
                          onClick={() => sheet.openEditSheet(row.id, deleteTargetFor(row, row.impact, row.periodLabel))}
                          aria-label={`Edit ${name}, ${formatPeso(signedAmount(row), { signed: true })}`}
                          className="flex min-h-11 w-full items-center gap-3 rounded-[10px] px-2 py-1.5 text-left outline-link hover:bg-bg focus-visible:outline-2"
                        >
                          <CategoryIconTile icon={row.category.icon} color={row.category.color} />
                          <span className="truncate font-extrabold text-ink">{name}</span>
                        </button>
                      </td>
                      {/* Below 1280px the column is left out so the amounts fit; the name and tile still show it. */}
                      <td className="hidden px-4 py-2 text-text-2 xl:table-cell">{row.category.name}</td>
                      <td className="px-4 py-2 whitespace-nowrap text-text-2">{dayHeading(row.date, today)}</td>
                      <td className="px-4 py-2 text-right whitespace-nowrap">
                        <Amount row={row} className="text-base" />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
