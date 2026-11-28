import { describe, expect, it } from "vitest";
import {
  actualPeriod,
  dateInMonth,
  formatMonthYear,
  daysLeft,
  describeSchedule,
  periodDayLine,
  periodStatusLine,
  formatPeriodRange,
  formatShortDate,
  getPeriod,
  nextPeriods,
  periodAt,
  ordinal,
  paydayLabel,
  type PaySchedule,
  scheduleFromBudget,
  todayInManila,
} from "@/lib/periods";

const semi = (payDay1: number, payDay2: number): PaySchedule => ({
  frequency: "semi_monthly",
  payDay1,
  payDay2,
});
const monthly = (payDay1: number): PaySchedule => ({ frequency: "monthly", payDay1 });
// payWeekday uses JavaScript and Postgres numbering: 0 = Sunday … 6 = Saturday.
const weekly = (payWeekday: number): PaySchedule => ({ frequency: "weekly", payWeekday });

describe("getPeriod: semi-monthly 10th and 25th", () => {
  const s = semi(10, 25);

  it("between paydays is the payday 1 period", () => {
    expect(getPeriod("2026-11-19", s)).toEqual({
      start: "2026-11-10",
      end: "2026-11-24",
      paySlot: "payday_1",
    });
  });

  it("payday itself starts the period", () => {
    expect(getPeriod("2026-11-10", s).start).toBe("2026-11-10");
  });

  it("the day before the next payday is the period's last day", () => {
    expect(getPeriod("2026-11-24", s)).toEqual({
      start: "2026-11-10",
      end: "2026-11-24",
      paySlot: "payday_1",
    });
  });

  it("from payday 2 the period runs to the day before next month's payday 1", () => {
    expect(getPeriod("2026-11-25", s)).toEqual({
      start: "2026-11-25",
      end: "2026-12-09",
      paySlot: "payday_2",
    });
  });

  it("before payday 1 belongs to last month's payday 2 period", () => {
    expect(getPeriod("2026-11-05", s)).toEqual({
      start: "2026-10-25",
      end: "2026-11-09",
      paySlot: "payday_2",
    });
  });

  it("crosses New Year", () => {
    expect(getPeriod("2027-01-03", s)).toEqual({
      start: "2026-12-25",
      end: "2027-01-09",
      paySlot: "payday_2",
    });
  });
});

describe("getPeriod: semi-monthly 15th and 30th", () => {
  const s = semi(15, 30);

  it("a normal month", () => {
    expect(getPeriod("2026-11-19", s)).toEqual({
      start: "2026-11-15",
      end: "2026-11-29",
      paySlot: "payday_1",
    });
  });

  it("January's 30th period runs into February", () => {
    expect(getPeriod("2027-01-31", s)).toEqual({
      start: "2027-01-30",
      end: "2027-02-14",
      paySlot: "payday_2",
    });
  });

  it("in February the 30th becomes Feb 28, so payday 1's period ends Feb 27", () => {
    expect(getPeriod("2027-02-27", s)).toEqual({
      start: "2027-02-15",
      end: "2027-02-27",
      paySlot: "payday_1",
    });
  });

  it("Feb 28 starts the payday 2 period", () => {
    expect(getPeriod("2027-02-28", s)).toEqual({
      start: "2027-02-28",
      end: "2027-03-14",
      paySlot: "payday_2",
    });
  });

  it("in a leap year the 30th becomes Feb 29", () => {
    expect(getPeriod("2028-02-28", s)).toEqual({
      start: "2028-02-15",
      end: "2028-02-28",
      paySlot: "payday_1",
    });
    expect(getPeriod("2028-02-29", s)).toEqual({
      start: "2028-02-29",
      end: "2028-03-14",
      paySlot: "payday_2",
    });
  });

  it("crosses New Year", () => {
    expect(getPeriod("2026-12-31", s)).toEqual({
      start: "2026-12-30",
      end: "2027-01-14",
      paySlot: "payday_2",
    });
  });
});

describe("getPeriod: payday on the 31st", () => {
  it("semi-monthly 15th and 31st: a 30-day month pays on the 30th", () => {
    expect(getPeriod("2026-11-29", semi(15, 31))).toEqual({
      start: "2026-11-15",
      end: "2026-11-29",
      paySlot: "payday_1",
    });
    expect(getPeriod("2026-11-30", semi(15, 31))).toEqual({
      start: "2026-11-30",
      end: "2026-12-14",
      paySlot: "payday_2",
    });
  });

  it("monthly on the 31st: a 30-day month ends the period a day early", () => {
    expect(getPeriod("2026-11-19", monthly(31))).toEqual({
      start: "2026-10-31",
      end: "2026-11-29",
      paySlot: "every",
    });
    expect(getPeriod("2026-11-30", monthly(31))).toEqual({
      start: "2026-11-30",
      end: "2026-12-30",
      paySlot: "every",
    });
  });

  it("monthly on the 31st through February", () => {
    expect(getPeriod("2027-02-10", monthly(31))).toEqual({
      start: "2027-01-31",
      end: "2027-02-27",
      paySlot: "every",
    });
    expect(getPeriod("2027-02-28", monthly(31))).toEqual({
      start: "2027-02-28",
      end: "2027-03-30",
      paySlot: "every",
    });
  });
});

describe("getPeriod: monthly", () => {
  it("on the 1st, the period is the calendar month", () => {
    expect(getPeriod("2026-11-19", monthly(1))).toEqual({
      start: "2026-11-01",
      end: "2026-11-30",
      paySlot: "every",
    });
  });

  it("on the 15th, crossing New Year", () => {
    expect(getPeriod("2027-01-10", monthly(15))).toEqual({
      start: "2026-12-15",
      end: "2027-01-14",
      paySlot: "every",
    });
  });
});

describe("getPeriod: weekly", () => {
  // Nov 19, 2026 is a Thursday.
  it("Monday paydays: Monday to Sunday", () => {
    expect(getPeriod("2026-11-19", weekly(1))).toEqual({
      start: "2026-11-16",
      end: "2026-11-22",
      paySlot: "every",
    });
  });

  it("Sunday paydays: Sunday to Saturday", () => {
    expect(getPeriod("2026-11-19", weekly(0))).toEqual({
      start: "2026-11-15",
      end: "2026-11-21",
      paySlot: "every",
    });
  });

  it("payday itself starts the period, and the day before ends the last one", () => {
    expect(getPeriod("2026-11-16", weekly(1)).start).toBe("2026-11-16");
    expect(getPeriod("2026-11-15", weekly(1)).end).toBe("2026-11-15");
  });

  it("crosses New Year", () => {
    // Dec 28, 2026 is a Monday.
    expect(getPeriod("2027-01-01", weekly(1))).toEqual({
      start: "2026-12-28",
      end: "2027-01-03",
      paySlot: "every",
    });
  });
});

describe("getPeriod: rejects bad input", () => {
  it("dates that aren't YYYY-MM-DD or don't exist", () => {
    expect(() => getPeriod("2026-11-31", monthly(1))).toThrow(RangeError);
    expect(() => getPeriod("19/11/2026", monthly(1))).toThrow(RangeError);
  });

  it("paydays outside 1–31", () => {
    expect(() => getPeriod("2026-11-19", monthly(0))).toThrow(RangeError);
    expect(() => getPeriod("2026-11-19", monthly(32))).toThrow(RangeError);
    expect(() => getPeriod("2026-11-19", monthly(1.5))).toThrow(RangeError);
  });

  it("payday 2 on or before payday 1", () => {
    expect(() => getPeriod("2026-11-19", semi(25, 10))).toThrow(RangeError);
    expect(() => getPeriod("2026-11-19", semi(15, 15))).toThrow(RangeError);
  });

  it("payday 1 after the 27th, which could land on payday 2 in February", () => {
    expect(() => getPeriod("2026-11-19", semi(28, 30))).toThrow(RangeError);
  });

  it("weekdays outside 0–6", () => {
    expect(() => getPeriod("2026-11-19", weekly(7))).toThrow(RangeError);
    expect(() => getPeriod("2026-11-19", weekly(-1))).toThrow(RangeError);
  });
});

describe("formatPeriodRange", () => {
  it("same month: month once", () => {
    expect(formatPeriodRange("2026-11-15", "2026-11-29")).toBe("Nov 15 – 29");
  });

  it("different months: both months", () => {
    expect(formatPeriodRange("2026-11-30", "2026-12-14")).toBe("Nov 30 – Dec 14");
  });

  it("different years: both years", () => {
    expect(formatPeriodRange("2026-12-30", "2027-01-14")).toBe(
      "Dec 30, 2026 – Jan 14, 2027",
    );
  });
});

describe("scheduleFromBudget", () => {
  const row = (fields: Partial<Parameters<typeof scheduleFromBudget>[0]>) => ({
    frequency: "semi_monthly",
    pay_day_1: null,
    pay_day_2: null,
    pay_weekday: null,
    ...fields,
  });

  it("semi-monthly", () => {
    expect(scheduleFromBudget(row({ pay_day_1: 15, pay_day_2: 30 }))).toEqual({
      frequency: "semi_monthly",
      payDay1: 15,
      payDay2: 30,
    });
  });

  it("monthly", () => {
    expect(scheduleFromBudget(row({ frequency: "monthly", pay_day_1: 31 }))).toEqual({
      frequency: "monthly",
      payDay1: 31,
    });
  });

  it("weekly, including Sunday (0)", () => {
    expect(scheduleFromBudget(row({ frequency: "weekly", pay_weekday: 0 }))).toEqual({
      frequency: "weekly",
      payWeekday: 0,
    });
  });

  it("rejects rows missing the fields their frequency needs", () => {
    expect(() => scheduleFromBudget(row({ pay_day_1: 15 }))).toThrow(RangeError);
    expect(() => scheduleFromBudget(row({ frequency: "monthly" }))).toThrow(RangeError);
    expect(() => scheduleFromBudget(row({ frequency: "weekly" }))).toThrow(RangeError);
    expect(() => scheduleFromBudget(row({ frequency: "fortnightly", pay_day_1: 1 }))).toThrow(
      RangeError,
    );
  });
});

describe("nextPeriods: the onboarding preview list", () => {
  it("starts with the period containing the date, then follows on without gaps", () => {
    expect(nextPeriods("2026-11-19", semi(15, 30), 4)).toEqual([
      { start: "2026-11-15", end: "2026-11-29", paySlot: "payday_1", firstDay: "2026-11-15" },
      { start: "2026-11-30", end: "2026-12-14", paySlot: "payday_2", firstDay: "2026-11-30" },
      { start: "2026-12-15", end: "2026-12-29", paySlot: "payday_1", firstDay: "2026-12-15" },
      { start: "2026-12-30", end: "2027-01-14", paySlot: "payday_2", firstDay: "2026-12-30" },
    ]);
  });

  it("weekly", () => {
    expect(nextPeriods("2026-11-19", weekly(1), 2).map((p) => p.start)).toEqual([
      "2026-11-16",
      "2026-11-23",
    ]);
  });
});

describe("ordinal", () => {
  it.each([
    [1, "1st"],
    [2, "2nd"],
    [3, "3rd"],
    [4, "4th"],
    [11, "11th"],
    [12, "12th"],
    [13, "13th"],
    [21, "21st"],
    [22, "22nd"],
    [23, "23rd"],
    [30, "30th"],
    [31, "31st"],
  ])("%d → %s", (n, text) => {
    expect(ordinal(n)).toBe(text);
  });
});

describe("paydayLabel and describeSchedule", () => {
  it("twice a month uses the chosen days", () => {
    expect(paydayLabel(semi(15, 30), "payday_1")).toBe("15th");
    expect(paydayLabel(semi(15, 30), "payday_2")).toBe("30th");
    expect(describeSchedule(semi(15, 30))).toBe("Twice a month · 15th & 30th");
  });

  it("monthly", () => {
    expect(paydayLabel(monthly(31), "every")).toBe("31st");
    expect(describeSchedule(monthly(31))).toBe("Monthly · 31st");
  });

  it("weekly uses the weekday", () => {
    expect(paydayLabel(weekly(0), "every")).toBe("Sun");
    expect(describeSchedule(weekly(5))).toBe("Weekly · Fridays");
  });
});

describe("daysLeft: counting today, in Manila dates (dashboard.md §1)", () => {
  it.each([
    ["2026-11-20", "2026-11-29", 10], // the spec's example
    ["2026-11-15", "2026-11-29", 15],
    ["2026-11-29", "2026-11-29", 1],
    ["2026-12-30", "2027-01-14", 16], // across New Year
    ["2028-02-28", "2028-02-29", 2], // leap day
  ])("%s to %s → %d", (today, end, days) => {
    expect(daysLeft(today, end)).toBe(days);
  });
});

describe("periodStatusLine: the switcher's second line", () => {
  const semi15 = { frequency: "semi_monthly", payDay1: 15, payDay2: 30 } as const;
  const period = { start: "2026-11-15", end: "2026-11-29", paySlot: "payday_1" } as const;

  it("days left in the current period", () => {
    expect(periodStatusLine(period, semi15, "2026-11-20")).toBe("15th payday · 10 days left");
    expect(periodStatusLine(period, semi15, "2026-11-28")).toBe("15th payday · 2 days left");
  });

  it("the last day", () => {
    expect(periodStatusLine(period, semi15, "2026-11-29")).toBe("15th payday · Last day");
  });

  it("future and past periods", () => {
    expect(periodStatusLine(period, semi15, "2026-11-10")).toBe("Starts Nov 15");
    expect(periodStatusLine(period, semi15, "2026-12-01")).toBe("Ended Nov 29");
  });

  it("weekly says the weekday", () => {
    const weeklyPeriod = { start: "2026-11-16", end: "2026-11-22", paySlot: "every" } as const;
    expect(periodStatusLine(weeklyPeriod, { frequency: "weekly", payWeekday: 1 }, "2026-11-19")).toBe(
      "Mon payday · 4 days left",
    );
  });
});

describe("formatShortDate", () => {
  it("month and day", () => {
    expect(formatShortDate("2026-11-15")).toBe("Nov 15");
    expect(formatShortDate("2027-01-01")).toBe("Jan 1");
  });
});

describe("todayInManila", () => {
  it("uses Manila's date, not UTC's", () => {
    // 16:30 UTC is 00:30 the next day in Manila (UTC+8).
    expect(todayInManila(new Date("2026-11-19T16:30:00Z"))).toBe("2026-11-20");
    expect(todayInManila(new Date("2026-11-19T15:59:00Z"))).toBe("2026-11-19");
  });
});

describe("dateInMonth", () => {
  it("moves a day the month doesn't have to its last day", () => {
    expect(dateInMonth(2026, 11, 31)).toBe("2026-11-30");
    expect(dateInMonth(2027, 2, 30)).toBe("2027-02-28");
    expect(dateInMonth(2028, 2, 29)).toBe("2028-02-29");
    expect(dateInMonth(2026, 12, 15)).toBe("2026-12-15");
  });

  it("rolls months past 12 into the next year", () => {
    expect(dateInMonth(2026, 13, 31)).toBe("2027-01-31");
    expect(dateInMonth(2026, 14, 31)).toBe("2027-02-28");
  });
});

describe("formatMonthYear", () => {
  it("shows a date's month and year", () => {
    expect(formatMonthYear("2027-02-28")).toBe("Feb 2027");
  });
});

describe("periodDayLine: 'Day 1 of 15' for the first payday period", () => {
  const period = { start: "2026-11-15", end: "2026-11-29", paySlot: "payday_1" as const };

  it.each([
    ["2026-11-15", "Day 1 of 15"],
    ["2026-11-22", "Day 8 of 15"],
    ["2026-11-29", "Day 15 of 15"],
  ])("%s → %s", (today, text) => {
    expect(periodDayLine(period, today)).toBe(text);
  });
});

describe("periodAt: periods with an early start (Task D1, owner Nov 28)", () => {
  const semi: PaySchedule = { frequency: "semi_monthly", payDay1: 15, payDay2: 30 };
  // The Nov 30 period started early, on Nov 28.
  const early = { "2026-11-30": "2026-11-28" };
  const nov15 = { start: "2026-11-15", paySlot: "payday_1" };
  const nov30 = { start: "2026-11-30", paySlot: "payday_2" };

  it("is getPeriod() with firstDay = start when nothing started early", () => {
    expect(periodAt("2026-11-20", semi)).toEqual({ start: "2026-11-15", end: "2026-11-29", paySlot: "payday_1", firstDay: "2026-11-15" });
    expect(periodAt("2026-11-20", semi, {})).toEqual(periodAt("2026-11-20", semi));
  });

  it("shortens the period before an early start", () => {
    for (const date of ["2026-11-15", "2026-11-20", "2026-11-27"]) {
      expect(periodAt(date, semi, early)).toEqual({ ...nov15, end: "2026-11-27", firstDay: "2026-11-15" });
    }
  });

  it("moves the early days into the next period, which keeps its payday as start", () => {
    for (const date of ["2026-11-28", "2026-11-29", "2026-11-30", "2026-12-14"]) {
      expect(periodAt(date, semi, early)).toEqual({ ...nov30, end: "2026-12-14", firstDay: "2026-11-28" });
    }
  });

  it("leaves other periods alone", () => {
    expect(periodAt("2026-12-15", semi, early)).toEqual({ start: "2026-12-15", end: "2026-12-29", paySlot: "payday_1", firstDay: "2026-12-15" });
    expect(periodAt("2026-11-10", semi, early).end).toBe("2026-11-14");
  });

  it("handles a payday moved to the month's end (Feb 28)", () => {
    // The 30th in February 2027 is the 28th; that period started early on the 25th.
    const feb = { "2027-02-28": "2027-02-25" };
    expect(periodAt("2027-02-24", semi, feb)).toMatchObject({ start: "2027-02-15", end: "2027-02-24" });
    expect(periodAt("2027-02-25", semi, feb)).toEqual({ start: "2027-02-28", end: "2027-03-14", paySlot: "payday_2", firstDay: "2027-02-25" });
  });

  it("works for monthly and weekly budgets", () => {
    const monthly: PaySchedule = { frequency: "monthly", payDay1: 1 };
    expect(periodAt("2026-11-29", monthly, { "2026-12-01": "2026-11-28" })).toMatchObject({ start: "2026-12-01", firstDay: "2026-11-28" });
    expect(periodAt("2026-11-27", monthly, { "2026-12-01": "2026-11-28" })).toMatchObject({ start: "2026-11-01", end: "2026-11-27" });
    // Paid on Fridays: Dec 4, 2026 is a Friday; started early on Wednesday Dec 2.
    const weekly: PaySchedule = { frequency: "weekly", payWeekday: 5 };
    expect(periodAt("2026-12-02", weekly, { "2026-12-04": "2026-12-02" })).toMatchObject({ start: "2026-12-04", firstDay: "2026-12-02" });
    expect(periodAt("2026-12-01", weekly, { "2026-12-04": "2026-12-02" })).toMatchObject({ start: "2026-11-27", end: "2026-12-01" });
  });

  it("ignores an early start that isn't after the period before it began", () => {
    // Nonsense data (the database refuses it): Nov 30 "started" on Nov 10.
    expect(periodAt("2026-11-20", semi, { "2026-11-30": "2026-11-10" })).toMatchObject({ start: "2026-11-15", end: "2026-11-29" });
  });
});

describe("early starts in the other period helpers (Task D2, owner Nov 28)", () => {
  const semi: PaySchedule = { frequency: "semi_monthly", payDay1: 15, payDay2: 30 };
  const early = { "2026-11-30": "2026-11-28" };

  it("actualPeriod() gives a getPeriod() period its real days", () => {
    expect(actualPeriod(getPeriod("2026-11-20", semi), semi, early)).toEqual({
      start: "2026-11-15", end: "2026-11-27", paySlot: "payday_1", firstDay: "2026-11-15",
    });
    expect(actualPeriod(getPeriod("2026-12-01", semi), semi, early)).toMatchObject({ start: "2026-11-30", firstDay: "2026-11-28" });
  });

  it("nextPeriods() starts from the period a date is really in", () => {
    const [first, second] = nextPeriods("2026-11-28", semi, 2, early);
    expect(first).toMatchObject({ start: "2026-11-30", firstDay: "2026-11-28", end: "2026-12-14" });
    expect(second).toMatchObject({ start: "2026-12-15", end: "2026-12-29" });
    expect(nextPeriods("2026-11-27", semi, 2, early).map((p) => [p.start, p.end])).toEqual([
      ["2026-11-15", "2026-11-27"],
      ["2026-11-30", "2026-12-14"],
    ]);
  });

  it("periodStatusLine() counts a started-early period as started", () => {
    const nov30 = { start: "2026-11-30", end: "2026-12-14", paySlot: "payday_2", firstDay: "2026-11-28" } as const;
    expect(periodStatusLine(nov30, semi, "2026-11-28")).toBe("30th payday · 17 days left");
    expect(periodStatusLine(nov30, semi, "2026-11-27")).toBe("Starts Nov 28");
  });

  it("periodDayLine() counts from the day it began", () => {
    const nov30 = { start: "2026-11-30", end: "2026-12-14", paySlot: "payday_2", firstDay: "2026-11-28" } as const;
    expect(periodDayLine(nov30, "2026-11-28")).toBe("Day 1 of 17");
  });
});
