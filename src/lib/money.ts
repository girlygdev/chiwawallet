// Money is stored and passed around as integer centavos (CLAUDE.md "Money and
// dates"). These two functions are the only places pesos are turned into
// centavos or back, so floating point never touches an amount.

import { differenceInCalendarDays, parseISO } from "date-fns";
import { type BudgetGroup, cashOnHand, periodTotals } from "@/lib/transactions";

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
  spending: number;
  /** Net put into pots this period; withdrawals count against it (Activity's To savings). */
  toSavings: number;
  /** The Dashboard's Money out: spending plus net transfers to pots (Week 4). */
  moneyOut: number;
  /** Carry-in + income, plus net withdrawals from pots: the spend bar's whole. */
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
 * - From Week 4, Money out counts net transfers to pots too, as the spec says
 *   (owner, Nov 23); Activity keeps showing them apart as To savings. When
 *   withdrawals are bigger than deposits, the difference is money coming in
 *   this period (like Delete pot's "Adds ₱6,000 to this period's money"), so
 *   Money out never drops below spending and cash now = period money − money out.
 * - Safe to spend (cash now − still due) waits for plan items in Week 5.
 */
export function dashboardNumbers(
  openingBalance: number | null,
  earlierRows: MoneyRow[],
  periodRows: MoneyRow[],
): DashboardNumbers {
  const carryIn = cashOnHand(openingBalance, earlierRows);
  const { moneyIn, moneyOut: spending, toSavings } = periodTotals(periodRows);
  const moneyOut = spending + Math.max(toSavings, 0);
  const periodMoney = carryIn + moneyIn + Math.max(-toSavings, 0);
  const spentShare = periodMoney > 0 ? Math.min(1, moneyOut / periodMoney) : moneyOut > 0 ? 1 : 0;
  return {
    carryIn,
    income: moneyIn,
    spending,
    toSavings,
    moneyOut,
    periodMoney,
    cashNow: periodMoney - moneyOut,
    spentShare,
  };
}

// ---------------------------------------------------------------------------
// Safe to spend (dashboard.md §1, week-6-tasks.md 6c)
// ---------------------------------------------------------------------------

/**
 * Still due: this period's unpaid planned money out, the bills, savings,
 * debt payments and one-offs (\`tickable\` plan items, owner Nov 26).
 * Spending budgets and income aren't due; they're measured by spending.
 */
export function stillDueTotal(items: { tickable: boolean; paid_at: string | null; planned_amount: number }[]): number {
  return items.reduce((sum, i) => (i.tickable && i.paid_at == null ? sum + i.planned_amount : sum), 0);
}

/** Safe to spend: cash now − still due. Below 0 when what's due is more than what's on hand. */
export function safeToSpend(cashNow: number, stillDue: number): number {
  return cashNow - stillDue;
}

/**
 * The per-day pill: Safe to spend ÷ days left, counting today (Manila
 * dates), rounded down to whole pesos. Below 0: "Over by ₱X" instead.
 */
export function perDay(
  safe: number,
  today: string,
  periodEnd: string,
): { kind: "per_day"; amount: number; days: number } | { kind: "over"; amount: number } {
  if (safe < 0) return { kind: "over", amount: -safe };
  const days = Math.max(1, differenceInCalendarDays(parseISO(periodEnd), parseISO(today)) + 1);
  return { kind: "per_day", amount: Math.floor(safe / days / 100) * 100, days };
}

// ---------------------------------------------------------------------------
// The Dashboard's 50/30/20 check (dashboard.md §5, task 7b)
// ---------------------------------------------------------------------------

/** Below this much money out, the card stays hidden (₱1,000: a coffee shouldn't read "100% Wants"). */
const SPLIT_MINIMUM = 100_000;

export type SpentGroup = {
  amount: number;
  /** 0–1 of money out so far. */
  share: number;
  /** The share as a whole percent. */
  pct: number;
  /** The budget's target percent. */
  target: number;
  /** Desktop: "11 pts over 50%", "above 20%", or "target 30%". */
  compare: string;
};

/**
 * What was spent this period by 50/30/20 group (dashboard.md §5), as a
 * share of money out so far, the same base as the Dashboard's "₱X out so
 * far". Expenses and debt payments count by their category's group:
 * scheduled payments are in Debt payment (Needs) and extra ones in Extra
 * debt payment (Savings & debt payoff), as Mark paid and Transfer file them.
 * Transfers to pots count as Savings & debt payoff (net of withdrawals,
 * never below ₱0). Over target is said in words, never by colour alone.
 */
export function spentSplit(
  rows: { type: string; amount: number; deleted_at: string | null; category_id: string }[],
  groupOf: Record<string, string | null>,
  targets: { needs_pct: number; wants_pct: number; savings_debt_pct: number },
): { base: number; show: boolean; groups: Record<BudgetGroup, SpentGroup> } {
  const amounts: Record<BudgetGroup, number> = { needs: 0, wants: 0, savings_debt: 0 };
  for (const r of rows) {
    if (r.deleted_at != null || (r.type !== "expense" && r.type !== "debt_payment")) continue;
    const group = groupOf[r.category_id];
    if (group === "needs" || group === "wants" || group === "savings_debt") amounts[group] += r.amount;
  }
  // The same rows the Dashboard counts (periodTotals()): net transfers to pots.
  amounts.savings_debt += Math.max(0, periodTotals(rows as Parameters<typeof periodTotals>[0]).toSavings);
  const base = amounts.needs + amounts.wants + amounts.savings_debt;

  const group = (key: BudgetGroup, target: number): SpentGroup => {
    const share = base > 0 ? amounts[key] / base : 0;
    const pct = Math.round(share * 100);
    const compare =
      key === "savings_debt"
        ? pct > target
          ? `above ${target}%`
          : `target ${target}%`
        : pct > target
          ? `${pct - target} ${pct - target === 1 ? "pt" : "pts"} over ${target}%`
          : `target ${target}%`;
    return { amount: amounts[key], share, pct, target, compare };
  };
  return {
    base,
    show: base >= SPLIT_MINIMUM,
    groups: {
      needs: group("needs", targets.needs_pct),
      wants: group("wants", targets.wants_pct),
      savings_debt: group("savings_debt", targets.savings_debt_pct),
    },
  };
}
