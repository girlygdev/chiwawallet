import { describe, expect, it } from "vitest";
import { dashboardNumbers, formatPeso, formatPesoInput, parsePesoInput, perDay, safeToSpend, stillDueTotal } from "@/lib/money";
import { cashOnHand, periodTotals } from "@/lib/transactions";

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

type Row = { type: "income" | "expense" | "savings" | "debt_payment"; amount: number; deleted_at: string | null };
const row = (type: Row["type"], amount: number, deleted_at: string | null = null): Row => ({ type, amount, deleted_at });

// The first period: ₱5,000 opening balance, ₱25,000 pay, ₱3,000 spent.
const earlier = [row("income", 2_500_000), row("expense", 300_000), row("expense", 99_900, "2026-11-01T00:00:00Z")];
// This period so far.
const current = [row("income", 2_500_000), row("expense", 18_000), row("debt_payment", 400_000), row("expense", 5_000)];

describe("dashboardNumbers (dashboard.md §1)", () => {
  it("carries in the opening balance plus every earlier period's net, skipping deleted rows", () => {
    // 5,000 + 25,000 − 3,000 = 27,000
    expect(dashboardNumbers(500_000, earlier, current).carryIn).toBe(2_700_000);
  });

  it("adds this period's income and takes away its money out", () => {
    expect(dashboardNumbers(500_000, earlier, current)).toEqual({
      carryIn: 2_700_000,
      income: 2_500_000,
      spending: 423_000,
      toSavings: 0,
      moneyOut: 423_000,
      periodMoney: 5_200_000,
      cashNow: 4_777_000,
      spentShare: 423_000 / 5_200_000,
    });
  });

  it("matches Activity's totals and cashOnHand over every row", () => {
    const withPot = [...current, row("savings", 300_000), row("savings", -100_000)];
    const numbers = dashboardNumbers(500_000, earlier, withPot);
    const totals = periodTotals(withPot);
    expect(numbers.income).toBe(totals.moneyIn);
    // Activity's Money out is spending and debt payments; its To savings is separate.
    expect(numbers.spending).toBe(totals.moneyOut);
    expect(numbers.toSavings).toBe(totals.toSavings);
    expect(numbers.cashNow).toBe(cashOnHand(500_000, [...earlier, ...withPot]));
  });

  it("counts net transfers to pots in money out (Week 4, dashboard.md §1)", () => {
    const withPot = [...current, row("savings", 300_000), row("savings", -100_000)];
    const numbers = dashboardNumbers(500_000, earlier, withPot);
    expect(numbers.toSavings).toBe(200_000);
    expect(numbers.moneyOut).toBe(623_000);
    expect(numbers.cashNow).toBe(4_577_000);
    expect(numbers.cashNow).toBe(numbers.periodMoney - numbers.moneyOut);
    expect(numbers.spentShare).toBe(623_000 / 5_200_000);
  });

  it("counts net withdrawals from pots as money in this period, not negative money out", () => {
    const withdrawn = [...current, row("savings", -300_000)];
    const numbers = dashboardNumbers(500_000, earlier, withdrawn);
    expect(numbers.moneyOut).toBe(423_000);
    expect(numbers.periodMoney).toBe(5_500_000);
    expect(numbers.cashNow).toBe(5_077_000);
    expect(numbers.cashNow).toBe(cashOnHand(500_000, [...earlier, ...withdrawn]));
  });

  it("starts the first period from the opening balance alone, and treats a missing one as ₱0", () => {
    expect(dashboardNumbers(500_000, [], []).cashNow).toBe(500_000);
    expect(dashboardNumbers(null, [], []).cashNow).toBe(0);
  });

  it("keeps the spend bar between 0 and 1", () => {
    expect(dashboardNumbers(null, [], []).spentShare).toBe(0);
    // Spent more than came in: a full bar, and cash now below ₱0.
    const over = dashboardNumbers(10_000, [], [row("expense", 50_000)]);
    expect(over.spentShare).toBe(1);
    expect(over.cashNow).toBe(-40_000);
    // Nothing to spend from but something spent.
    expect(dashboardNumbers(null, [], [row("expense", 100)]).spentShare).toBe(1);
  });
});

describe("Safe to spend (6c, dashboard.md §1)", () => {
  const item = (planned_amount: number, fields: { tickable?: boolean; paid_at?: string | null } = {}) => ({
    planned_amount,
    tickable: true,
    paid_at: null,
    ...fields,
  });

  it("still due is this period's unpaid bills, savings, debts and one-offs", () => {
    const items = [
      item(100_000), // a bill
      item(400_000), // a debt payment
      item(200_000), // savings
      item(250_000, { paid_at: "2026-11-20T00:00:00Z" }), // paid: not due
      item(600_000, { tickable: false }), // a spending budget or income: not due
    ];
    expect(stillDueTotal(items)).toBe(700_000);
    expect(stillDueTotal([])).toBe(0);
  });

  it("is cash now minus still due", () => {
    expect(safeToSpend(2_055_000, 700_000)).toBe(1_355_000);
    expect(safeToSpend(500_000, 700_000)).toBe(-200_000);
  });

  it("per day divides by the days left, counting today, rounded down to whole pesos", () => {
    // Nov 20 in Nov 15 – 29: 10 days.
    expect(perDay(1_355_000, "2026-11-20", "2026-11-29")).toEqual({ kind: "per_day", amount: 135_500, days: 10 });
    expect(perDay(1_000_050, "2026-11-27", "2026-11-29")).toEqual({ kind: "per_day", amount: 333_300, days: 3 });
    // The last day: all of it.
    expect(perDay(50_000, "2026-11-29", "2026-11-29")).toEqual({ kind: "per_day", amount: 50_000, days: 1 });
  });

  it("says how much over when Safe to spend is below ₱0", () => {
    expect(perDay(-120_000, "2026-11-20", "2026-11-29")).toEqual({ kind: "over", amount: 120_000 });
  });
});
