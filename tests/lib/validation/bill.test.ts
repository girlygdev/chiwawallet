import { describe, expect, it } from "vitest";
import { billSchemaFor } from "@/lib/validation/bill";

const CATEGORY = "3f1c2b4a-5d6e-4f70-8a9b-0c1d2e3f4a5b";
const valid = {
  name: "Meralco",
  amount: "2,500",
  amountVaries: false,
  categoryId: CATEGORY,
  frequency: "monthly",
  dueDay: 20,
  firstDueMonth: null,
  paySlot: "payday_1",
  remind: true,
};

function errorsFor(frequency: string, input: Record<string, unknown>) {
  const result = billSchemaFor(frequency).safeParse({ ...valid, ...input });
  if (result.success) return {};
  return Object.fromEntries(result.error.issues.map((i) => [i.path[0], i.message]));
}

describe("billSchemaFor: Paid with (Nov 28)", () => {
  const CARD = "8f14e45f-ceea-4e7a-8d8a-0e0f5b1a2c3d";

  it("is Cash (null) when empty or left out, or a card's id", () => {
    const parse = (cardId: unknown) => billSchemaFor("semi_monthly").parse({ ...valid, cardId }).cardId;
    expect(parse(undefined)).toBeNull();
    expect(parse("")).toBeNull();
    expect(parse(CARD)).toBe(CARD);
  });

  it("refuses anything else", () => {
    expect(errorsFor("semi_monthly", { cardId: "visa" })).toEqual({ cardId: "Pick Cash or one of your cards." });
  });
});

describe("billSchemaFor", () => {
  it("parses the amount to centavos and trims the name", () => {
    expect(billSchemaFor("semi_monthly").parse({ ...valid, name: " Meralco ", amount: "₱2,500.50" })).toMatchObject({
      name: "Meralco",
      amount: 250_050,
      firstDueMonth: null,
    });
  });

  it("needs a name, an amount above ₱0 and a category", () => {
    expect(errorsFor("semi_monthly", { name: " " }).name).toBe("Name this bill, like Meralco.");
    expect(errorsFor("semi_monthly", { name: "a".repeat(41) }).name).toBe("Keep it to 40 characters or fewer.");
    expect(errorsFor("semi_monthly", { amount: "" }).amount).toBe("Enter an amount, like 2,500.");
    expect(errorsFor("semi_monthly", { amount: "0" }).amount).toBe("Enter an amount above ₱0.");
    expect(errorsFor("semi_monthly", { categoryId: "" }).categoryId).toBe("Pick a category.");
  });

  it("needs a due day from 1 to 31", () => {
    expect(errorsFor("semi_monthly", { dueDay: 0 }).dueDay).toBe("Pick the day it's due.");
    expect(errorsFor("semi_monthly", { dueDay: 32 }).dueDay).toBe("Pick the day it's due.");
    expect(errorsFor("semi_monthly", { dueDay: 31 })).toEqual({});
  });

  it("quarterly and yearly bills need their first month; monthly ones drop it", () => {
    expect(errorsFor("semi_monthly", { frequency: "quarterly" }).firstDueMonth).toBe("Pick the month it's first due.");
    expect(errorsFor("semi_monthly", { frequency: "yearly", firstDueMonth: 13 }).firstDueMonth).toBe(
      "Pick the month it's first due.",
    );
    expect(billSchemaFor("semi_monthly").parse({ ...valid, firstDueMonth: 5 }).firstDueMonth).toBeNull();
    expect(billSchemaFor("semi_monthly").parse({ ...valid, frequency: "yearly", firstDueMonth: 11 }).firstDueMonth).toBe(11);
  });

  it("twice a month: payday 1, payday 2 or split", () => {
    for (const paySlot of ["payday_1", "payday_2", "split"]) {
      expect(errorsFor("semi_monthly", { paySlot })).toEqual({});
    }
    expect(errorsFor("semi_monthly", { paySlot: "every" }).paySlot).toBe("Pick which payday pays it.");
  });

  it("one payday (weekly, monthly): only every", () => {
    for (const frequency of ["weekly", "monthly"]) {
      expect(errorsFor(frequency, { paySlot: "every" })).toEqual({});
      expect(errorsFor(frequency, { paySlot: "split" }).paySlot).toBe("This budget has one payday, so that payday pays it.");
    }
  });
});
