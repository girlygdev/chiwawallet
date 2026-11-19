import { describe, expect, it } from "vitest";
import { isOnboarded, nextOnboardingStep } from "@/lib/onboarding";

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
