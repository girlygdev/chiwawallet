import { formatPeso } from "@/lib/money";
import { firstPeriodSummary } from "@/lib/onboarding";
import { formatPeriodRange } from "@/lib/periods";
import { cn } from "@/lib/utils";

type Props = {
  heading: string;
  tag: string;
  start: string;
  end: string;
  /** "15th", "Fri"… for the "Expected income (15th)" row. */
  paydayLabel: string;
  expectedIncome: number;
  openingBalance: number | null;
  payReceived: boolean | null;
  className?: string;
};

// "YOUR FIRST PERIOD" (step 3 desktop preview) and "FIRST PERIOD" (Done
// screen), onboarding.md §5–6. The numbers come from firstPeriodSummary(), so
// pay that already arrived isn't counted twice.
export function FirstPeriodCard({
  heading,
  tag,
  start,
  end,
  paydayLabel,
  expectedIncome,
  openingBalance,
  payReceived,
  className,
}: Props) {
  const { readyToPlan } = firstPeriodSummary({ openingBalance, expectedIncome, payReceived });

  return (
    <section
      aria-label={heading}
      className={cn("flex flex-col gap-3 rounded-[20px] border-2 border-sticker bg-surface p-5 text-ink", className)}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-extrabold tracking-wide text-text-3 uppercase">{heading}</p>
        <span className="rounded-full bg-mint px-2.5 py-1 text-xs font-extrabold text-link-hover">{tag}</span>
      </div>
      <p className="font-display text-[26px] leading-none font-semibold">{formatPeriodRange(start, end)}</p>

      <dl aria-live="polite" className="flex flex-col gap-2 text-[15px]">
        <div className="flex items-baseline justify-between gap-3">
          <dt className="text-text-2">Expected income ({paydayLabel})</dt>
          <dd className="font-bold">
            {payReceived ? <span className="text-text-3">Already in balance</span> : formatPeso(expectedIncome)}
          </dd>
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <dt className="text-text-2">Starting balance</dt>
          <dd className="font-bold">{openingBalance == null ? "—" : formatPeso(openingBalance)}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-3 border-t border-line-soft pt-2">
          <dt className="font-extrabold text-link">Ready to plan</dt>
          <dd className="font-display text-xl font-semibold text-link">{formatPeso(readyToPlan)}</dd>
        </div>
      </dl>
      <p className="text-xs text-text-3">Bills, savings and debt payments you add will appear here as planned items.</p>
    </section>
  );
}
