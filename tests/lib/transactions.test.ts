import { describe, expect, it } from "vitest";
import {
  cashOnHand,
  groupByDay,
  periodTotals,
  signedAmount,
  type TransactionRow,
} from "@/lib/transactions";

let nextId = 0;
function tx(fields: Partial<TransactionRow> & Pick<TransactionRow, "type" | "amount">): TransactionRow {
  nextId += 1;
  return {
    id: `t${nextId}`,
    date: "2026-11-20",
    created_at: `2026-11-20T0${nextId % 10}:00:00Z`,
    deleted_at: null,
    ...fields,
  };
}

const pay = tx({ type: "income", amount: 2_500_000, date: "2026-11-15" });
const lunch = tx({ type: "expense", amount: 18_000 });
const loan = tx({ type: "debt_payment", amount: 400_000 });
const toPot = tx({ type: "savings", amount: 300_000 });
const fromPot = tx({ type: "savings", amount: -100_000 });
const deleted = tx({ type: "expense", amount: 999_900, deleted_at: "2026-11-21T00:00:00Z" });

describe("signedAmount", () => {
  it("adds income and takes away spending and debt payments", () => {
    expect(signedAmount(pay)).toBe(2_500_000);
    expect(signedAmount(lunch)).toBe(-18_000);
    expect(signedAmount(loan)).toBe(-400_000);
  });

  it("treats a pot deposit as cash going out and a withdrawal as cash coming back", () => {
    expect(signedAmount(toPot)).toBe(-300_000);
    expect(signedAmount(fromPot)).toBe(100_000);
  });
});

describe("periodTotals", () => {
  it("adds up money in, money out and to savings", () => {
    expect(periodTotals([pay, lunch, loan, toPot, fromPot])).toEqual({
      moneyIn: 2_500_000,
      // Spending plus debt payments.
      moneyOut: 418_000,
      // Deposits minus withdrawals; the withdrawal isn't money in.
      toSavings: 200_000,
    });
  });

  it("can show more taken out of savings than put in", () => {
    expect(periodTotals([fromPot]).toSavings).toBe(-100_000);
  });

  it("skips deleted rows", () => {
    expect(periodTotals([lunch, deleted]).moneyOut).toBe(18_000);
  });

  it("is all zero for an empty period", () => {
    expect(periodTotals([])).toEqual({ moneyIn: 0, moneyOut: 0, toSavings: 0 });
  });
});

describe("groupByDay", () => {
  it("groups rows by date, newest day first, each with its net", () => {
    const morning = tx({ type: "expense", amount: 5_000, date: "2026-11-20", created_at: "2026-11-20T01:00:00Z" });
    const evening = tx({ type: "expense", amount: 7_000, date: "2026-11-20", created_at: "2026-11-20T12:00:00Z" });
    const days = groupByDay([pay, morning, toPot, evening, fromPot]);

    expect(days.map((d) => d.date)).toEqual(["2026-11-20", "2026-11-15"]);
    expect(days[1]).toEqual({ date: "2026-11-15", net: 2_500_000, rows: [pay] });
    // Pot moves count: −50 − 70 − 3,000 + 1,000.
    expect(days[0].net).toBe(-5_000 - 7_000 - 300_000 + 100_000);
  });

  it("puts the newest row first within a day", () => {
    const first = tx({ type: "expense", amount: 100, created_at: "2026-11-20T01:00:00Z" });
    const second = tx({ type: "expense", amount: 200, created_at: "2026-11-20T02:00:00Z" });
    expect(groupByDay([first, second])[0].rows).toEqual([second, first]);
  });

  it("leaves out deleted rows, and days that only had deleted rows", () => {
    const onlyDeleted = tx({ type: "expense", amount: 100, date: "2026-11-25", deleted_at: "2026-11-25T00:00:00Z" });
    const days = groupByDay([lunch, deleted, onlyDeleted]);
    expect(days).toEqual([{ date: "2026-11-20", net: -18_000, rows: [lunch] }]);
  });

  it("is empty for an empty period", () => {
    expect(groupByDay([])).toEqual([]);
  });
});

describe("cashOnHand", () => {
  it("is the opening balance plus income, minus spending, net savings and debt payments", () => {
    // 5,000 + 25,000 − 180 − 4,000 − (3,000 − 1,000)
    expect(cashOnHand(500_000, [pay, lunch, loan, toPot, fromPot])).toBe(2_382_000);
  });

  it("counts an empty opening balance as ₱0", () => {
    expect(cashOnHand(null, [lunch])).toBe(-18_000);
  });

  it("keeps a negative opening balance", () => {
    expect(cashOnHand(-150_000, [])).toBe(-150_000);
  });

  it("skips deleted rows", () => {
    expect(cashOnHand(500_000, [deleted])).toBe(500_000);
  });
});
