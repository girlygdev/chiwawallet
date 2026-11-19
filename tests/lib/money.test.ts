import { describe, expect, it } from "vitest";
import { formatPeso, formatPesoInput, parsePesoInput } from "@/lib/money";

describe("formatPesoInput: centavos → what an input shows", () => {
  it.each([
    [2_500_000, "25,000"],
    [2_500_050, "25,000.50"],
    [0, "0"],
    [-120_025, "-1,200.25"],
  ])("%d → %s", (centavos, text) => {
    expect(formatPesoInput(centavos)).toBe(text);
    // What it shows can be read back to the same amount.
    expect(parsePesoInput(text)).toBe(centavos);
  });
});

describe("parsePesoInput: typed pesos → integer centavos", () => {
  it.each([
    ["5000", 500_000],
    ["5,000", 500_000],
    ["5,000.00", 500_000],
    ["₱ 5,000.5", 500_050],
    ["0.01", 1],
    ["0", 0],
    ["1234567.89", 123_456_789],
    ["-1,200.25", -120_025],
    ["−1,200", -120_000], // a real minus sign, as formatPeso() writes it
    ["  250  ", 25_000],
  ])("%s → %d", (text, centavos) => {
    expect(parsePesoInput(text)).toBe(centavos);
  });

  it("never uses floating point (0.29 is a classic float trap)", () => {
    expect(parsePesoInput("0.29")).toBe(29);
    expect(parsePesoInput("1.10")).toBe(110);
  });

  it.each(["", "   ", "abc", "5.123", "5..0", "1-2", "--5", ".", "-", "₱"])(
    "rejects %j",
    (text) => {
      expect(parsePesoInput(text)).toBeNull();
    },
  );

  it("rejects amounts too big to store safely", () => {
    expect(parsePesoInput("99999999999999999")).toBeNull();
  });
});

describe("formatPeso: centavos → display", () => {
  it("whole pesos have no centavos", () => {
    expect(formatPeso(1_245_000)).toBe("₱12,450");
    expect(formatPeso(0)).toBe("₱0");
  });

  it("shows two decimals when there are centavos", () => {
    expect(formatPeso(1_245_050)).toBe("₱12,450.50");
    expect(formatPeso(1)).toBe("₱0.01");
  });

  it("negatives use a real minus sign", () => {
    expect(formatPeso(-18_000)).toBe("−₱180");
  });

  it("signed: money in gets a plus", () => {
    expect(formatPeso(2_500_000, { signed: true })).toBe("+₱25,000");
    expect(formatPeso(-18_000, { signed: true })).toBe("−₱180");
    expect(formatPeso(0, { signed: true })).toBe("₱0");
  });

  it("rejects non-integer centavos", () => {
    expect(() => formatPeso(1.5)).toThrow(RangeError);
  });
});
