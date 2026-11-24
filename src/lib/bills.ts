import { dateInMonth } from "@/lib/periods";

// Bill math (bills.md §1, week-4-tasks.md 4b): pure functions, no React.
// Dates are "YYYY-MM-DD" strings. A due day the month doesn't have (31 in
// April, 30 in February) falls on the month's last day, like paydays.

export type BillFrequency = "monthly" | "quarterly" | "yearly";

/** The fields that decide when a bill is due. */
export type BillTiming = {
  frequency: BillFrequency;
  due_day: number;
  /** 1–12; quarterly and yearly bills only (plan review 3.7). */
  first_due_month: number | null;
};

/** The months (1–12) a bill is due in, in calendar order. */
export function billMonths(bill: BillTiming): number[] {
  if (bill.frequency === "monthly") return [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  const first = bill.first_due_month;
  if (first == null) throw new RangeError(`A ${bill.frequency} bill needs its first due month.`);
  if (bill.frequency === "yearly") return [first];
  // Quarterly: the first month and every third month after it, wrapping
  // around the year (first month 11 → Nov, Feb, May, Aug).
  return [0, 3, 6, 9].map((step) => ((first - 1 + step) % 12) + 1).toSorted((a, b) => a - b);
}

/**
 * Every due date from `from` to `to`, both included, oldest first. For one
 * period, pass its start and end: which dates fall in that period.
 */
export function billDueDates(bill: BillTiming, from: string, to: string): string[] {
  if (to < from) return [];
  const months = new Set(billMonths(bill));
  const dates: string[] = [];
  // Walk the calendar months the range touches. ISO dates compare correctly
  // as plain strings.
  let year = Number(from.slice(0, 4));
  let month = Number(from.slice(5, 7));
  const lastYear = Number(to.slice(0, 4));
  const lastMonth = Number(to.slice(5, 7));
  while (year < lastYear || (year === lastYear && month <= lastMonth)) {
    if (months.has(month)) {
      const due = dateInMonth(year, month, bill.due_day);
      if (due >= from && due <= to) dates.push(due);
    }
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
  return dates;
}

/** The bill's next due date on or after `date`. */
export function nextBillDue(bill: BillTiming, date: string): string {
  // A yearly bill is due at least once in any 13 calendar months.
  const year = Number(date.slice(0, 4));
  const month = Number(date.slice(5, 7));
  const until = dateInMonth(year + 1, month, 31);
  const [next] = billDueDates(bill, date, until);
  return next;
}

const TIMES_A_YEAR: Record<BillFrequency, number> = { monthly: 12, quarterly: 4, yearly: 1 };

/**
 * "Bills each month" (bills.md §1): monthly bills, plus quarterly ÷ 3 and
 * yearly ÷ 12, in centavos. Worked out as a yearly total ÷ 12 and rounded
 * once, so splitting doesn't add up rounding errors.
 */
export function billsPerMonth(bills: { amount: number; frequency: BillFrequency }[]): number {
  const perYear = bills.reduce((sum, b) => sum + b.amount * TIMES_A_YEAR[b.frequency], 0);
  return Math.round(perYear / 12);
}
