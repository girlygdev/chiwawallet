import type { AddSheetData, EditingTransaction } from "@/app/(app)/activity/actions";
import { formatPeso } from "@/lib/money";
import { formatPeriodRange, getPeriod } from "@/lib/periods";
import { editImpact, moneyInImpact, moneyOutImpact } from "@/lib/transactions";

/**
 * The add sheet's impact line, in pesos before saving (CLAUDE.md UI rules).
 * The math is in lib/transactions.ts; this only picks the case and words it.
 * - Adding to this period: "Money out this period: ₱230 → ₱410"
 * - Adding to an earlier period: "Goes in Nov 1 – 14."
 * - Editing within the row's period: "Money out this period: ₱230 → ₱250"
 *   (the change only), or "Money out in Nov 1 – 14: …" for an older one
 * - Editing to a date in another period: "Moves to Nov 1 – 14."
 */
export function sheetImpact({
  data,
  editing,
  kind,
  amount,
  date,
}: {
  data: AddSheetData | null;
  editing: EditingTransaction | null;
  kind: "out" | "in";
  /** Centavos, or null while the amount isn't valid. */
  amount: number | null;
  date: string;
}): string | null {
  if (!data || amount == null) return null;
  const label = kind === "out" ? "Money out" : "Money in";
  const inside = (p: { start: string; end: string }) => date >= p.start && date <= p.end;
  const range = () => {
    const period = getPeriod(date, data.schedule);
    return formatPeriodRange(period.start, period.end);
  };

  if (editing) {
    if (!inside(editing.period)) return `Moves to ${range()}.`;
    const { before, after } = editImpact(editing.periodRows, editing, amount);
    const where =
      editing.period.start === data.currentPeriod.start
        ? "this period"
        : `in ${formatPeriodRange(editing.period.start, editing.period.end)}`;
    return `${label} ${where}: ${formatPeso(before)} → ${formatPeso(after)}`;
  }

  if (!inside(data.currentPeriod)) return `Goes in ${range()}.`;
  const { before, after } = (kind === "out" ? moneyOutImpact : moneyInImpact)(data.periodRows, amount);
  return `${label} this period: ${formatPeso(before)} → ${formatPeso(after)}`;
}
