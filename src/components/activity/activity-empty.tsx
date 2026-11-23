import { OpenAddSheetButton } from "@/components/transactions/add-transaction-provider";
import { formatPeso } from "@/lib/money";

const BUTTON =
  "flex h-12 items-center justify-center rounded-md px-5 text-[15px] font-extrabold outline-link focus-visible:outline-2 focus-visible:outline-offset-2";

// Shown when the period has no transactions (activity.md §5). The buttons
// only show for the current period: logging always defaults to today.
export function ActivityEmpty({
  current,
  duePay,
  startingBalance,
}: {
  current: boolean;
  /** A source due this period and not logged yet: "I got paid ₱25,000". */
  duePay: { id: string; amount: number } | null;
  /** The opening balance, in the first period only. */
  startingBalance: number | null;
}) {
  return (
    <div className="flex flex-col gap-4">
      <section
        aria-labelledby="activity-empty-title"
        className="flex flex-col items-center gap-3 rounded-2xl border-[1.5px] border-line bg-surface p-6 text-center"
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- static SVG, no optimisation needed */}
        <img src="/logo-mark.svg" alt="" width={88} height={88} />
        <h2 id="activity-empty-title" className="font-display text-xl font-semibold text-ink">
          No transactions yet
        </h2>
        <p className="max-w-sm text-[15px] text-text-2">
          Sit, stay, log. Everything you spend or receive this period shows up here, grouped by day.
        </p>
        {current && (
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <OpenAddSheetButton className={`${BUTTON} bg-primary text-primary-foreground`}>
              Log an expense
            </OpenAddSheetButton>
            {duePay && (
              <OpenAddSheetButton
                options={{ tab: "income", incomeSource: duePay.id, amount: duePay.amount }}
                className={`${BUTTON} border-[1.5px] border-line bg-surface text-ink`}
              >
                I got paid {formatPeso(duePay.amount)}
              </OpenAddSheetButton>
            )}
          </div>
        )}
      </section>

      {startingBalance != null && (
        <p className="text-sm text-text-3">
          Your {formatPeso(startingBalance)} starting balance is already counted in this period.
        </p>
      )}

      <section aria-labelledby="habits-title" className="flex flex-col gap-2">
        <h2 id="habits-title" className="text-xs font-extrabold tracking-wide text-text-3 uppercase">
          Good habits from day one
        </h2>
        <ol className="flex list-decimal flex-col gap-1.5 pl-5 text-[15px] text-text-2 marker:font-extrabold marker:text-link">
          <li>Log as you go, right after you pay. It takes about 10 seconds.</li>
          <li>Pick a category so your budgets and 50/30/20 split stay accurate.</li>
          {/* No swipe in the MVP (V1.1.md), so the desktop wording for both. */}
          <li>Made a mistake? Use the edit and delete buttons on any row.</li>
        </ol>
      </section>
    </div>
  );
}
