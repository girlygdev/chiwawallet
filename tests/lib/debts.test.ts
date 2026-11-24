import { describe, expect, it } from "vitest";
import { debtPaid, debtProgress, debtSchedule } from "@/lib/debts";

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
