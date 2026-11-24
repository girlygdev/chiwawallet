import { describe, expect, it } from "vitest";
import { categorySchema, duplicateNameMessage } from "@/lib/validation/category";

const valid = { name: "Pet food", budgetGroup: "needs", icon: "paw-print", color: "orange" };

function errorsFor(input: Partial<Record<keyof typeof valid, unknown>>) {
  const result = categorySchema.safeParse({ ...valid, ...input });
  if (result.success) return {};
  return Object.fromEntries(result.error.issues.map((i) => [i.path[0], i.message]));
}

describe("categorySchema", () => {
  it("accepts a valid category and trims the name", () => {
    expect(categorySchema.parse({ ...valid, name: "  Pet food " })).toEqual(valid);
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
