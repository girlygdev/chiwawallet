import { describe, expect, it } from "vitest";
import { assignSchema, debtPaymentSchema, editPlanItemSchema, oneOffItemSchema, setBudgetSchema } from "@/lib/validation/plan-item";

const CATEGORY = "3f1c2b4a-5d6e-4f70-8a9b-0c1d2e3f4a5b";
const valid = { name: "Dad's birthday gift", amount: "2,500", neededBy: "2026-12-05", periodStart: "2026-11-30", categoryId: CATEGORY };

function errors(schema: typeof oneOffItemSchema | typeof editPlanItemSchema, input: Record<string, unknown>) {
  const result = schema.safeParse(input);
  if (result.success) return {};
  return Object.fromEntries(result.error.issues.map((i) => [i.path[0], i.message]));
}

describe("oneOffItemSchema (plan.md §6)", () => {
  it("trims the name and parses the amount to centavos", () => {
    expect(oneOffItemSchema.parse({ ...valid, name: "  Dad's birthday gift ", amount: "₱2,500.50" })).toEqual({
      ...valid,
      amount: 250_050,
    });
  });

  it("makes Needed by optional: an empty field is null", () => {
    expect(oneOffItemSchema.parse({ ...valid, neededBy: "" }).neededBy).toBeNull();
    expect(oneOffItemSchema.parse({ ...valid, neededBy: undefined }).neededBy).toBeNull();
  });

  it("says what's wrong with each field", () => {
    expect(errors(oneOffItemSchema, { ...valid, name: " ", amount: "0", neededBy: "2026-02-30", periodStart: "", categoryId: "" })).toEqual({
      name: "Say what it's for, like Dad's birthday gift.",
      amount: "Enter an amount above ₱0.",
      neededBy: "Pick a valid date.",
      periodStart: "Pick which payday pays for it.",
      categoryId: "Pick a category.",
    });
    expect(errors(oneOffItemSchema, { ...valid, name: "x".repeat(41), amount: "abc" })).toEqual({
      name: "Keep it to 40 characters or fewer.",
      amount: "Enter an amount, like 2,500.",
    });
  });
});

describe("editPlanItemSchema (5e)", () => {
  it("parses name, amount and an optional Needed by", () => {
    expect(editPlanItemSchema.parse({ name: " Meralco ", amount: "2,800", neededBy: "" })).toEqual({
      name: "Meralco",
      amount: 280_000,
      neededBy: null,
    });
  });

  it("rejects a blank name and a ₱0 amount", () => {
    expect(errors(editPlanItemSchema, { name: "", amount: "0" })).toEqual({
      name: "Give it a name.",
      amount: "Enter an amount above ₱0.",
    });
  });
});

describe("setBudgetSchema (5g-1)", () => {
  const valid = { categoryId: "8f14e45f-ceea-4e7a-8d8a-0e0f5b1a2c3d", amount: "3,000", scope: "every" };

  it("turns the amount into centavos", () => {
    expect(setBudgetSchema.parse(valid)).toEqual({ ...valid, amount: 300_000 });
    expect(setBudgetSchema.parse({ ...valid, scope: "period" }).scope).toBe("period");
  });

  it("needs a category, an amount above ₱0 and how often", () => {
    const issues = (input: object) =>
      setBudgetSchema.safeParse({ ...valid, ...input }).error?.issues.map((i) => i.message) ?? [];
    expect(issues({ categoryId: "" })).toEqual(["Pick a category."]);
    expect(issues({ amount: "0" })).toEqual(["Enter an amount above ₱0."]);
    expect(issues({ scope: "weekly" })).toEqual(["Pick how often."]);
  });
});

describe("debtPaymentSchema (5g-2)", () => {
  const valid = { debtId: "8f14e45f-ceea-4e7a-8d8a-0e0f5b1a2c3d", amount: "2,000", periodStart: "2026-12-15" };

  it("turns the amount into centavos", () => {
    expect(debtPaymentSchema.parse(valid)).toEqual({ ...valid, amount: 200_000 });
  });

  it("needs a debt, an amount above ₱0 and a payday", () => {
    const issues = (input: object) =>
      debtPaymentSchema.safeParse({ ...valid, ...input }).error?.issues.map((i) => i.message) ?? [];
    expect(issues({ debtId: "" })).toEqual(["Pick a debt."]);
    expect(issues({ amount: "0" })).toEqual(["Enter an amount above ₱0."]);
    expect(issues({ periodStart: "" })).toEqual(["Pick which payday pays for it."]);
  });
});

describe("assignSchema (6f)", () => {
  const POT = "8f14e45f-ceea-4e7a-8d8a-0e0f5b1a2c3d";
  const valid = { periodStart: "2026-11-15", allocations: [{ kind: "pot", id: POT, amount: 300_000 }] };

  it("takes positive whole-centavo amounts for pots and debts", () => {
    expect(assignSchema.safeParse(valid).success).toBe(true);
    expect(assignSchema.safeParse({ ...valid, allocations: [{ kind: "pot", id: POT, amount: 0 }] }).success).toBe(false);
    expect(assignSchema.safeParse({ ...valid, allocations: [{ kind: "pot", id: POT, amount: 10.5 }] }).success).toBe(false);
  });

  it("needs at least one, and each place once", () => {
    expect(assignSchema.safeParse({ ...valid, allocations: [] }).error?.issues[0].message).toBe("Give some of it a job first.");
    const twice = [valid.allocations[0], valid.allocations[0]];
    expect(assignSchema.safeParse({ ...valid, allocations: twice }).error?.issues[0].message).toBe("Each place once.");
  });
});
