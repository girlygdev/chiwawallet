// Money is stored and passed around as integer centavos (CLAUDE.md "Money and
// dates"). These two functions are the only places pesos are turned into
// centavos or back, so floating point never touches an amount.

import { cashOnHand, periodTotals } from "@/lib/transactions";

// U+2212, the real minus sign used in the designs ("−₱180").
const MINUS = "−";

const wholePesos = new Intl.NumberFormat("en-PH", { maximumFractionDigits: 0 });
const pesosWithCentavos = new Intl.NumberFormat("en-PH", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * "₱12,450", "₱12,450.50", "−₱180". With `signed`, money in shows "+₱25,000".
 * Centavos show only when there are some.
 */
export function formatPeso(centavos: number, { signed = false }: { signed?: boolean } = {}): string {
  if (!Number.isSafeInteger(centavos)) {
    throw new RangeError(`Expected whole centavos, got ${centavos}.`);
  }
  const abs = Math.abs(centavos);
  const pesos = Math.trunc(abs / 100);
  const cents = abs % 100;
  // Integer division above, so the formatter only ever sees exact values.
  const amount = cents === 0 ? wholePesos.format(pesos) : pesosWithCentavos.format(pesos + cents / 100);
  const sign = centavos < 0 ? MINUS : signed && centavos > 0 ? "+" : "";
  return `${sign}₱${amount}`;
}

/**
 * Centavos → the text a money input shows: "25,000", "25,000.50", "-300".
 * No ₱ (the input draws it) and a plain hyphen, so it reads back exactly
 * through parsePesoInput().
 */
export function formatPesoInput(centavos: number): string {
  const text = formatPeso(Math.abs(centavos)).slice(1); // drop the ₱
  return centavos < 0 ? `-${text}` : text;
}

/**
 * What someone typed ("5,000", "₱ 1,200.50", "-300") → integer centavos, or
 * null if it isn't a peso amount. Up to two decimal places. Parsed as text,
 * never through a float, so "0.29" is exactly 29 centavos.
 */
export function parsePesoInput(text: string): number | null {
  const cleaned = text.replace(/[\s,₱]/g, "").replace(MINUS, "-");
  const match = /^(-?)(\d+)(?:\.(\d{1,2}))?$/.exec(cleaned);
  if (!match) return null;

  const [, minus, whole, fraction = ""] = match;
  const centavos = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(centavos)) return null;
  // `|| 0` turns -0 into 0.
  return (minus ? -centavos : centavos) || 0;
}

type MoneyRow = { type: "income" | "expense" | "savings" | "debt_payment"; amount: number; deleted_at: string | null };

export type DashboardNumbers = {
  /** Cash at the start of the period: the opening balance plus every earlier period's net. */
  carryIn: number;
  /** Income logged this period (Activity's Money in). */
  income: number;
  /** Spending and debt payments this period (Activity's Money out). */
  moneyOut: number;
  /** Net put into pots this period; withdrawals count against it. */
  toSavings: number;
  /** Carry-in + income: the spend bar's whole. */
  periodMoney: number;
  /** What's in hand now (equals cashOnHand over every row). */
  cashNow: number;
  /** Money out / this period's money, from 0 to 1, for the spend bar. */
  spentShare: number;
};

/**
 * The Dashboard's numbers (dashboard.md §1; kept in this file, decided
 * Nov 19). `earlierRows` are every transaction before this period,
 * `periodRows` this period's. Built on lib/transactions so the Dashboard
 * and Activity can't disagree.
 * - Carry-in is the opening balance plus earlier periods' net until Week 6's
 *   carry-over choices refine it (owner, Nov 23).
 * - Money out leaves out transfers to pots for now; from Week 4 the Dashboard
 *   counts them in money out, as the spec says (owner, Nov 23).
 * - Safe to spend (cash now − still due) waits for plan items in Week 5.
 */
export function dashboardNumbers(
  openingBalance: number | null,
  earlierRows: MoneyRow[],
  periodRows: MoneyRow[],
): DashboardNumbers {
  const carryIn = cashOnHand(openingBalance, earlierRows);
  const { moneyIn, moneyOut, toSavings } = periodTotals(periodRows);
  const periodMoney = carryIn + moneyIn;
  const spentShare = periodMoney > 0 ? Math.min(1, moneyOut / periodMoney) : moneyOut > 0 ? 1 : 0;
  return {
    carryIn,
    income: moneyIn,
    moneyOut,
    toSavings,
    periodMoney,
    cashNow: periodMoney - moneyOut - toSavings,
    spentShare,
  };
}
