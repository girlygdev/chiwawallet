import { formatPeso } from "@/lib/money";

// The desktop stat cards (plan.md §4): Money in, Planned, Not assigned yet
// and Paid or spent. Future periods have nothing paid yet, so the last card
// is left out. The words come from lib/plan.ts (planCounts, planDone).
export function PlanStats({
  moneyForPeriod,
  incomeLine,
  planned,
  counts,
  notAssigned,
  moneyOut,
  done,
}: {
  moneyForPeriod: number;
  /** "₱25,000 income + ₱5,000 carried in" */
  incomeLine: string;
  planned: number;
  /** "9 items in 4 groups" */
  counts: string;
  notAssigned: number;
  /** Empty for future periods. */
  moneyOut: number | null;
  /** "45% of plan done" */
  done: string;
}) {
  return (
    <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Stat label="Money in" value={moneyForPeriod} line={incomeLine} />
      <Stat label="Planned" value={planned} line={counts} />
      <Stat
        label="Not assigned yet"
        value={notAssigned}
        line={notAssigned < 0 ? `${formatPeso(-notAssigned)} more than this period has` : `Of ${formatPeso(moneyForPeriod)}`}
      />
      {moneyOut != null && <Stat label="Paid or spent" value={moneyOut} line={done} />}
    </dl>
  );
}

function Stat({ label, value, line }: { label: string; value: number; line: string }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-2xl border-[1.5px] border-line bg-surface p-4">
      <dt className="text-[13px] font-extrabold tracking-wide text-text-3 uppercase">{label}</dt>
      <dd className="font-display text-2xl leading-tight font-semibold text-ink">{formatPeso(value)}</dd>
      <dd className="text-[13px] text-text-3">{line}</dd>
    </div>
  );
}
