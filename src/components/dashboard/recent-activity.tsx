import Link from "next/link";
import { RowSummary } from "@/components/activity/activity-list";
import { OpenAddSheetButton } from "@/components/transactions/add-transaction-provider";
import { type ActivityRow, dayHeading, rowLabels } from "@/lib/activity";

// Recent activity (dashboard.md §2.7): the last four transactions, in
// Activity's row style, then See all. Rows aren't buttons here; editing
// lives in Activity.
export function RecentActivity({ rows, today }: { rows: ActivityRow[]; today: string }) {
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
            See all<span className="sr-only"> activity</span>
          </Link>
        )}
      </div>

      {rows.length === 0 ? (
        // dashboard.md §6 "Recent activity" empty state.
        <div className="flex flex-col items-start gap-3 rounded-2xl border-[1.5px] border-line bg-surface p-5">
          <p className="text-[15px] font-bold text-ink">Nothing logged yet</p>
          <p className="text-sm text-text-2">
            <span className="md:hidden">Tap the + button below to log your first expense.</span>
            <span className="hidden md:inline">Your income and expenses will show up here.</span>
          </p>
          <OpenAddSheetButton className="flex h-11 items-center rounded-md bg-primary px-4 text-sm font-extrabold text-primary-foreground outline-link focus-visible:outline-2 focus-visible:outline-offset-2">
            Log an expense
          </OpenAddSheetButton>
        </div>
      ) : (
        <ul className="flex flex-col divide-y divide-line-soft rounded-2xl border-[1.5px] border-line bg-surface">
          {rows.map((row) => {
            const { name, detail } = rowLabels(row);
            return (
              <li key={row.id} className="flex items-center gap-3 px-3.5 py-3">
                <RowSummary row={row} name={name} detail={`${detail} · ${dayHeading(row.date, today)}`} />
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
