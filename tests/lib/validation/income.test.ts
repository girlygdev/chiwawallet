import { describe, expect, it } from "vitest";
import { incomeSchemaFor } from "@/lib/validation/income";

const valid = { name: "Main job", amount: "25,000", amountVaries: false, paySlot: "payday_1" };

function errorsFor(frequency: string, input: Partial<typeof valid>) {
  const result = incomeSchemaFor(frequency).safeParse({ ...valid, ...input });
  if (result.success) return {};
  return Object.fromEntries(result.error.issues.map((i) => [i.path[0], i.message]));
}

describe("incomeSchemaFor", () => {
  it("turns the typed amount into centavos and trims the name", () => {
    expect(incomeSchemaFor("semi_monthly").parse({ ...valid, name: "  Main job ", amount: "₱25,000.50" })).toEqual({
      name: "Main job",
      amount: 2_500_050,
      amountVaries: false,
      paySlot: "payday_1",
      endDate: null,
    });
  });

  it("needs a name of 1–40 characters", () => {
    expect(errorsFor("semi_monthly", { name: " " }).name).toBe("Name this income, like Main job.");
    expect(errorsFor("semi_monthly", { name: "a".repeat(41) }).name).toBe(
      "Keep it to 40 characters or fewer.",
    );
  });

  it("needs an amount above ₱0, even when it varies", () => {
    expect(errorsFor("semi_monthly", { amount: "" }).amount).toBe("Enter an amount, like 25,000.");
    expect(errorsFor("semi_monthly", { amount: "abc" }).amount).toBe("Enter an amount, like 25,000.");
    expect(errorsFor("semi_monthly", { amount: "0" }).amount).toBe("Enter an amount above ₱0.");
    expect(errorsFor("semi_monthly", { amount: "-500", amountVaries: true }).amount).toBe(
      "Enter an amount above ₱0.",
    );
  });

  it("twice a month allows all three pay slots", () => {
    for (const paySlot of ["payday_1", "payday_2", "every"]) {
      expect(errorsFor("semi_monthly", { paySlot })).toEqual({});
    }
  });

  it("weekly and monthly budgets only allow 'every payday' (decided Nov 19)", () => {
    for (const frequency of ["weekly", "monthly"]) {
      expect(errorsFor(frequency, { paySlot: "every" })).toEqual({});
      expect(errorsFor(frequency, { paySlot: "payday_2" }).paySlot).toBe(
        "This budget has one payday, so income lands on every payday.",
      );
    }
  });

  it("dates are optional by default (onboarding sets the start itself)", () => {
    expect(errorsFor("semi_monthly", {})).toEqual({});
  });

  it("the Income screen needs a start date; the end date is optional and not before the start", () => {
    const schema = incomeSchemaFor("semi_monthly", { requireStartDate: true });
    const errors = (input: Record<string, unknown>) => {
      const r = schema.safeParse({ ...valid, ...input });
      return r.success ? {} : Object.fromEntries(r.error.issues.map((i) => [i.path[0], i.message]));
    };
    expect(errors({ startDate: "" }).startDate).toBe("Pick when this income starts.");
    expect(errors({ startDate: "2026-11-15", endDate: "" })).toEqual({});
    expect(errors({ startDate: "2026-11-15", endDate: "2026-12-31" })).toEqual({});
    expect(errors({ startDate: "2026-11-15", endDate: "2026-11-14" }).endDate).toBe(
      "Pick an end date on or after the start.",
    );
    expect(errors({ startDate: "15/11/2026" }).startDate).toBe("Pick when this income starts.");
    expect(schema.parse({ ...valid, startDate: "2026-11-15", endDate: "" })).toMatchObject({
      startDate: "2026-11-15",
      endDate: null,
    });
  });

  it("rejects unknown pay slots", () => {
    expect(incomeSchemaFor("semi_monthly").safeParse({ ...valid, paySlot: "payday_3" }).success).toBe(false);
  });
});
