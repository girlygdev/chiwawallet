import { describe, expect, it } from "vitest";
import { billDueDates, billMonths, billsPerMonth, nextBillDue } from "@/lib/bills";

const monthly = (due_day: number) => ({ frequency: "monthly" as const, due_day, first_due_month: null });

describe("billMonths", () => {
  it("monthly bills are due every month", () => {
    expect(billMonths(monthly(20))).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  });

  it("quarterly bills are due every 3 months from the first month, sorted", () => {
    expect(billMonths({ frequency: "quarterly", due_day: 1, first_due_month: 2 })).toEqual([2, 5, 8, 11]);
    expect(billMonths({ frequency: "quarterly", due_day: 1, first_due_month: 11 })).toEqual([2, 5, 8, 11]);
    expect(billMonths({ frequency: "quarterly", due_day: 1, first_due_month: 12 })).toEqual([3, 6, 9, 12]);
  });

  it("yearly bills are due in their one month", () => {
    expect(billMonths({ frequency: "yearly", due_day: 30, first_due_month: 11 })).toEqual([11]);
  });
});

describe("billDueDates", () => {
  it("moves a day the month doesn't have to its last day", () => {
    expect(billDueDates(monthly(31), "2026-11-01", "2027-03-31")).toEqual([
      "2026-11-30",
      "2026-12-31",
      "2027-01-31",
      "2027-02-28",
      "2027-03-31",
    ]);
  });

  it("finds the due dates inside one period, ends included", () => {
    expect(billDueDates(monthly(20), "2026-11-15", "2026-11-29")).toEqual(["2026-11-20"]);
    expect(billDueDates(monthly(15), "2026-11-15", "2026-11-29")).toEqual(["2026-11-15"]);
    expect(billDueDates(monthly(29), "2026-11-15", "2026-11-29")).toEqual(["2026-11-29"]);
    expect(billDueDates(monthly(5), "2026-11-15", "2026-11-29")).toEqual([]);
  });

  it("handles a period that crosses into the next month", () => {
    expect(billDueDates(monthly(5), "2026-11-30", "2026-12-14")).toEqual(["2026-12-05"]);
  });

  it("quarterly: only its months", () => {
    expect(billDueDates({ frequency: "quarterly", due_day: 30, first_due_month: 2 }, "2027-01-01", "2027-12-31")).toEqual([
      "2027-02-28",
      "2027-05-30",
      "2027-08-30",
      "2027-11-30",
    ]);
  });

  it("yearly on Feb 29: the 28th in ordinary years, the 29th in leap years", () => {
    const bill = { frequency: "yearly" as const, due_day: 29, first_due_month: 2 };
    expect(billDueDates(bill, "2027-01-01", "2028-12-31")).toEqual(["2027-02-28", "2028-02-29"]);
  });

  it("returns nothing for a range that ends before it starts", () => {
    expect(billDueDates(monthly(20), "2026-11-29", "2026-11-15")).toEqual([]);
  });
});

describe("nextBillDue", () => {
  it("is the due date on or after the given day", () => {
    expect(nextBillDue(monthly(20), "2026-11-20")).toBe("2026-11-20");
    expect(nextBillDue(monthly(20), "2026-11-21")).toBe("2026-12-20");
    expect(nextBillDue(monthly(31), "2027-02-01")).toBe("2027-02-28");
  });

  it("finds a yearly bill almost a year away", () => {
    expect(nextBillDue({ frequency: "yearly", due_day: 30, first_due_month: 11 }, "2026-12-01")).toBe("2027-11-30");
  });
});

describe("billsPerMonth", () => {
  it("adds monthly, quarterly ÷ 3 and yearly ÷ 12 (bills.md §1)", () => {
    expect(
      billsPerMonth([
        { amount: 170_000, frequency: "monthly" },
        { amount: 300_000, frequency: "quarterly" },
        { amount: 3_000_000, frequency: "yearly" },
      ]),
    ).toBe(520_000);
  });

  it("rounds once, to the nearest centavo", () => {
    expect(billsPerMonth([{ amount: 100, frequency: "quarterly" }])).toBe(33);
    expect(billsPerMonth([{ amount: 100, frequency: "quarterly" }, { amount: 100, frequency: "quarterly" }])).toBe(67);
  });

  it("is 0 with no bills", () => {
    expect(billsPerMonth([])).toBe(0);
  });
});
