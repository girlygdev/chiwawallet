import { describe, expect, it } from "vitest";
import type { PaySchedule } from "@/lib/periods";
import {
  balanceAfterMove,
  contributionNeeded,
  monthlySavingPlan,
  potBalance,
  potBalanceAfter,
  potCardLine,
  potGoalDate,
  potProgress,
  potTransfer,
  potProjection,
  potScheduleLine,
  potStatus,
  potToGo,
  totalSaved,
  potPeriodLine,
  morePlannedLine,
  savingPlanParts,
} from "@/lib/pots";

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

const pot = (planned_contribution: number, pay_slot: "payday_1" | "payday_2" | "every") => ({ planned_contribution, pay_slot });

describe("monthlySavingPlan", () => {
  it("adds each pot's contribution × its paydays a month (savings.md §1: ₱12,000)", () => {
    expect(monthlySavingPlan([pot(300_000, "payday_1"), pot(200_000, "every"), pot(500_000, "payday_2")], twiceAMonth)).toBe(
      1_200_000,
    );
  });

  it("one payday a month on monthly budgets; 52 ÷ 12 on weekly ones", () => {
    expect(monthlySavingPlan([pot(500_000, "every")], { frequency: "monthly", payDay1: 30 })).toBe(500_000);
    expect(monthlySavingPlan([pot(120_000, "every")], { frequency: "weekly", payWeekday: 5 })).toBe(520_000);
  });
});

describe("potScheduleLine", () => {
  it("says how much and when, with the real pay days", () => {
    expect(potScheduleLine(pot(300_000, "payday_1"), twiceAMonth)).toBe("₱3,000 every 15th");
    expect(potScheduleLine(pot(200_000, "every"), twiceAMonth)).toBe("₱2,000 each payday");
    expect(potScheduleLine(pot(500_000, "every"), { frequency: "monthly", payDay1: 30 })).toBe("₱5,000 every 30th");
    expect(potScheduleLine(pot(50_000, "every"), { frequency: "weekly", payWeekday: 5 })).toBe("₱500 every Fri");
  });

  it("says when there's no plan yet", () => {
    expect(potScheduleLine(pot(0, "every"), twiceAMonth)).toBe("No savings plan yet");
  });
});

describe("potStatus", () => {
  const base = {
    target_amount: 2_000_000,
    target_date: null,
    planned_contribution: 200_000,
    pay_slot: "every" as const,
    is_locked: false,
  };

  it("on track: the goal month", () => {
    expect(potStatus(base, 600_000, twiceAMonth, today)).toEqual({ kind: "on_track", date: "2027-02-28" });
  });

  it("behind: the contribution can't make the target date, with what it would take", () => {
    // ₱14,000 to go by Dec 2026: 3 paydays (Nov 30, Dec 15, Dec 30) → ₱4,700 each.
    expect(potStatus({ ...base, target_date: "2026-12-01" }, 600_000, twiceAMonth, today)).toEqual({
      kind: "behind",
      needed: 470_000,
      by: "2026-12-01",
    });
  });

  it("locked pots say so first", () => {
    expect(potStatus({ ...base, is_locked: true }, 600_000, twiceAMonth, today)).toEqual({ kind: "locked" });
  });

  it("reached, no target, and a target with no plan", () => {
    expect(potStatus(base, 2_000_000, twiceAMonth, today)).toEqual({ kind: "reached" });
    expect(potStatus({ ...base, target_amount: null }, 0, twiceAMonth, today)).toEqual({ kind: "no_target" });
    expect(potStatus({ ...base, planned_contribution: 0 }, 0, twiceAMonth, today)).toEqual({ kind: "no_plan" });
  });
});

describe("potToGo", () => {
  it("is the target minus the balance, never below ₱0", () => {
    expect(potToGo(1_300_000, 3_000_000)).toBe(1_700_000);
    expect(potToGo(3_500_000, 3_000_000)).toBe(0);
  });
});

describe("totalSaved", () => {
  it("adds the pots' balances (savings.md §1: ₱67,500)", () => {
    expect(totalSaved([1_300_000, 600_000, 4_850_000])).toBe(6_750_000);
    expect(totalSaved([])).toBe(0);
  });
});

describe("potProjection", () => {
  const laptop = {
    target_amount: 4_000_000,
    target_date: null,
    starting_balance: 0,
    planned_contribution: 200_000,
    pay_slot: "every" as const,
  };

  it("a new pot: per month, the goal date, and nothing needed without a target date (savings.md §4)", () => {
    // ₱2,000 each payday = ₱4,000 a month; ₱40,000 takes 20 paydays: Nov 30 … Sep 15, 2027.
    expect(potProjection(laptop, 0, twiceAMonth, today)).toEqual({
      balance: 0,
      perMonth: 400_000,
      perYear: 4_800_000,
      goalDate: "2027-09-15",
      needed: null,
      reached: false,
    });
  });

  it("an edited pot counts what was deposited so far on top of the starting balance", () => {
    expect(potProjection({ ...laptop, starting_balance: 500_000 }, 1_500_000, twiceAMonth, today)).toMatchObject({
      balance: 2_000_000,
      // ₱20,000 to go at ₱2,000 a payday: 10 paydays, Nov 30 … Apr 15.
      goalDate: "2027-04-15",
    });
  });

  it("says what each payday needs when the target date can't be met (rounded up to ₱100)", () => {
    // ₱40,000 by Jun 2027: 15 paydays → ₱2,666.67 → ₱2,700.
    expect(potProjection({ ...laptop, target_date: "2027-06-01" }, 0, twiceAMonth, today).needed).toBe(270_000);
    // Enough already: nothing needed.
    expect(potProjection({ ...laptop, target_date: "2027-12-01" }, 0, twiceAMonth, today).needed).toBeNull();
  });

  it("reached, and no target", () => {
    expect(potProjection(laptop, 4_000_000, twiceAMonth, today)).toMatchObject({ reached: true, goalDate: null });
    expect(potProjection({ ...laptop, target_amount: null }, 0, twiceAMonth, today)).toMatchObject({
      reached: false,
      goalDate: null,
      perYear: 4_800_000,
    });
  });
});

describe("balanceAfterMove", () => {
  it("is the other pot's balance plus what moves in (delete-pattern.md §4: Emergency becomes ₱19,000)", () => {
    expect(balanceAfterMove(1_300_000, 600_000)).toBe(1_900_000);
  });
});

describe("potBalanceAfter", () => {
  it("adds a deposit or a (negative) withdrawal to the balance", () => {
    expect(potBalanceAfter(600_000, 200_000)).toBe(800_000);
    expect(potBalanceAfter(600_000, -100_000)).toBe(500_000);
  });

  it("editing: takes out the row's old amount first", () => {
    expect(potBalanceAfter(800_000, 300_000, 200_000)).toBe(900_000);
  });
});

describe("potTransfer (6d-1)", () => {
  it("takes the amount from one pot and adds it to the other", () => {
    expect(potTransfer(800_000, 1_300_000, 200_000)).toEqual({
      from: { before: 800_000, after: 600_000 },
      to: { before: 1_300_000, after: 1_500_000 },
    });
  });
});

describe("potCardLine (7a, dashboard.md §2 Pot card)", () => {
  it("a pot with a target: how far along, of the target", () => {
    expect(potCardLine(1_300_000, 3_000_000, false)).toEqual({ share: 1_300_000 / 3_000_000, text: "43% of ₱30,000", locked: false });
  });

  it("no target: no bar, 'No target'", () => {
    expect(potCardLine(600_000, null, false)).toEqual({ share: null, text: "No target", locked: false });
  });

  it("a locked pot: a full bar and 'Locked savings'", () => {
    expect(potCardLine(4_850_000, null, true)).toEqual({ share: 1, text: "Locked savings", locked: true });
  });
});

describe("potPeriodLine: a pot's line on the desktop Dashboard", () => {
  it("shows what moved in this period", () => {
    expect(potPeriodLine(300_000, 200_000)).toBe("+₱3,000 this period");
  });

  it("shows what moved out", () => {
    expect(potPeriodLine(-50_000, 0)).toBe("−₱500 this period");
  });

  it("shows what's planned when nothing has moved yet", () => {
    expect(potPeriodLine(0, 200_000)).toBe("₱2,000 planned this period");
  });

  it("is empty with neither", () => {
    expect(potPeriodLine(0, 0)).toBeNull();
  });
});

describe("savingPlanParts: Monthly saving plan's line (savings.md §3)", () => {
  const semi: PaySchedule = { frequency: "semi_monthly", payDay1: 15, payDay2: 30 };
  const pot = (planned_contribution: number, pay_slot: "payday_1" | "payday_2" | "every") => ({ planned_contribution, pay_slot });

  it("is each saving pot's monthly amount, in thousands", () => {
    // ₱3,000 once, ₱2,000 each payday, ₱5,000 once (the spec's example).
    expect(savingPlanParts([pot(300_000, "payday_1"), pot(200_000, "every"), pot(500_000, "payday_2")], semi)).toBe("₱3k + ₱4k + ₱5k");
  });

  it("keeps one decimal, and pesos under ₱1,000", () => {
    expect(savingPlanParts([pot(75_000, "every"), pot(50_000, "payday_1")], semi)).toBe("₱1.5k + ₱500");
  });

  it("leaves out pots with no plan, and says so with none", () => {
    expect(savingPlanParts([pot(0, "every"), pot(300_000, "payday_1")], semi)).toBe("₱3k");
    expect(savingPlanParts([pot(0, "every")], semi)).toBe("No savings plans yet");
  });

  it("names four, then counts the rest", () => {
    expect(savingPlanParts([1, 2, 3, 4, 5, 6].map((k) => pot(k * 100_000, "payday_1")), semi)).toBe("₱1k + ₱2k + ₱3k + ₱4k + 2 more");
  });
});

describe("morePlannedLine: Added this period's line", () => {
  it("says what's still planned this period", () => {
    expect(morePlannedLine(200_000)).toBe("₱2,000 more planned");
    expect(morePlannedLine(0)).toBe("Nothing else planned");
  });
});
