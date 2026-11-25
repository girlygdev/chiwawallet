import { describe, expect, it } from "vitest";
import { editPlanItemSchema, oneOffItemSchema } from "@/lib/validation/plan-item";

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
