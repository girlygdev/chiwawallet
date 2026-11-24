import { describe, expect, it } from "vitest";
import {
  billDueDates,
  billMonths,
  billScheduleLine,
  billsPerMonth,
  billsPerPayday,
  billStatus,
  billTotalsChange,
  heavyPayday,
  nextBillDue,
  paydayShares,
  splitHalves,
  suggestedBillSlot,
} from "@/lib/bills";

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

const twiceAMonth = { frequency: "semi_monthly" as const, payDay1: 15, payDay2: 30 };
const bill = (amount: number, frequency: "monthly" | "quarterly" | "yearly", pay_slot: string) => ({ amount, frequency, pay_slot });

describe("billsPerPayday", () => {
  it("adds each payday's bills as monthly amounts; split bills count half on each (bills.md §1)", () => {
    // 15th: ₱1,700 + half of ₱2,000 = ₱2,700. 30th: ₱3,000 quarterly (₱1,000 a month) + half of ₱2,000 + ₱6,000 yearly (₱500) = ₱2,500.
    expect(
      billsPerPayday(
        [
          bill(170_000, "monthly", "payday_1"),
          bill(200_000, "monthly", "split"),
          bill(300_000, "quarterly", "payday_2"),
          bill(600_000, "yearly", "payday_2"),
        ],
        twiceAMonth,
      ),
    ).toEqual({ payday_1: 270_000, payday_2: 250_000 });
  });

  it("is null on one-payday budgets (the per-payday section is hidden)", () => {
    expect(billsPerPayday([bill(170_000, "monthly", "every")], { frequency: "monthly", payDay1: 30 })).toBeNull();
    expect(billsPerPayday([bill(170_000, "monthly", "every")], { frequency: "weekly", payWeekday: 5 })).toBeNull();
  });
});

describe("heavyPayday", () => {
  it("names the payday carrying more than 60%", () => {
    expect(heavyPayday({ payday_1: 610, payday_2: 390 })).toBe("payday_1");
    expect(heavyPayday({ payday_1: 300, payday_2: 700 })).toBe("payday_2");
  });

  it("is null when balanced (60% or less each), or with no bills", () => {
    expect(heavyPayday({ payday_1: 600, payday_2: 400 })).toBeNull();
    expect(heavyPayday({ payday_1: 270_000, payday_2: 250_000 })).toBeNull();
    expect(heavyPayday({ payday_1: 0, payday_2: 0 })).toBeNull();
  });
});

describe("suggestedBillSlot", () => {
  it("is the last payday on or before the due day (bills.md §1)", () => {
    expect(suggestedBillSlot(10, twiceAMonth)).toBe("payday_2"); // the 30th, the month before
    expect(suggestedBillSlot(22, twiceAMonth)).toBe("payday_1");
    expect(suggestedBillSlot(15, twiceAMonth)).toBe("payday_1");
    expect(suggestedBillSlot(30, twiceAMonth)).toBe("payday_2");
    expect(suggestedBillSlot(31, twiceAMonth)).toBe("payday_2");
  });

  it("is every on one-payday budgets", () => {
    expect(suggestedBillSlot(10, { frequency: "monthly", payDay1: 30 })).toBe("every");
  });
});

describe("billStatus", () => {
  const period = { start: "2026-11-15", end: "2026-11-29" };

  it("is due when a due date falls in the current period", () => {
    expect(billStatus(monthly(22), period)).toEqual({ kind: "due", date: "2026-11-22" });
  });

  it("otherwise shows the next due date after the period", () => {
    expect(billStatus(monthly(10), period)).toEqual({ kind: "next", date: "2026-12-10" });
    expect(billStatus({ frequency: "yearly", due_day: 30, first_due_month: 3 }, period)).toEqual({
      kind: "next",
      date: "2027-03-30",
    });
  });
});

describe("billScheduleLine", () => {
  it("says when it's due", () => {
    expect(billScheduleLine(monthly(20), "2026-11-20")).toBe("Due every 20th");
    expect(billScheduleLine({ frequency: "quarterly", due_day: 5, first_due_month: 11 }, "2026-11-20")).toBe(
      "Quarterly · 5th of Feb, May, Aug, Nov",
    );
    expect(billScheduleLine({ frequency: "yearly", due_day: 30, first_due_month: 11 }, "2026-11-20")).toBe(
      "Yearly · next Nov 30",
    );
  });
});

describe("splitHalves", () => {
  it("splits a bill across both paydays; an odd centavo goes to the second", () => {
    expect(splitHalves(200_000)).toEqual({ payday_1: 100_000, payday_2: 100_000 });
    expect(splitHalves(45_001)).toEqual({ payday_1: 22_500, payday_2: 22_501 });
  });
});

describe("paydayShares", () => {
  it("is each payday's share of the bills, for the bars", () => {
    expect(paydayShares({ payday_1: 300, payday_2: 100 })).toEqual({ payday_1: 0.75, payday_2: 0.25 });
    expect(paydayShares({ payday_1: 0, payday_2: 0 })).toEqual({ payday_1: 0, payday_2: 0 });
  });
});

describe("billTotalsChange", () => {
  const water = bill(45_000, "monthly", "payday_2");
  const internet = bill(170_000, "monthly", "payday_1");

  it("twice a month: each payday's bills before → after, marking the unchanged one (bills.md §4)", () => {
    expect(billTotalsChange([internet], [internet, water], twiceAMonth)).toEqual([
      { slot: "payday_1", label: "15th payday bills", before: 170_000, after: 170_000 },
      { slot: "payday_2", label: "30th payday bills", before: 0, after: 45_000 },
    ]);
  });

  it("one payday: bills each month", () => {
    const monthlyBudget = { frequency: "monthly" as const, payDay1: 30 };
    expect(billTotalsChange([{ ...water, pay_slot: "every" }], [], monthlyBudget)).toEqual([
      { slot: "every", label: "Bills each month", before: 45_000, after: 0 },
    ]);
  });
});
