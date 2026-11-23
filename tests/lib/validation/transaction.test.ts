import { describe, expect, it } from "vitest";
import { transactionSchemaFor } from "@/lib/validation/transaction";

const FOOD = "3f1c2a4e-8b7d-4c6a-9e5f-1a2b3c4d5e6f";
const SALARY = "7a8b9c0d-1e2f-4a3b-8c4d-5e6f7a8b9c0d";

const schema = transactionSchemaFor({ today: "2026-11-20", firstPeriodStart: "2026-11-15" });
const valid = { type: "expense", amount: "180", categoryId: FOOD, date: "2026-11-20", note: "" };

function errorsFor(input: Record<string, unknown>) {
  const result = schema.safeParse({ ...valid, ...input });
  if (result.success) return {};
  return Object.fromEntries(result.error.issues.map((i) => [i.path[0], i.message]));
}

describe("transactionSchemaFor", () => {
  it("turns the typed amount into centavos and an empty note into null", () => {
    expect(schema.parse({ ...valid, amount: "₱1,240.50" })).toEqual({
      type: "expense",
      amount: 124_050,
      categoryId: FOOD,
      date: "2026-11-20",
      note: null,
      incomeSourceId: null,
    });
  });

  it("trims the note", () => {
    expect(schema.parse({ ...valid, note: "  Lunch " }).note).toBe("Lunch");
  });

  it("keeps income's source, or null for one-time income", () => {
    const income = { ...valid, type: "income", amount: "25,000" };
    expect(schema.parse({ ...income, incomeSourceId: SALARY }).incomeSourceId).toBe(SALARY);
    expect(schema.parse({ ...income, incomeSourceId: "" }).incomeSourceId).toBeNull();
  });

  it("needs an amount above ₱0", () => {
    expect(errorsFor({ amount: "" }).amount).toBe("Enter an amount, like 180.");
    expect(errorsFor({ amount: "abc" }).amount).toBe("Enter an amount, like 180.");
    expect(errorsFor({ amount: "0" }).amount).toBe("Enter an amount above ₱0.");
    expect(errorsFor({ amount: "-50" }).amount).toBe("Enter an amount above ₱0.");
  });

  it("only takes expense or income for now", () => {
    expect(errorsFor({ type: "savings" }).type).toBeDefined();
    expect(errorsFor({ type: "debt_payment" }).type).toBeDefined();
  });

  it("needs a category", () => {
    expect(errorsFor({ categoryId: "" }).categoryId).toBe("Pick a category.");
  });

  it("allows today and the first period's first day", () => {
    expect(errorsFor({ date: "2026-11-20" })).toEqual({});
    expect(errorsFor({ date: "2026-11-15" })).toEqual({});
  });

  it("refuses future dates, dates before the first period, and dates that don't exist", () => {
    expect(errorsFor({ date: "2026-11-21" }).date).toBe("Pick today or an earlier day.");
    expect(errorsFor({ date: "2026-11-14" }).date).toBe("Pick Nov 15 or later, when your first period starts.");
    expect(errorsFor({ date: "2026-02-30" }).date).toBe("Pick a valid date.");
    expect(errorsFor({ date: "" }).date).toBe("Pick a valid date.");
  });

  it("keeps the note to 100 characters", () => {
    expect(errorsFor({ note: "a".repeat(100) })).toEqual({});
    expect(errorsFor({ note: "a".repeat(101) }).note).toBe("Keep the note to 100 characters or fewer.");
  });

  it("refuses an income source on an expense", () => {
    expect(errorsFor({ incomeSourceId: SALARY }).incomeSourceId).toBe("Only income can come from a source.");
  });
});
