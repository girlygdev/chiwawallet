import { describe, expect, it } from "vitest";
import type { PaySchedule } from "@/lib/periods";
import { contributionNeeded, potBalance, potGoalDate, potProgress } from "@/lib/pots";

const twiceAMonth: PaySchedule = { frequency: "semi_monthly", payDay1: 15, payDay2: 30 };
const today = "2026-11-20"; // in the Nov 15 – 29 period

describe("potBalance", () => {
  it("is the starting balance plus deposits minus withdrawals, skipping deleted rows", () => {
    expect(
      potBalance({ starting_balance: 400_000 }, [
        { amount: 300_000, deleted_at: null },
        { amount: -100_000, deleted_at: null },
        { amount: 999_999, deleted_at: "2026-11-20T00:00:00Z" },
      ]),
    ).toBe(600_000);
  });

  it("is the starting balance with no transactions", () => {
    expect(potBalance({ starting_balance: 0 }, [])).toBe(0);
  });
});

describe("potProgress", () => {
  it("is the share of the target, from 0 to 1", () => {
    expect(potProgress(600_000, 4_000_000)).toBe(0.15);
    expect(potProgress(5_000_000, 4_000_000)).toBe(1);
    expect(potProgress(-100, 4_000_000)).toBe(0);
  });

  it("is null without a target", () => {
    expect(potProgress(600_000, null)).toBeNull();
  });
});

describe("potGoalDate", () => {
  it("steps through the coming paydays (savings.md fix #1: Travel reaches its goal in Feb 2027)", () => {
    // ₱14,000 to go at ₱2,000 every payday: 7 paydays after today.
    const travel = { target_amount: 2_000_000, planned_contribution: 200_000, pay_slot: "every" as const };
    expect(potGoalDate(travel, 600_000, twiceAMonth, today)).toBe("2027-02-28");
  });

  it("counts only the pot's own payday", () => {
    const pot = { target_amount: 300_000, planned_contribution: 100_000, pay_slot: "payday_2" as const };
    expect(potGoalDate(pot, 0, twiceAMonth, today)).toBe("2027-01-30");
  });

  it("works on a monthly budget", () => {
    const pot = { target_amount: 300_000, planned_contribution: 100_000, pay_slot: "every" as const };
    expect(potGoalDate(pot, 0, { frequency: "monthly", payDay1: 31 }, today)).toBe("2027-01-31");
  });

  it("is null with no target, no contribution, or the target already reached", () => {
    const pot = { target_amount: 2_000_000, planned_contribution: 200_000, pay_slot: "every" as const };
    expect(potGoalDate({ ...pot, target_amount: null }, 0, twiceAMonth, today)).toBeNull();
    expect(potGoalDate({ ...pot, planned_contribution: 0 }, 0, twiceAMonth, today)).toBeNull();
    expect(potGoalDate(pot, 2_000_000, twiceAMonth, today)).toBeNull();
  });
});

describe("contributionNeeded", () => {
  it("splits what's left over the paydays up to the end of the target month, rounded up to ₱100", () => {
    // ₱34,000 left over 15 paydays (Nov 30 to Jun 30) = ₱2,266.67 → ₱2,300.
    const pot = { target_amount: 4_000_000, target_date: "2027-06-01", pay_slot: "every" as const };
    expect(contributionNeeded(pot, 600_000, twiceAMonth, today)).toBe(230_000);
  });

  it("counts only the pot's own payday", () => {
    // ₱6,000 left over 3 paydays (Dec 15, Jan 15, Feb 15) = ₱2,000.
    const pot = { target_amount: 600_000, target_date: "2027-02-01", pay_slot: "payday_1" as const };
    expect(contributionNeeded(pot, 0, twiceAMonth, today)).toBe(200_000);
  });

  it("is null without a target or date, when reached, or when no payday is left", () => {
    const pot = { target_amount: 4_000_000, target_date: "2027-06-01", pay_slot: "every" as const };
    expect(contributionNeeded({ ...pot, target_date: null }, 0, twiceAMonth, today)).toBeNull();
    expect(contributionNeeded({ ...pot, target_amount: null }, 0, twiceAMonth, today)).toBeNull();
    expect(contributionNeeded(pot, 4_000_000, twiceAMonth, today)).toBeNull();
    // October is over: no payday left before the end of the target month.
    expect(contributionNeeded({ ...pot, target_date: "2026-10-01" }, 0, twiceAMonth, today)).toBeNull();
  });

  it("still counts this month's last payday (Nov 30 for a November target)", () => {
    const pot = { target_amount: 100_000, target_date: "2026-11-01", pay_slot: "every" as const };
    expect(contributionNeeded(pot, 0, twiceAMonth, today)).toBe(100_000);
  });
});
