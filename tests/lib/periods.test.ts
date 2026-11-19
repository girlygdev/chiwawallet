import { describe, expect, it } from "vitest";
import {
  describeSchedule,
  formatPeriodRange,
  getPeriod,
  nextPeriods,
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
      { start: "2026-11-15", end: "2026-11-29", paySlot: "payday_1" },
      { start: "2026-11-30", end: "2026-12-14", paySlot: "payday_2" },
      { start: "2026-12-15", end: "2026-12-29", paySlot: "payday_1" },
      { start: "2026-12-30", end: "2027-01-14", paySlot: "payday_2" },
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

describe("todayInManila", () => {
  it("uses Manila's date, not UTC's", () => {
    // 16:30 UTC is 00:30 the next day in Manila (UTC+8).
    expect(todayInManila(new Date("2026-11-19T16:30:00Z"))).toBe("2026-11-20");
    expect(todayInManila(new Date("2026-11-19T15:59:00Z"))).toBe("2026-11-19");
  });
});
