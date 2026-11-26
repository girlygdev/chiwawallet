import {
  addDays,
  addMonths,
  differenceInCalendarDays,
  format,
  getDaysInMonth,
  isValid,
  parse,
  subDays,
} from "date-fns";

// Period math (CLAUDE.md "Money and dates"): a period runs from one payday to
// the day before the next. A payday that doesn't exist in a month (31st,
// Feb 30th) falls on that month's last day.
//
// Dates are "YYYY-MM-DD" strings in and out, like Postgres `date` values, so a
// time zone can never shift a day. Inside, they become Date objects at local
// midnight, and only whole calendar days are added or removed.

export type PaySlot = "payday_1" | "payday_2" | "every";

export type PaySchedule =
  | { frequency: "semi_monthly"; payDay1: number; payDay2: number }
  | { frequency: "monthly"; payDay1: number }
  // 0 = Sunday … 6 = Saturday, the same as JavaScript's getDay() and
  // Postgres's extract(dow).
  | { frequency: "weekly"; payWeekday: number };

export type Period = { start: string; end: string; paySlot: PaySlot };

const ISO_DATE = "yyyy-MM-dd";

/** The period that contains `date`. */
export function getPeriod(date: string, schedule: PaySchedule): Period {
  const day = parseDate(date);
  checkSchedule(schedule);

  switch (schedule.frequency) {
    case "weekly": {
      // Step back to the most recent payday, which may be today.
      const daysSincePayday = (day.getDay() - schedule.payWeekday + 7) % 7;
      const start = subDays(day, daysSincePayday);
      return period(start, addDays(start, 6), "every");
    }

    case "monthly": {
      const payday = paydayIn(day, schedule.payDay1);
      // On or after this month's payday: the period runs to the day before
      // next month's payday. Before it: it started on last month's payday.
      if (day >= payday) {
        return period(payday, dayBefore(paydayIn(addMonths(day, 1), schedule.payDay1)), "every");
      }
      return period(paydayIn(addMonths(day, -1), schedule.payDay1), dayBefore(payday), "every");
    }

    case "semi_monthly": {
      const payday1 = paydayIn(day, schedule.payDay1);
      const payday2 = paydayIn(day, schedule.payDay2);
      if (day >= payday2) {
        const nextPayday1 = paydayIn(addMonths(day, 1), schedule.payDay1);
        return period(payday2, dayBefore(nextPayday1), "payday_2");
      }
      if (day >= payday1) {
        return period(payday1, dayBefore(payday2), "payday_1");
      }
      // Before this month's payday 1: still in last month's payday 2 period.
      return period(paydayIn(addMonths(day, -1), schedule.payDay2), dayBefore(payday1), "payday_2");
    }
  }
}

/**
 * "Nov 15 – 29" in the same month, "Nov 30 – Dec 14" across months, and
 * "Dec 30, 2026 – Jan 14, 2027" across years.
 */
export function formatPeriodRange(start: string, end: string): string {
  const from = parseDate(start);
  const to = parseDate(end);
  if (from.getFullYear() !== to.getFullYear()) {
    return `${format(from, "MMM d, yyyy")} – ${format(to, "MMM d, yyyy")}`;
  }
  if (from.getMonth() !== to.getMonth()) {
    return `${format(from, "MMM d")} – ${format(to, "MMM d")}`;
  }
  return `${format(from, "MMM d")} – ${format(to, "d")}`;
}

/** `count` periods in a row, starting with the one that contains `date`. */
export function nextPeriods(date: string, schedule: PaySchedule, count: number): Period[] {
  const periods: Period[] = [];
  let day = date;
  for (let i = 0; i < count; i++) {
    const period = getPeriod(day, schedule);
    periods.push(period);
    // The day after this period ends is the first day of the next one.
    day = format(addDays(parseDate(period.end), 1), ISO_DATE);
  }
  return periods;
}

/** 1st, 2nd, 3rd, 4th … 11th, 12th, 13th … 21st, 22nd, 23rd … 31st. */
export function ordinal(n: number): string {
  const lastTwo = n % 100;
  if (lastTwo >= 11 && lastTwo <= 13) return `${n}th`;
  const suffix = { 1: "st", 2: "nd", 3: "rd" }[n % 10] ?? "th";
  return `${n}${suffix}`;
}

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** The short tag for a period's payday: "15th", "30th", or "Mon" for weekly. */
export function paydayLabel(schedule: PaySchedule, slot: PaySlot): string {
  switch (schedule.frequency) {
    case "weekly":
      return WEEKDAYS[schedule.payWeekday].slice(0, 3);
    case "monthly":
      return ordinal(schedule.payDay1);
    case "semi_monthly":
      return ordinal(slot === "payday_2" ? schedule.payDay2 : schedule.payDay1);
  }
}

/** One line for the onboarding rail: "Twice a month · 15th & 30th". */
export function describeSchedule(schedule: PaySchedule): string {
  switch (schedule.frequency) {
    case "weekly":
      return `Weekly · ${WEEKDAYS[schedule.payWeekday]}s`;
    case "monthly":
      return `Monthly · ${ordinal(schedule.payDay1)}`;
    case "semi_monthly":
      return `Twice a month · ${ordinal(schedule.payDay1)} & ${ordinal(schedule.payDay2)}`;
  }
}

/** The payday fields of a `budgets` row. */
export type BudgetScheduleFields = {
  frequency: string;
  pay_day_1: number | null;
  pay_day_2: number | null;
  pay_weekday: number | null;
};

/**
 * Turns a budget row into the schedule getPeriod() takes. The database already
 * checks that the fields match the frequency; this guards against a row that
 * was read with some columns missing.
 */
export function scheduleFromBudget(budget: BudgetScheduleFields): PaySchedule {
  const { frequency, pay_day_1, pay_day_2, pay_weekday } = budget;
  if (frequency === "semi_monthly" && pay_day_1 != null && pay_day_2 != null) {
    return { frequency, payDay1: pay_day_1, payDay2: pay_day_2 };
  }
  if (frequency === "monthly" && pay_day_1 != null) {
    return { frequency, payDay1: pay_day_1 };
  }
  // != null, not a truthiness check: Sunday is 0.
  if (frequency === "weekly" && pay_weekday != null) {
    return { frequency, payWeekday: pay_weekday };
  }
  throw new RangeError(`Budget has no usable pay schedule (frequency "${frequency}").`);
}

/**
 * Days left in a period, counting today (dashboard.md §1): Nov 20 in the
 * Nov 15 – 29 period is 10. Both are Manila "YYYY-MM-DD" dates, so whole
 * calendar days are counted with no time zone involved.
 */
export function daysLeft(today: string, end: string): number {
  return differenceInCalendarDays(parseDate(end), parseDate(today)) + 1;
}

/**
 * The period switcher's second line (app-shell.md §4): "15th payday · 10 days
 * left", "15th payday · Last day", "Starts Nov 30" or "Ended Nov 14".
 */
export function periodStatusLine(period: Period, schedule: PaySchedule, today: string): string {
  if (today < period.start) return `Starts ${formatShortDate(period.start)}`;
  if (today > period.end) return `Ended ${formatShortDate(period.end)}`;
  const left = daysLeft(today, period.end);
  const when = left === 1 ? "Last day" : `${left} days left`;
  return `${paydayLabel(schedule, period.paySlot)} payday · ${when}`;
}

/** "Day 1 of 15": today's place in the period, for the first payday period (dashboard.md §4). */
export function periodDayLine(period: Period, today: string): string {
  const length = daysLeft(period.start, period.end);
  return `Day ${length - daysLeft(today, period.end) + 1} of ${length}`;
}

/** "2026-11-15" → "Nov 15". */
export function formatShortDate(date: string): string {
  return format(parseDate(date), "MMM d");
}

// en-CA formats dates as YYYY-MM-DD.
const manilaDate = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Manila",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Today's date in Manila as "YYYY-MM-DD", whatever time zone the server is in. */
export function todayInManila(now: Date): string {
  return manilaDate.format(now);
}

/**
 * Day `day` of a month as "YYYY-MM-DD", moved to the month's last day when the
 * month is too short: the same rule as paydays, for bill and debt due dates.
 * `month` is 1–12 and may run past 12 (13 = January of the next year).
 */
export function dateInMonth(year: number, month: number, day: number): string {
  // The Date constructor rolls month 13 over into the next year.
  const first = new Date(year, month - 1, 1);
  return format(paydayIn(first, day), ISO_DATE);
}

// The payday in the month of `month`, moved to the month's last day when the
// month is too short (payday 31 in November → Nov 30; payday 30 in Feb → Feb 28).
function paydayIn(month: Date, payDay: number): Date {
  const day = Math.min(payDay, getDaysInMonth(month));
  return new Date(month.getFullYear(), month.getMonth(), day);
}

function dayBefore(date: Date): Date {
  return subDays(date, 1);
}

function period(start: Date, end: Date, paySlot: PaySlot): Period {
  return { start: format(start, ISO_DATE), end: format(end, ISO_DATE), paySlot };
}

function parseDate(value: string): Date {
  // parse() is strict about the pattern and rejects dates like Nov 31.
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? parse(value, ISO_DATE, new Date()) : null;
  if (!date || !isValid(date)) {
    throw new RangeError(`Expected a date like 2026-11-19, got "${value}".`);
  }
  return date;
}

// The database checks these too; this stops bad data from producing
// nonsense periods.
function checkSchedule(schedule: PaySchedule) {
  const isDay = (n: number) => Number.isInteger(n) && n >= 1 && n <= 31;

  if (schedule.frequency === "weekly") {
    if (!Number.isInteger(schedule.payWeekday) || schedule.payWeekday < 0 || schedule.payWeekday > 6) {
      throw new RangeError("payWeekday must be 0 (Sunday) to 6 (Saturday).");
    }
    return;
  }
  if (!isDay(schedule.payDay1)) {
    throw new RangeError("payDay1 must be a whole day from 1 to 31.");
  }
  if (schedule.frequency === "semi_monthly") {
    if (!isDay(schedule.payDay2) || schedule.payDay2 <= schedule.payDay1) {
      throw new RangeError("payDay2 must be a day from 1 to 31, after payDay1.");
    }
    // February has 28 days, so payday 2 can land on the 28th. Payday 1 must
    // come before that, or both paydays would fall on the same day.
    if (schedule.payDay1 > 27) {
      throw new RangeError("payDay1 must be the 27th or earlier.");
    }
  }
}

/** "2027-02-28" → "Feb 2027", for goal dates (savings.md §2 "On track for…"). */
export function formatMonthYear(date: string): string {
  return format(parseDate(date), "MMM yyyy");
}
