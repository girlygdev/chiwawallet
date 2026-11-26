import { describe, expect, it } from "vitest";
import { checklistSteps } from "@/lib/checklist";
import type { PaySchedule } from "@/lib/periods";

const schedule: PaySchedule = { frequency: "semi_monthly", payDay1: 15, payDay2: 30 };
const fresh = {
  schedule,
  firstIncome: { name: "Main job", amount: 2_500_000 },
  hasIncome: false,
  hasBills: false,
  hasPots: false,
  hasExpense: false,
};

describe("checklistSteps: the Get started card (dashboard.md §4)", () => {
  it("lists the five steps with their details, setting up the budget already done", () => {
    const list = checklistSteps(fresh);
    expect(list.steps.map((s) => [s.key, s.title, s.detail, s.done])).toEqual([
      ["budget", "Set up your budget", "Twice a month · 15th & 30th", true],
      ["pay", "Confirm today's pay", "₱25,000 from Main job", false],
      ["bills", "Add your bills", null, false],
      ["pot", "Create a savings pot", "Start with an emergency fund", false],
      ["expense", "Log your first expense", "Takes about 10 seconds", false],
    ]);
    expect(list).toMatchObject({ done: 1, total: 5, share: 0.2, complete: false });
  });

  it("ticks each step from what's been added", () => {
    const list = checklistSteps({ ...fresh, hasIncome: true, hasBills: true, hasPots: true });
    expect(list.steps.map((s) => s.done)).toEqual([true, true, true, true, false]);
    expect(list.done).toBe(4);
  });

  it("is complete when all five are done", () => {
    const list = checklistSteps({ ...fresh, hasIncome: true, hasBills: true, hasPots: true, hasExpense: true });
    expect(list).toMatchObject({ done: 5, share: 1, complete: true });
  });

  it("has no pay detail without an income source", () => {
    expect(checklistSteps({ ...fresh, firstIncome: null }).steps[1].detail).toBeNull();
  });
});
