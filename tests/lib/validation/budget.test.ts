import { describe, expect, it } from "vitest";
import { type BudgetInput, budgetSchema, toBudgetRow } from "@/lib/validation/budget";

const base: BudgetInput = {
  name: "My budget",
  frequency: "semi_monthly",
  payDay1: 15,
  payDay2: 30,
  payWeekday: null,
  weekStart: "monday",
};

function errorsFor(input: Partial<BudgetInput>) {
  const result = budgetSchema.safeParse({ ...base, ...input });
  if (result.success) return {};
  return Object.fromEntries(result.error.issues.map((i) => [i.path[0], i.message]));
}

describe("budgetSchema", () => {
  it("accepts the onboarding defaults", () => {
    expect(budgetSchema.safeParse(base).success).toBe(true);
  });

  it("trims the name and needs 1–40 characters", () => {
    expect(budgetSchema.parse({ ...base, name: "  Main  " }).name).toBe("Main");
    expect(errorsFor({ name: "   " }).name).toBe("Give your budget a name.");
    expect(errorsFor({ name: "a".repeat(41) }).name).toBe("Keep it to 40 characters or fewer.");
  });

  it("twice a month needs both paydays, the 1st by the 27th, the 2nd after it", () => {
    expect(errorsFor({ payDay1: null }).payDay1).toBe("Pick your 1st payday.");
    expect(errorsFor({ payDay2: null }).payDay2).toBe("Pick your 2nd payday.");
    expect(errorsFor({ payDay1: 28, payDay2: 30 }).payDay1).toBe(
      "Pick the 27th or earlier for your 1st payday.",
    );
    expect(errorsFor({ payDay1: 25, payDay2: 10 }).payDay2).toBe("Pick a 2nd payday after the 1st.");
  });

  it("monthly needs one payday, any day 1–31; payday 2 is ignored", () => {
    expect(errorsFor({ frequency: "monthly", payDay1: null }).payDay1).toBe("Pick your payday.");
    expect(errorsFor({ frequency: "monthly", payDay1: 31, payDay2: null })).toEqual({});
  });

  it("weekly needs a weekday; the day fields are ignored", () => {
    expect(errorsFor({ frequency: "weekly", payWeekday: null }).payWeekday).toBe("Pick your payday.");
    expect(errorsFor({ frequency: "weekly", payWeekday: 0, payDay1: null, payDay2: null })).toEqual({});
  });

  it("rejects out-of-range values sent straight to the server", () => {
    expect(budgetSchema.safeParse({ ...base, payDay2: 32 }).success).toBe(false);
    expect(budgetSchema.safeParse({ ...base, frequency: "weekly", payWeekday: 7 }).success).toBe(false);
    expect(budgetSchema.safeParse({ ...base, frequency: "fortnightly" }).success).toBe(false);
    expect(budgetSchema.safeParse({ ...base, weekStart: "friday" }).success).toBe(false);
    expect(budgetSchema.safeParse({ ...base, payDay1: 1.5 }).success).toBe(false);
  });
});

describe("toBudgetRow: keeps only the payday fields the frequency uses", () => {
  it("twice a month", () => {
    expect(toBudgetRow({ ...base, payWeekday: 3 })).toEqual({
      name: "My budget",
      frequency: "semi_monthly",
      pay_day_1: 15,
      pay_day_2: 30,
      pay_weekday: null,
    });
  });

  it("monthly", () => {
    expect(toBudgetRow({ ...base, frequency: "monthly" })).toMatchObject({
      pay_day_1: 15,
      pay_day_2: null,
      pay_weekday: null,
    });
  });

  it("weekly", () => {
    expect(toBudgetRow({ ...base, frequency: "weekly", payWeekday: 5 })).toMatchObject({
      pay_day_1: null,
      pay_day_2: null,
      pay_weekday: 5,
    });
  });
});
