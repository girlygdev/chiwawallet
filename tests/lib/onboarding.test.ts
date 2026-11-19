import { describe, expect, it } from "vitest";
import { firstPeriodSummary, isOnboarded, nextOnboardingStep, periodTag } from "@/lib/onboarding";

describe("firstPeriodSummary: the 'Your first period' card", () => {
  it("pay still to come: balance plus expected income", () => {
    expect(firstPeriodSummary({ openingBalance: 500_000, expectedIncome: 2_500_000, payReceived: false })).toEqual({
      incomeStillExpected: 2_500_000,
      readyToPlan: 3_000_000,
    });
  });

  it("pay already arrived: it's in the balance, so it isn't counted twice", () => {
    expect(firstPeriodSummary({ openingBalance: 3_000_000, expectedIncome: 2_500_000, payReceived: true })).toEqual({
      incomeStillExpected: 0,
      readyToPlan: 3_000_000,
    });
  });

  it("works with a negative starting balance", () => {
    expect(
      firstPeriodSummary({ openingBalance: -200_000, expectedIncome: 2_500_000, payReceived: false }).readyToPlan,
    ).toBe(2_300_000);
  });

  it("no balance typed yet counts as ₱0", () => {
    expect(firstPeriodSummary({ openingBalance: null, expectedIncome: 2_500_000, payReceived: null }).readyToPlan).toBe(
      2_500_000,
    );
  });
});

describe("periodTag", () => {
  it("'Starts today' on payday, otherwise when it started", () => {
    expect(periodTag("2026-11-15", "2026-11-15")).toBe("Starts today");
    expect(periodTag("2026-11-15", "2026-11-19")).toBe("Started Nov 15");
  });
});

describe("nextOnboardingStep: where to resume", () => {
  it("no budget → step 1", () => {
    expect(nextOnboardingStep({ budget: null, incomeCount: 0 })).toBe("budget");
  });

  it("a budget but no income → step 2", () => {
    expect(nextOnboardingStep({ budget: { opening_balance: null }, incomeCount: 0 })).toBe("income");
  });

  it("income but no opening balance → step 3", () => {
    expect(nextOnboardingStep({ budget: { opening_balance: null }, incomeCount: 2 })).toBe("start");
  });

  it("an opening balance means finished, even ₱0 or negative", () => {
    for (const opening_balance of [500_000, 0, -10_000]) {
      expect(nextOnboardingStep({ budget: { opening_balance }, incomeCount: 1 })).toBe("done");
    }
  });
});

describe("isOnboarded", () => {
  it("only a budget with an opening balance counts", () => {
    expect(isOnboarded(null)).toBe(false);
    expect(isOnboarded({ opening_balance: null })).toBe(false);
    expect(isOnboarded({ opening_balance: 0 })).toBe(true);
  });
});
