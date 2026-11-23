// Transaction math (Week 3, task 3b). Pure functions on integer centavos;
// screens only display what these return. Every function skips soft-deleted
// rows itself, even though queries already filter them, so a missed filter
// can't change a total.

export type TransactionType = "income" | "expense" | "savings" | "debt_payment";

/** The fields the math needs from a `transactions` row. */
export type TransactionRow = {
  id: string;
  type: TransactionType;
  /** Centavos. Above zero, except savings: negative is a pot withdrawal. */
  amount: number;
  /** "YYYY-MM-DD", Manila time. */
  date: string;
  created_at: string;
  deleted_at: string | null;
};

type Row = Pick<TransactionRow, "type" | "amount" | "deleted_at">;

function live<T extends Row>(rows: T[]): T[] {
  return rows.filter((t) => t.deleted_at == null);
}

/**
 * The row's effect on cash on hand: income adds; spending and debt payments
 * take away. Savings flips its sign: putting ₱3,000 in a pot is −₱3,000 cash,
 * and a withdrawal (stored as −₱1,000) brings +₱1,000 back.
 */
export function signedAmount(t: Pick<TransactionRow, "type" | "amount">): number {
  return t.type === "income" ? t.amount : -t.amount;
}

export type PeriodTotals = {
  /** Income. */
  moneyIn: number;
  /** Spending plus debt payments. */
  moneyOut: number;
  /** Pot deposits minus withdrawals; negative when more came out than went in. */
  toSavings: number;
};

export function periodTotals(rows: Row[]): PeriodTotals {
  const totals: PeriodTotals = { moneyIn: 0, moneyOut: 0, toSavings: 0 };
  for (const t of live(rows)) {
    if (t.type === "income") totals.moneyIn += t.amount;
    else if (t.type === "savings") totals.toSavings += t.amount;
    else totals.moneyOut += t.amount; // expense and debt_payment
  }
  return totals;
}

export type DayGroup<T> = { date: string; net: number; rows: T[] };

/**
 * Rows grouped by date for the Activity list: newest day first, newest row
 * first within a day, and each day's net cash effect (pot moves included).
 */
export function groupByDay<T extends TransactionRow>(rows: T[]): DayGroup<T>[] {
  const byDate = new Map<string, T[]>();
  for (const t of live(rows)) {
    const day = byDate.get(t.date);
    if (day) day.push(t);
    else byDate.set(t.date, [t]);
  }
  // ISO dates and timestamps sort correctly as plain strings.
  return [...byDate.entries()]
    .sort(([a], [b]) => (a < b ? 1 : a > b ? -1 : 0))
    .map(([date, dayRows]) => {
      const sorted = dayRows.toSorted((a, b) => (a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0));
      return { date, net: sorted.reduce((sum, t) => sum + signedAmount(t), 0), rows: sorted };
    });
}

/**
 * Cash on hand = opening balance + income − spending − net savings − debt
 * payments, over every transaction from the first period through today (owner,
 * Nov 23). An empty opening balance (onboarding step 3 not done) counts as ₱0.
 * Week 6's carry-over refines this.
 */
export function cashOnHand(openingBalance: number | null, rows: Row[]): number {
  return live(rows).reduce((cash, t) => cash + signedAmount(t), openingBalance ?? 0);
}
