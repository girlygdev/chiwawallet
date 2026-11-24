import { addDays, format, parseISO } from "date-fns";
import { dateInMonth, formatShortDate, ordinal, type PaySchedule } from "@/lib/periods";

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

// ---------------------------------------------------------------------------
// The Bills screen (bills.md §1–2, task 4c)
// ---------------------------------------------------------------------------

/**
 * Bills per payday on a twice-a-month budget, as monthly amounts (quarterly
 * ÷ 3, yearly ÷ 12) like "Bills each month". Split bills count half on each.
 * Null on weekly and monthly budgets, which have one payday (bills.md §1:
 * the per-payday section is hidden there).
 */
export function billsPerPayday(
  bills: { amount: number; frequency: BillFrequency; pay_slot: string }[],
  schedule: PaySchedule,
): { payday_1: number; payday_2: number } | null {
  if (schedule.frequency !== "semi_monthly") return null;
  // Doubled yearly totals keep a split bill's half a whole number until the
  // one rounding at the end (÷ 2 for the doubling, ÷ 12 for a month).
  let first = 0;
  let second = 0;
  for (const b of bills) {
    const perYear = b.amount * TIMES_A_YEAR[b.frequency];
    if (b.pay_slot === "payday_1") first += 2 * perYear;
    else if (b.pay_slot === "payday_2") second += 2 * perYear;
    else if (b.pay_slot === "split") {
      first += perYear;
      second += perYear;
    }
  }
  return { payday_1: Math.round(first / 24), payday_2: Math.round(second / 24) };
}

/**
 * The payday carrying more than 60% of the bills (bills.md §1's balance
 * message), or null when they're balanced or there are none.
 */
export function heavyPayday(perPayday: { payday_1: number; payday_2: number }): "payday_1" | "payday_2" | null {
  const total = perPayday.payday_1 + perPayday.payday_2;
  if (total <= 0) return null;
  // More than 60%: share × 5 > total × 3, in whole numbers.
  if (perPayday.payday_1 * 5 > total * 3) return "payday_1";
  if (perPayday.payday_2 * 5 > total * 3) return "payday_2";
  return null;
}

/**
 * New bill's suggested payday (bills.md §1): the last payday on or before the
 * due day. Due the 10th on a 15th/30th budget → the 30th (of the month
 * before); due the 22nd → the 15th. One-payday budgets: every.
 */
export function suggestedBillSlot(dueDay: number, schedule: PaySchedule): "payday_1" | "payday_2" | "every" {
  if (schedule.frequency !== "semi_monthly") return "every";
  if (dueDay >= schedule.payDay2) return "payday_2";
  if (dueDay >= schedule.payDay1) return "payday_1";
  return "payday_2";
}

/**
 * A bill row's tag (bills.md §2): "Due Nov 22" when a due date falls in the
 * current period, otherwise "Next: Dec 10". "Paid Nov 15" needs plan items
 * (Week 5).
 */
export function billStatus(
  bill: BillTiming,
  period: { start: string; end: string },
): { kind: "due" | "next"; date: string } {
  const [due] = billDueDates(bill, period.start, period.end);
  if (due) return { kind: "due", date: due };
  const dayAfter = format(addDays(parseISO(period.end), 1), "yyyy-MM-dd");
  return { kind: "next", date: nextBillDue(bill, dayAfter) };
}

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "Due every 20th", "Quarterly · 5th of Feb, May, Aug, Nov", "Yearly · next Nov 30". */
export function billScheduleLine(bill: BillTiming, today: string): string {
  switch (bill.frequency) {
    case "monthly":
      return `Due every ${ordinal(bill.due_day)}`;
    case "quarterly":
      return `Quarterly · ${ordinal(bill.due_day)} of ${billMonths(bill).map((m) => MONTH_NAMES[m - 1]).join(", ")}`;
    case "yearly":
      // The real date, so a Feb 30 bill reads "Feb 28".
      return `Yearly · next ${formatShortDate(nextBillDue(bill, today))}`;
  }
}

/** A split bill's half on each payday; an odd centavo goes to the second. */
export function splitHalves(amount: number): { payday_1: number; payday_2: number } {
  const first = Math.floor(amount / 2);
  return { payday_1: first, payday_2: amount - first };
}

/** Each payday's share of the bills (0 to 1), for the per-payday bars. */
export function paydayShares(perPayday: { payday_1: number; payday_2: number }): { payday_1: number; payday_2: number } {
  const total = perPayday.payday_1 + perPayday.payday_2;
  if (total <= 0) return { payday_1: 0, payday_2: 0 };
  return { payday_1: perPayday.payday_1 / total, payday_2: perPayday.payday_2 / total };
}
