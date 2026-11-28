import type { AddSheetData, EditingTransaction } from "@/app/(app)/activity/actions";
import { formatPeso } from "@/lib/money";
import { formatPeriodRange, periodAt } from "@/lib/periods";
import { budgetLeft } from "@/lib/plan";
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
  // From the period's first day, earlier than its payday if it started early (Task D2).
  const inside = (p: { firstDay: string; end: string }) => date >= p.firstDay && date <= p.end;
  const range = () => {
    const period = periodAt(date, data.schedule, data.early);
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

/**
 * Add expense's budget line (activity.md §3, task 5h-2), for an expense in
 * the current period once a category is picked:
 * - "Food budget: ₱2,580 left after this."
 * - "₱120 over your Food budget." (`over`: shown in yellow)
 * - "No Food budget yet. Set one in Plan to see what's left."
 * Null otherwise, and sheetImpact()'s line shows instead. Editing a row in
 * the same category takes its old amount out of what's spent first.
 */
export function budgetLine({
  data,
  editing,
  categoryId,
  amount,
  date,
}: {
  data: AddSheetData | null;
  editing: EditingTransaction | null;
  categoryId: string;
  /** Centavos, or null while the amount isn't valid. */
  amount: number | null;
  date: string;
}): { text: string; over: boolean } | null {
  if (!data || amount == null || !categoryId) return null;
  const current = data.currentPeriod;
  if (date < current.firstDay || date > current.end) return null;
  if (editing && editing.period.start !== current.start) return null;
  const name = data.categories.find((c) => c.id === categoryId)?.name;
  const entry = data.budgets[categoryId];
  if (!name || !entry) return null;

  // An edited expense in the same category is already in `spent`.
  const replaced = editing?.type === "expense" && editing.categoryId === categoryId ? editing.amount : 0;
  const result = budgetLeft(entry.budget, entry.spent, amount, replaced);
  switch (result.kind) {
    case "none":
      return { text: `No ${name} budget yet. Set one in Plan to see what's left.`, over: false };
    case "left":
      return { text: `${name} budget: ${formatPeso(result.amount)} left after this.`, over: false };
    case "over":
      return { text: `${formatPeso(result.amount)} over your ${name} budget.`, over: true };
  }
}
