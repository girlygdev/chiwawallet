import { describe, expect, it } from "vitest";
import {
  debtPaid,
  debtProgress,
  debtSchedule,
  debtsSummary,
  flexibleMonthly,
  isPaidOff,
  paydayFor,
  paymentStatusText,
} from "@/lib/debts";

const spayLater = {
  total_amount: 1_200_000,
  payment_type: "installments" as const,
  num_payments: 3,
  payment_amount: 400_000,
  first_due_date: "2026-11-25",
};
const period = { start: "2026-11-15", end: "2026-11-29" };

describe("debtSchedule", () => {
  it("installments: monthly from the first due date", () => {
    expect(debtSchedule(spayLater)).toEqual([
      { number: 1, due: "2026-11-25", amount: 400_000 },
      { number: 2, due: "2026-12-25", amount: 400_000 },
      { number: 3, due: "2027-01-25", amount: 400_000 },
    ]);
  });

  it("the last payment is what's left when it doesn't divide evenly", () => {
    const amounts = debtSchedule({ ...spayLater, total_amount: 1_000_000, payment_amount: 333_400 }).map((p) => p.amount);
    expect(amounts).toEqual([333_400, 333_400, 333_200]);
    expect(amounts.reduce((a, b) => a + b)).toBe(1_000_000);
  });

  it("keeps the 31st: the month's last day when it's shorter (debts.md fix #5)", () => {
    expect(debtSchedule({ ...spayLater, first_due_date: "2027-01-31" }).map((p) => p.due)).toEqual([
      "2027-01-31",
      "2027-02-28",
      "2027-03-31",
    ]);
  });

  it("a one-time debt is one payment of the whole amount", () => {
    expect(
      debtSchedule({
        total_amount: 500_000,
        payment_type: "one_time",
        num_payments: 1,
        payment_amount: 500_000,
        first_due_date: "2026-12-15",
      }),
    ).toEqual([{ number: 1, due: "2026-12-15", amount: 500_000 }]);
  });
});

describe("debtPaid", () => {
  it("adds the debt's payments, skipping deleted ones", () => {
    expect(
      debtPaid([
        { amount: 400_000, deleted_at: null },
        { amount: 100_000, deleted_at: null },
        { amount: 999_999, deleted_at: "2026-11-20T00:00:00Z" },
      ]),
    ).toBe(500_000);
  });
});

describe("debtProgress", () => {
  const statuses = (paid: number, today: string) =>
    debtProgress(spayLater, paid, today, period).payments.map((p) => [p.status, p.daysLate ?? null]);

  it("a payment due in the current period is Due; later ones are Planned", () => {
    expect(statuses(0, "2026-11-20")).toEqual([
      ["due", null],
      ["planned", null],
      ["planned", null],
    ]);
  });

  it("an unpaid payment after its due date is Late, with the days", () => {
    expect(statuses(0, "2026-11-28")).toEqual([
      ["late", 3],
      ["planned", null],
      ["planned", null],
    ]);
  });

  it("payments count in order; a part-payment doesn't mark the next one paid", () => {
    expect(statuses(600_000, "2026-11-20")).toEqual([
      ["paid", null],
      ["planned", null],
      ["planned", null],
    ]);
  });

  it("works out paid, left, payments made and the debt-free date", () => {
    expect(debtProgress(spayLater, 400_000, "2026-11-20", period)).toMatchObject({
      paid: 400_000,
      left: 800_000,
      paymentsMade: 1,
      paidOff: false,
      debtFreeBy: "2027-01-25",
    });
  });

  it("is paid off at ₱0 left, and never goes below ₱0", () => {
    expect(debtProgress(spayLater, 1_200_000, "2026-11-20", period)).toMatchObject({ left: 0, paidOff: true, paymentsMade: 3 });
    expect(debtProgress(spayLater, 1_300_000, "2026-11-20", period)).toMatchObject({ left: 0, paidOff: true });
  });
});

const twiceAMonth = { frequency: "semi_monthly" as const, payDay1: 15, payDay2: 30 };

describe("paydayFor", () => {
  it("is the payday of the period that contains the due date (debts.md §1)", () => {
    expect(paydayFor("2026-11-25", twiceAMonth)).toBe("2026-11-15");
    expect(paydayFor("2026-12-05", twiceAMonth)).toBe("2026-11-30");
  });
});

describe("debtsSummary", () => {
  // debts.md §1–3: SPayLater (₱12,000 in 3, one paid) and finished shoes (₱10,000).
  const debts = [
    {
      name: "SPayLater",
      total_amount: 1_200_000,
      payment_type: "installments" as const,
      num_payments: 3,
      payment_amount: 400_000,
      first_due_date: "2026-10-25",
      paid: 400_000,
      paid_off_at: null,
    },
    {
      name: "Shoes installment",
      total_amount: 1_000_000,
      payment_type: "one_time" as const,
      num_payments: 1,
      payment_amount: 1_000_000,
      first_due_date: "2026-10-30",
      paid: 1_000_000,
      paid_off_at: null,
    },
  ];

  it("works out the page's numbers", () => {
    expect(debtsSummary(debts, "2026-11-20", period)).toEqual({
      totalOwed: 800_000,
      activeTotal: 1_200_000,
      activePaid: 400_000,
      dueThisPeriod: 400_000,
      nextDue: { name: "SPayLater", date: "2026-11-25" },
      debtFreeBy: "2026-12-25",
      paidSoFar: 1_400_000,
      activeCount: 1,
      paidOffCount: 1,
    });
  });

  it("a debt marked paid off counts as finished even with money left", () => {
    const marked = [{ ...debts[0], paid_off_at: "2026-11-20T00:00:00Z" }];
    expect(debtsSummary(marked, "2026-11-20", period)).toMatchObject({ totalOwed: 0, activeCount: 0, paidOffCount: 1, debtFreeBy: null });
  });

  it("is all zeros with no debts", () => {
    expect(debtsSummary([], "2026-11-20", period)).toMatchObject({ totalOwed: 0, nextDue: null, debtFreeBy: null });
  });
});

describe("isPaidOff", () => {
  it("is paid off when marked, or when nothing is left", () => {
    expect(isPaidOff({ total_amount: 100, paid: 100, paid_off_at: null })).toBe(true);
    expect(isPaidOff({ total_amount: 100, paid: 50, paid_off_at: "2026-11-20T00:00:00Z" })).toBe(true);
    expect(isPaidOff({ total_amount: 100, paid: 50, paid_off_at: null })).toBe(false);
  });
});

describe("paymentStatusText", () => {
  it("says the status in words (debts.md §6)", () => {
    const at = (status: "paid" | "due" | "planned" | "late", due: string, daysLate?: number) =>
      paymentStatusText({ status, due, daysLate }, "2026-11-20");
    expect(at("paid", "2026-10-25")).toBe("Paid");
    expect(at("due", "2026-11-25")).toBe("Due in 5 days");
    expect(at("due", "2026-11-21")).toBe("Due tomorrow");
    expect(at("due", "2026-11-20")).toBe("Due today");
    expect(at("planned", "2026-12-25")).toBe("Planned");
    expect(at("late", "2026-11-17", 3)).toBe("Late · 3 days");
    expect(at("late", "2026-11-19", 1)).toBe("Late · 1 day");
  });
});

describe("When I can (flexible debts, Nov 24)", () => {
  const tita = {
    total_amount: 1_000_000,
    payment_type: "flexible" as const,
    num_payments: null,
    payment_amount: null,
    first_due_date: null,
    target_date: null,
  };

  it("has no schedule, never late, and no debt-free date without a target", () => {
    expect(debtSchedule(tita)).toEqual([]);
    expect(debtProgress(tita, 300_000, "2026-11-20", period)).toEqual({
      paid: 300_000,
      left: 700_000,
      paidOff: false,
      paymentsMade: 0,
      debtFreeBy: null,
      payments: [],
    });
  });

  it("with a target month, is debt-free by the end of that month", () => {
    expect(debtProgress({ ...tita, target_date: "2027-06-01" }, 0, "2026-11-20", period).debtFreeBy).toBe("2027-06-30");
  });

  it("counts in total owed but never in due this period", () => {
    const summary = debtsSummary([{ ...tita, name: "Owe Tita", paid: 300_000, paid_off_at: null }], "2026-11-20", period);
    expect(summary).toMatchObject({ totalOwed: 700_000, dueThisPeriod: 0, nextDue: null, debtFreeBy: null, activeCount: 1 });
  });

  it("suggests about how much a month to make the target (rounded up to ₱100)", () => {
    // ₱7,000 left, Nov 2026 to Jun 2027 = 8 months → ₱875 → ₱900.
    expect(flexibleMonthly(700_000, "2026-11-20", "2027-06-01")).toBe(90_000);
    // This month: all of it.
    expect(flexibleMonthly(700_000, "2026-11-20", "2026-11-01")).toBe(700_000);
    // A month already gone, or nothing left: no suggestion.
    expect(flexibleMonthly(700_000, "2026-11-20", "2026-10-01")).toBeNull();
    expect(flexibleMonthly(0, "2026-11-20", "2027-06-01")).toBeNull();
  });
});
