import { describe, expect, it } from "vitest";
import { categorySchema, duplicateNameMessage } from "@/lib/validation/category";

const valid = { name: "Pet food", budgetGroup: "needs", icon: "paw-print", color: "orange" };

function errorsFor(input: Partial<Record<keyof typeof valid | "budgetPerPayday", unknown>>) {
  const result = categorySchema.safeParse({ ...valid, ...input });
  if (result.success) return {};
  return Object.fromEntries(result.error.issues.map((i) => [i.path[0], i.message]));
}

describe("categorySchema", () => {
  it("accepts a valid category and trims the name", () => {
    // No budget typed: no budget per payday.
    expect(categorySchema.parse({ ...valid, name: "  Pet food " })).toEqual({ ...valid, budgetPerPayday: null });
  });

  it("turns Budget per payday into centavos, or null when empty (5g-1)", () => {
    expect(categorySchema.parse({ ...valid, budgetPerPayday: "3,000" }).budgetPerPayday).toBe(300_000);
    expect(categorySchema.parse({ ...valid, budgetPerPayday: "₱2,500.50" }).budgetPerPayday).toBe(250_050);
    expect(categorySchema.parse({ ...valid, budgetPerPayday: "  " }).budgetPerPayday).toBeNull();
  });

  it("rejects a budget of ₱0 or text that isn't an amount", () => {
    const message = "Enter an amount above ₱0, or leave it empty.";
    expect(errorsFor({ budgetPerPayday: "0" }).budgetPerPayday).toBe(message);
    expect(errorsFor({ budgetPerPayday: "abc" }).budgetPerPayday).toBe(message);
  });

  it("needs a name of 1–30 characters", () => {
    expect(errorsFor({ name: "   " }).name).toBe("Name this category, like Food.");
    expect(errorsFor({ name: "a".repeat(31) }).name).toBe("Keep it to 30 characters or fewer.");
    expect(errorsFor({ name: "a".repeat(30) }).name).toBeUndefined();
  });

  it("allows only the three 50/30/20 groups", () => {
    for (const budgetGroup of ["needs", "wants", "savings_debt"]) {
      expect(errorsFor({ budgetGroup })).toEqual({});
    }
    expect(errorsFor({ budgetGroup: "income" }).budgetGroup).toBe("Pick a group.");
  });

  it("allows only the offered icons and colours", () => {
    expect(errorsFor({ icon: "baby" })).toEqual({});
    // System icons aren't offered for new categories.
    expect(errorsFor({ icon: "piggy-bank" }).icon).toBe("Pick an icon.");
    expect(errorsFor({ color: "pink" }).color).toBe("Pick a colour.");
  });
});

describe("duplicateNameMessage", () => {
  it("names the category as typed, trimmed", () => {
    expect(duplicateNameMessage(" Food ")).toBe("You already have a category called Food.");
  });
});
