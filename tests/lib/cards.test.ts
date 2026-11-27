import { describe, expect, it } from "vitest";
import { cardCharged, cardNextPayment, cardOwedText } from "@/lib/cards";
import type { PaySchedule } from "@/lib/periods";

// Credit cards on the Debts page (8b-2).

const SEMI: PaySchedule = { frequency: "semi_monthly", payDay1: 15, payDay2: 30 };
const MONTHLY: PaySchedule = { frequency: "monthly", payDay1: 1 };

describe("cardNextPayment", () => {
  it("is this month's due day when it hasn't passed, paid from the payday before it", () => {
    // Due on the 5th, paid from the 30th: Dec 5 ← Nov 30.
    expect(cardNextPayment({ due_day: 5, pay_slot: "payday_2" }, "2026-11-27", SEMI)).toEqual({ due: "2026-12-05", payday: "2026-11-30" });
    expect(cardNextPayment({ due_day: 28, pay_slot: "payday_1" }, "2026-11-27", SEMI)).toEqual({ due: "2026-11-28", payday: "2026-11-15" });
  });

  it("counts the due day itself as still to come", () => {
    expect(cardNextPayment({ due_day: 27, pay_slot: "payday_1" }, "2026-11-27", SEMI).due).toBe("2026-11-27");
  });

  it("moves to next month once the day has passed, across the year end", () => {
    expect(cardNextPayment({ due_day: 20, pay_slot: "payday_1" }, "2026-12-21", SEMI)).toEqual({ due: "2027-01-20", payday: "2027-01-15" });
  });

  it("uses the month's last day when the due day doesn't exist (31st in February)", () => {
    expect(cardNextPayment({ due_day: 31, pay_slot: "payday_1" }, "2027-02-01", SEMI).due).toBe("2027-02-28");
  });

  it("is paid from the period it falls in on a one-payday budget", () => {
    expect(cardNextPayment({ due_day: 5, pay_slot: "every" }, "2026-11-27", MONTHLY)).toEqual({ due: "2026-12-05", payday: "2026-12-01" });
  });
});

describe("cardCharged", () => {
  const row = (amount: number, card_id: string | null, date = "2026-11-20", type = "expense", deleted_at: string | null = null) => ({
    type,
    amount,
    card_id,
    date,
    deleted_at,
  });
  const rows = [
    row(120_000, "c1"),
    row(80_000, "c1", "2026-11-02"),
    row(50_000, "c2"),
    row(30_000, null),
    row(500_000, "c1", "2026-11-21", "debt_payment"),
    row(99_900, "c1", "2026-11-22", "expense", "2026-11-23T00:00:00Z"),
  ];

  it("adds up this card's purchases, not payments, other cards, cash or deleted rows", () => {
    expect(cardCharged(rows, "c1")).toBe(200_000);
  });

  it("can be limited to a period", () => {
    expect(cardCharged(rows, "c1", { start: "2026-11-15", end: "2026-11-29" })).toBe(120_000);
  });
});

describe("cardOwedText", () => {
  it("says owed, or credit when more was paid than owed", () => {
    expect(cardOwedText(840_000)).toBe("₱8,400 owed");
    expect(cardOwedText(0)).toBe("₱0 owed");
    expect(cardOwedText(-20_000)).toBe("₱200 credit");
  });
});
