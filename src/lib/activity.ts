import { addDays, format, isValid, parseISO, subDays } from "date-fns";
import { type ActualPeriod, type EarlyStarts, type PaySchedule, periodAt } from "@/lib/periods";
import type { TransactionRow, TransactionType } from "@/lib/transactions";

// The Activity list (activity.md §1–2, week-3-tasks.md 3e). Pure functions:
// labels, filters, day headings and period navigation. Totals and day groups
// come from lib/transactions.ts.

/** A transaction as the list shows it, with its category and source. */
export type ActivityRow = TransactionRow & {
  note: string | null;
  category: { id: string; name: string; icon: string; color: string };
  /** The income source, for pay from one; null otherwise. */
  source: { name: string } | null;
  /**
   * The credit card on the row (8b-3), loaded with
   * `card:debts!transactions_card_fkey(name)`: the name has to say which link,
   * since transactions point at debts twice. Left out where it isn't loaded.
   */
  card?: { name: string } | null;
};

/** The filter chips (fix #2: the four desktop types on both). */
export type ActivityFilter = "all" | "spending" | "income" | "savings";

/**
 * The row's name and detail line (activity.md §1 "Transaction row"):
 * - expense: its note ("Lunch", detail "Food"), else the category ("Food", "Expense")
 * - pay from a source: the source ("Main job", "Income")
 * - one-time income: its name, saved as the note ("Bonus", "Income · One-time")
 * - a purchase on a card adds the card to the detail ("Food · BPI card", 8b-3)
 */
export function rowLabels(row: ActivityRow): { name: string; detail: string } {
  const labels = baseLabels(row);
  // Only purchases: a payment to the card isn't paid with it.
  if (row.type === "expense" && row.card) return { ...labels, detail: `${labels.detail} · ${row.card.name}` };
  return labels;
}

function baseLabels(row: ActivityRow): { name: string; detail: string } {
  if (row.type === "income") {
    if (row.source) return { name: row.source.name, detail: "Income" };
    // No source and no note: pay from a source that was since deleted.
    if (!row.note) return { name: "Income", detail: "Income" };
    return { name: row.note, detail: "Income · One-time" };
  }
  if (row.note) return { name: row.note, detail: row.category.name };
  return { name: row.category.name, detail: typeLabel(row.type) };
}

const TYPE_LABELS: Record<TransactionType, string> = {
  expense: "Expense",
  income: "Income",
  savings: "Savings",
  debt_payment: "Debt payment",
};

/** The desktop table's TYPE column. */
export function typeLabel(type: TransactionType): string {
  return TYPE_LABELS[type];
}

const CHIP_TYPES: Record<Exclude<ActivityFilter, "all">, TransactionType[]> = {
  spending: ["expense", "debt_payment"],
  income: ["income"],
  savings: ["savings"],
};

/**
 * The rows the chips, search and category select leave. Search looks at the
 * name, detail, note, category and source, ignoring case.
 */
export function filterRows(
  rows: ActivityRow[],
  { type, query, categoryId }: { type: ActivityFilter; query: string; categoryId: string },
): ActivityRow[] {
  const needle = query.trim().toLocaleLowerCase("en");
  return rows.filter((row) => {
    if (type !== "all" && !CHIP_TYPES[type].includes(row.type)) return false;
    if (categoryId && row.category.id !== categoryId) return false;
    if (!needle) return true;
    const { name, detail } = rowLabels(row);
    return [name, detail, row.note, row.category.name, row.source?.name, row.card?.name].some((text) =>
      text?.toLocaleLowerCase("en").includes(needle),
    );
  });
}

/** A day group's heading: "Today, Nov 23", "Nov 22", or "Dec 30, 2025" in another year. */
export function dayHeading(date: string, today: string): string {
  const day = parseISO(date);
  if (date === today) return `Today, ${format(day, "MMM d")}`;
  return date.slice(0, 4) === today.slice(0, 4) ? format(day, "MMM d") : format(day, "MMM d, yyyy");
}

type Limits = {
  /** Manila "YYYY-MM-DD". */
  today: string;
  /** The first period's first day. */
  firstStart: string;
};

const iso = (d: Date) => format(d, "yyyy-MM-dd");

function isRealDate(text: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(text) && isValid(parseISO(text)) && iso(parseISO(text)) === text;
}

/**
 * The period that `/activity?period=YYYY-MM-DD` shows: the one containing that
 * day, kept between the first period and the current one. A missing or broken
 * value shows the current period (owner, Nov 23: the URL holds a date, not a
 * period id, so browsing never has to create a period). `early` holds the
 * periods that started early (Task D2), so a day goes to the period it's in.
 */
export function resolvePeriod(
  param: string | undefined,
  schedule: PaySchedule,
  { today, firstStart }: Limits,
  early: EarlyStarts = {},
): ActualPeriod {
  const current = periodAt(today, schedule, early);
  if (!param || !isRealDate(param)) return current;
  if (param > current.end) return current;
  if (param < firstStart) return periodAt(firstStart, schedule, early);
  return periodAt(param, schedule, early);
}

/** The period bar's arrows: the previous and next periods' starts, or null at either end. */
export function periodNav(
  period: { start: string; end: string; firstDay?: string },
  schedule: PaySchedule,
  { today, firstStart }: Limits,
  early: EarlyStarts = {},
): { prev: string | null; next: string | null } {
  // The day before this period's first day, and the day after its last.
  const prev = periodAt(iso(subDays(parseISO(period.firstDay ?? period.start), 1)), schedule, early);
  const next = periodAt(iso(addDays(parseISO(period.end), 1)), schedule, early);
  return {
    prev: prev.start >= firstStart ? prev.start : null,
    // A period that started early can be opened from its first day.
    next: next.firstDay <= today ? next.start : null,
  };
}
