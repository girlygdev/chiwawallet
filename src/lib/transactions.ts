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

/**
 * The Add expense impact line (week-3-tasks.md 3c): "Money out this period:
 * ₱X → ₱Y". `rows` are the period's transactions; `amount` is the new expense.
 */
export function moneyOutImpact(rows: Row[], amount: number): { before: number; after: number } {
  const before = periodTotals(rows).moneyOut;
  return { before, after: before + amount };
}

/** The category fields the Add expense grid needs. */
export type CategoryChoice = {
  id: string;
  name: string;
  kind: string;
  budget_group: string | null;
  system_key: string | null;
};

export type BudgetGroup = "needs" | "wants" | "savings_debt";

const GROUP_ORDER: BudgetGroup[] = ["needs", "wants", "savings_debt"];

/** Offered in the add sheet: expense categories that aren't system ones. */
const offerable = (c: CategoryChoice) => c.kind === "expense" && c.system_key == null;

/**
 * The categories offered in the Add expense grid, best first: the most used
 * among `recentCategoryIds` (the user's latest expenses), then Needs before
 * Wants before Savings & debt, then A to Z (owner, Nov 23). Income and system
 * categories are never offered: pots and extra debt payments have their own
 * flows (activity.md fix #4). Pass `limit` = Infinity for the full list.
 */
export function topCategories<T extends CategoryChoice>(categories: T[], recentCategoryIds: string[], limit: number): T[] {
  const uses = new Map<string, number>();
  for (const id of recentCategoryIds) uses.set(id, (uses.get(id) ?? 0) + 1);
  const groupRank = (c: T) => {
    const i = (GROUP_ORDER as string[]).indexOf(c.budget_group ?? "");
    return i === -1 ? GROUP_ORDER.length : i;
  };

  return categories
    .filter(offerable)
    .toSorted(
      (a, b) =>
        (uses.get(b.id) ?? 0) - (uses.get(a.id) ?? 0) ||
        groupRank(a) - groupRank(b) ||
        a.name.localeCompare(b.name, "en", { sensitivity: "base" }),
    )
    .slice(0, limit);
}

/**
 * The picker's RECENT row (activity.md §4): the categories of the user's
 * latest expenses, each once, newest first. `latestCategoryIds` is newest
 * first. Income, system and missing categories are skipped before `limit`.
 */
export function recentCategories<T extends CategoryChoice>(
  categories: T[],
  latestCategoryIds: string[],
  limit: number,
): T[] {
  const byId = new Map(categories.filter(offerable).map((c) => [c.id, c]));
  const recent = new Set<T>();
  for (const id of latestCategoryIds) {
    if (recent.size >= limit) break;
    const category = byId.get(id);
    if (category) recent.add(category);
  }
  return [...recent];
}

/**
 * The picker's sections (activity.md §4): one per 50/30/20 group in that
 * order, keeping the given order inside each, with empty groups left out
 * (owner, Nov 23). `query` keeps names that contain it, ignoring case.
 */
export function groupCategories<T extends CategoryChoice>(
  categories: T[],
  query: string,
): { group: BudgetGroup; categories: T[] }[] {
  const needle = query.trim().toLocaleLowerCase("en");
  const matches = categories.filter((c) => c.name.toLocaleLowerCase("en").includes(needle));
  return GROUP_ORDER
    .map((group) => ({ group, categories: matches.filter((c) => c.budget_group === group) }))
    .filter((section) => section.categories.length > 0);
}

/**
 * The grid's tiles: the top `topCount`, except that a category picked from
 * the picker takes the last place when it isn't among them, so the choice is
 * always visible.
 */
export function gridCategories<T extends { id: string }>(categories: T[], topCount: number, value?: string): T[] {
  const top = categories.slice(0, topCount);
  if (!value || top.some((c) => c.id === value)) return top;
  const picked = categories.find((c) => c.id === value);
  return picked ? [...top.slice(0, topCount - 1), picked] : top;
}
