import { formatPeso } from "@/lib/money";
import { cn } from "@/lib/utils";

export type IncomeLine = { id: string; name: string; amount: number; received: boolean };

// Expected vs actual income this period (week-3-tasks.md 3f): what came in
// (Activity's Money in, one-time income included) against what the sources
// paying this period expect, then each source with Received or Expected.
export function IncomeCard({
  received,
  expected,
  sources,
  paydayLabel,
  firstPayCounted,
}: {
  received: number;
  expected: number;
  sources: IncomeLine[];
  /** "15th" */
  paydayLabel: string;
  /** Onboarding said this period's pay was already in the opening balance (3.14). */
  firstPayCounted: boolean;
}) {
  return (
    <section aria-labelledby="income-title" className="flex flex-col gap-3 rounded-xl border-[1.5px] border-line bg-surface p-5">
      <div className="flex flex-col gap-0.5">
        <h2 id="income-title" className="font-display text-lg font-semibold text-ink">
          Income this period
        </h2>
        <p className="text-[15px] text-text-2">
          <span className="font-extrabold text-link">{formatPeso(received)}</span> received of{" "}
          <span className="font-extrabold text-ink">{formatPeso(expected)}</span> expected
        </p>
      </div>

      {sources.length > 0 ? (
        <ul className="flex flex-col gap-2 border-t border-line-soft pt-3">
          {sources.map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-3 text-sm">
              <span className="min-w-0 truncate font-bold text-ink">{s.name}</span>
              <span className="flex shrink-0 items-center gap-2">
                <span className="font-extrabold text-ink">{formatPeso(s.amount)}</span>
                {/* Words, not only colour. */}
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-xs font-extrabold",
                    s.received ? "bg-mint text-link-hover" : "bg-track text-text-2",
                  )}
                >
                  {s.received ? "Received" : "Expected"}
                </span>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-text-3">No income lands on your {paydayLabel} payday.</p>
      )}

      {firstPayCounted && (
        <p className="text-[13px] text-text-3">Your {paydayLabel} pay is already in your starting balance.</p>
      )}
    </section>
  );
}
