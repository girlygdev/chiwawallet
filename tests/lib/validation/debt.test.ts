import { describe, expect, it } from "vitest";
import { debtSchema, suggestedPayment } from "@/lib/validation/debt";

const valid = {
  name: "SPayLater",
  lender: "",
  total: "12,000",
  paymentType: "installments",
  numPayments: 3,
  payment: "4,000",
  firstDueDate: "2026-11-25",
  interestRate: "",
};

function errorsFor(input: Record<string, unknown>) {
  const result = debtSchema.safeParse({ ...valid, ...input });
  if (result.success) return {};
  return Object.fromEntries(result.error.issues.map((i) => [i.path[0], i.message]));
}

describe("debtSchema", () => {
  it("parses installments", () => {
    expect(debtSchema.parse({ ...valid, lender: " Shopee ", interestRate: "3.5" })).toEqual({
      name: "SPayLater",
      lender: "Shopee",
      total: 1_200_000,
      paymentType: "installments",
      numPayments: 3,
      payment: 400_000,
      firstDueDate: "2026-11-25",
      interestRate: 3.5,
    });
  });

  it("a one-time debt is one payment of the total, whatever was typed", () => {
    expect(debtSchema.parse({ ...valid, paymentType: "one_time", numPayments: 7, payment: "" })).toMatchObject({
      numPayments: 1,
      payment: 1_200_000,
    });
  });

  it("empty lender and interest become null", () => {
    expect(debtSchema.parse(valid)).toMatchObject({ lender: null, interestRate: null });
  });

  it("checks the basics", () => {
    expect(errorsFor({ name: "" }).name).toBe("Name this debt, like Credit card.");
    expect(errorsFor({ total: "0" }).total).toBe("Enter an amount above ₱0.");
    expect(errorsFor({ numPayments: 1 }).numPayments).toBe("Pick 2 to 60 payments.");
    expect(errorsFor({ numPayments: 61 }).numPayments).toBe("Pick 2 to 60 payments.");
    expect(errorsFor({ payment: "" }).payment).toBe("Enter an amount, like 4,000.");
    expect(errorsFor({ firstDueDate: "" }).firstDueDate).toBe("Pick the first due date.");
    expect(errorsFor({ interestRate: "101" }).interestRate).toBe("Enter a rate from 0 to 100, like 3.5.");
    expect(errorsFor({ interestRate: "3.555" }).interestRate).toBe("Enter a rate from 0 to 100, like 3.5.");
  });

  it("the payments must cover the total, with something left for the last one", () => {
    // 3 × ₱3,000 = ₱9,000 doesn't cover ₱12,000.
    expect(errorsFor({ payment: "3,000" }).payment).toBe("3 payments of ₱3,000 only cover ₱9,000 of ₱12,000.");
    // 2 × ₱6,000 already covers ₱12,000, so a 3rd payment would be ₱0.
    expect(errorsFor({ payment: "6,000" }).payment).toBe("₱12,000 is paid off after 2 payments of ₱6,000. Use 2 payments.");
    // Uneven is fine: ₱4,000, ₱4,000, then ₱3,000.
    expect(errorsFor({ total: "11,000" })).toEqual({});
  });
});

describe("suggestedPayment", () => {
  it("is the total ÷ payments, rounded up to the peso", () => {
    expect(suggestedPayment(1_200_000, 3)).toBe(400_000);
    expect(suggestedPayment(1_000_000, 3)).toBe(333_400);
  });
});
