import { describe, expect, it } from "vitest";
import { startSchema } from "@/lib/validation/start";

function errorsFor(input: Record<string, unknown>) {
  const result = startSchema.safeParse({ openingBalance: "5,000", payReceived: "no", ...input });
  if (result.success) return {};
  return Object.fromEntries(result.error.issues.map((i) => [i.path[0], i.message]));
}

describe("startSchema (onboarding step 3)", () => {
  it("parses the balance into centavos and the answer into a boolean", () => {
    expect(startSchema.parse({ openingBalance: "₱5,000.50", payReceived: "yes" })).toEqual({
      openingBalance: 500_050,
      payReceived: true,
    });
  });

  it("allows ₱0 and negative balances (plan review 3.1)", () => {
    expect(startSchema.parse({ openingBalance: "0", payReceived: "no" }).openingBalance).toBe(0);
    expect(startSchema.parse({ openingBalance: "-1,500", payReceived: "no" }).openingBalance).toBe(-150_000);
  });

  it("needs a balance, even if it's 0", () => {
    expect(errorsFor({ openingBalance: "" }).openingBalance).toBe(
      "Enter what you have right now. ₱0 is fine.",
    );
    expect(errorsFor({ openingBalance: "abc" }).openingBalance).toBe(
      "Enter what you have right now. ₱0 is fine.",
    );
  });

  it("needs an answer to the pay question", () => {
    expect(errorsFor({ payReceived: undefined }).payReceived).toBe("Pick yes or no.");
    expect(errorsFor({ payReceived: "maybe" }).payReceived).toBe("Pick yes or no.");
  });
});
