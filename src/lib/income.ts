import { differenceInCalendarDays, parseISO } from "date-fns";
import { formatPeso } from "@/lib/money";
import { cashOnHand, periodTotals } from "@/lib/transactions";
import { type EarlyStarts, formatShortDate, nextPeriods, type PaySchedule, type PaySlot, paydayLabel } from "@/lib/periods";

// Expected income per payday and per month (income.md §1). Pure functions:
// amounts are integer centavos, and screens only display what these return.

type Source = { amount: number; pay_slot: string };

export type PaydayTotal = { slot: PaySlot; label: string; total: number };

export type ExpectedIncome = {
  paydays: PaydayTotal[];
  perMonth: number;
  /** Weekly budgets: a month isn't a whole number of paydays, so it's "about". */
  perMonthIsEstimate: boolean;
};

export function expectedIncome(sources: Source[], schedule: PaySchedule): ExpectedIncome {
  const sum = (matches: (slot: string) => boolean) =>
    sources.filter((s) => matches(s.pay_slot)).reduce((total, s) => total + s.amount, 0);

  if (schedule.frequency === "semi_monthly") {
    // An "every payday" source lands on both paydays.
    const paydays: PaydayTotal[] = (["payday_1", "payday_2"] as const).map((slot) => ({
      slot,
      label: paydayLabel(schedule, slot),
      total: sum((s) => s === slot || s === "every"),
    }));
    return { paydays, perMonth: paydays[0].total + paydays[1].total, perMonthIsEstimate: false };
  }

  // Weekly and monthly have one payday, so every source lands on it.
  const total = sum(() => true);
  const paydays: PaydayTotal[] = [{ slot: "every", label: paydayLabel(schedule, "every"), total }];
  if (schedule.frequency === "monthly") {
    return { paydays, perMonth: total, perMonthIsEstimate: false };
  }
  // 52 weeks ÷ 12 months, rounded to the nearest centavo.
  return { paydays, perMonth: Math.round((total * 52) / 12), perMonthIsEstimate: true };
}

type DatedSource = Source & { start_date: string; end_date: string | null };

/**
 * Whether a source pays on `date` ("YYYY-MM-DD"): on or after its start, and
 * on or before its end when it has one (a job that stops, plan review 3.2).
 * ISO dates compare correctly as plain strings.
 */
export function isActiveOn(source: DatedSource, date: string): boolean {
  return source.start_date <= date && (source.end_date == null || source.end_date >= date);
}

/** Income expected in one period: sources active on its payday (its first day). */
export function expectedForPeriod(
  sources: DatedSource[],
  schedule: PaySchedule,
  period: { start: string; paySlot: PaySlot },
): number {
  const active = sources.filter((s) => isActiveOn(s, period.start));
  return expectedForSlot(active, schedule, period.paySlot);
}

export type UpcomingPayday = {
  date: string;
  label: string;
  total: number;
  current: boolean;
  /** The current payday, once every source paying on it is logged. */
  received: boolean;
};

/**
 * The next `count` paydays from the current period on, with expected totals.
 * `receivedIds` are the sources received this period (receivedSourceIds).
 */
export function upcomingPaydays(
  today: string,
  schedule: PaySchedule,
  sources: (DatedSource & { id?: string })[],
  count: number,
  receivedIds: Set<string> = new Set(),
  early: EarlyStarts = {},
): UpcomingPayday[] {
  return nextPeriods(today, schedule, count, early).map((period, i) => {
    const paying = sources.filter((s) => paysIn(s, schedule, period));
    return {
      date: period.start,
      label: paydayLabel(schedule, period.paySlot),
      total: expectedForPeriod(sources, schedule, period),
      current: i === 0,
      received: i === 0 && paying.length > 0 && paying.every((s) => s.id != null && receivedIds.has(s.id)),
    };
  });
}

/** One source's money in a month: twice for "every payday" on twice-a-month budgets. */
export function monthlyAmount(source: Source, schedule: PaySchedule): number {
  return expectedIncome([source], schedule).perMonth;
}

/** "Every payday · ₱50,000 a month", "30th only · ₱8,000 a month". */
export function sourceScheduleLine(source: Source, schedule: PaySchedule): string {
  const when =
    source.pay_slot === "every"
      ? "Every payday"
      : `${paydayLabel(schedule, source.pay_slot === "payday_2" ? "payday_2" : "payday_1")} only`;
  const about = schedule.frequency === "weekly" ? "about " : "";
  return `${when} · ${about}${formatPeso(monthlyAmount(source, schedule))} a month`;
}

/** Income expected in a period that starts on the payday `slot`. */
export function expectedForSlot(sources: Source[], schedule: PaySchedule, slot: PaySlot): number {
  const { paydays } = expectedIncome(sources, schedule);
  return (paydays.find((p) => p.slot === slot) ?? paydays[0]).total;
}

/** "2 sources · ₱58,000 a month" (weekly: "about … a month"). */
export function describeIncome(sources: Source[], schedule: PaySchedule): string {
  const { perMonth, perMonthIsEstimate } = expectedIncome(sources, schedule);
  const count = sources.length === 1 ? "1 source" : `${sources.length} sources`;
  return `${count} · ${perMonthIsEstimate ? "about " : ""}${formatPeso(perMonth)} a month`;
}

export type ImpactLine ={ label: string; before: number; after: number };

/**
 * What adding (or changing to) `next` does, for the form's impact box:
 * "15th payday: ₱25,000 → ₱28,000", "Each month: …". Only lines that change.
 * `others` are the budget's other sources (leave out the one being edited).
 */
export function incomeImpact(others: Source[], next: Source, schedule: PaySchedule): ImpactLine[] {
  const before = expectedIncome(others, schedule);
  const after = expectedIncome([...others, next], schedule);

  const lines: ImpactLine[] = before.paydays
    .map((p, i) => ({ label: `${p.label} payday`, before: p.total, after: after.paydays[i].total }))
    // Monthly and weekly have one payday; it would repeat the month line.
    .filter((line) => schedule.frequency === "semi_monthly" && line.after !== line.before);

  lines.push({
    label: after.perMonthIsEstimate ? "About each month" : "Each month",
    before: before.perMonth,
    after: after.perMonth,
  });
  return lines;
}

/**
 * What deleting `removed` does, for the delete dialog: the same lines as
 * adding it, read the other way ("Each month: ₱58,000 → ₱50,000").
 */
export function removalImpact(others: Source[], removed: Source, schedule: PaySchedule): ImpactLine[] {
  return incomeImpact(others, removed, schedule).map((line) => ({
    label: line.label,
    before: line.after,
    after: line.before,
  }));
}

/** Whether a source pays in the period that starts on `period.start`. */
function paysIn(source: DatedSource, schedule: PaySchedule, period: { start: string; paySlot: PaySlot }): boolean {
  // Weekly and monthly budgets have one payday, so every source lands on it.
  const slotMatches =
    schedule.frequency !== "semi_monthly" || source.pay_slot === "every" || source.pay_slot === period.paySlot;
  return slotMatches && isActiveOn(source, period.start);
}

/** How far ahead sourcePayday looks: a year of twice-a-month paydays. */
const LOOKAHEAD_PERIODS = 24;

/**
 * The payday on a source card in the add sheet: this period's ("expected ·
 * Nov 15") or the next one it pays on ("next on Nov 30"). Null once the
 * source has ended (or starts more than LOOKAHEAD_PERIODS away).
 */
export function sourcePayday(
  source: DatedSource,
  schedule: PaySchedule,
  today: string,
  early: EarlyStarts = {},
): { date: string; thisPeriod: boolean } | null {
  const periods = nextPeriods(today, schedule, LOOKAHEAD_PERIODS, early);
  const i = periods.findIndex((p) => paysIn(source, schedule, p));
  return i === -1 ? null : { date: periods[i].start, thisPeriod: i === 0 };
}

/**
 * When each source's pay arrived this period, for the Received tags and the
 * Income screen's status lines: the latest live income from it, or, when
 * onboarding said the first pay had already arrived (`first_pay_received`,
 * plan review 3.14 as changed Nov 20), the payday itself for every source
 * that pays in that period. `rows` are the period's transactions.
 */
export function receivedOn(
  rows: { type: string; income_source_id: string | null; date: string; deleted_at: string | null }[],
  period: { start: string; paySlot: PaySlot; first_pay_received: boolean },
  sources: (DatedSource & { id: string })[],
  schedule: PaySchedule,
): Map<string, string> {
  const dates = new Map<string, string>();
  if (period.first_pay_received) {
    for (const source of sources) if (paysIn(source, schedule, period)) dates.set(source.id, period.start);
  }
  for (const row of rows) {
    if (row.type !== "income" || row.deleted_at != null || !row.income_source_id) continue;
    const latest = dates.get(row.income_source_id);
    // A logged date beats onboarding's stand-in, and later beats earlier.
    if (!latest || row.date > latest || (period.first_pay_received && latest === period.start)) {
      dates.set(row.income_source_id, row.date);
    }
  }
  return dates;
}

/** The sources with a "Received" tag this period (see receivedOn). */
export function receivedSourceIds(
  rows: { type: string; income_source_id: string | null; deleted_at: string | null }[],
  period: { start: string; paySlot: PaySlot; first_pay_received: boolean },
  sources: (DatedSource & { id: string })[],
  schedule: PaySchedule,
): Set<string> {
  // Only whether, not when: any date in the period will do.
  const dated = rows.map((row) => ({ ...row, date: period.start }));
  return new Set(receivedOn(dated, period, sources, schedule).keys());
}

export type StatusLine = { text: string; tone: "positive" | "neutral" };

/**
 * A source card's status lines (income.md §2): this period's payday when the
 * source pays in it ("15th: Received Nov 16" or "15th: Expected Nov 15"),
 * then the next payday it pays on ("30th: Expected Nov 30").
 * `receivedDate` comes from receivedOn.
 */
export function sourceStatusLines(
  source: DatedSource,
  schedule: PaySchedule,
  today: string,
  receivedDate: string | null,
  early: EarlyStarts = {},
): StatusLine[] {
  const [current, ...later] = nextPeriods(today, schedule, LOOKAHEAD_PERIODS, early);
  const lines: StatusLine[] = [];
  if (paysIn(source, schedule, current)) {
    const label = paydayLabel(schedule, current.paySlot);
    lines.push(
      receivedDate
        ? { text: `${label}: Received ${formatShortDate(receivedDate)}`, tone: "positive" }
        : { text: `${label}: Expected ${formatShortDate(current.start)}`, tone: "neutral" },
    );
  }
  const next = later.find((p) => paysIn(source, schedule, p));
  if (next) {
    lines.push({ text: `${paydayLabel(schedule, next.paySlot)}: Expected ${formatShortDate(next.start)}`, tone: "neutral" });
  }
  return lines;
}

/**
 * Recently received's result line (income.md §2): what arrived against the
 * source's expected amount. The amount today, since past amounts aren't
 * stored (owner, Nov 23).
 */
export function incomeResult(amount: number, expected: number): { text: string; tone: "positive" | "warn" } {
  if (amount === expected) return { text: "Received as expected", tone: "positive" };
  const difference = formatPeso(Math.abs(amount - expected));
  return amount < expected
    ? { text: `${difference} less than expected`, tone: "warn" }
    : { text: `${difference} more than expected`, tone: "positive" };
}

/**
 * The pay the Activity empty state offers to log ("I got paid ₱25,000",
 * activity.md §5): the first source paying this period that isn't received.
 * The period's payday is its first day, so it's on or before today, unless
 * the period started early (`early`, Task D2).
 */
export function duePay<T extends DatedSource & { id: string }>(
  sources: T[],
  receivedIds: Set<string>,
  schedule: PaySchedule,
  today: string,
  early: EarlyStarts = {},
): T | null {
  const [current] = nextPeriods(today, schedule, 1, early);
  return sources.find((s) => !receivedIds.has(s.id) && paysIn(s, schedule, current)) ?? null;
}

/** How many days before a payday "Paid early?" shows (owner, Nov 28: holidays can bring pay forward). */
export const EARLY_PAY_DAYS = 5;

/**
 * "Paid early?" (owner, Nov 28): from EARLY_PAY_DAYS before the next payday,
 * the sources paying on it that aren't logged for it yet, in the order
 * given. Early pay is saved on the payday itself, so "logged for it" means
 * live income rows dated inside the next period. Null outside the window,
 * or when every source is logged.
 */
export function earlyPay<T extends DatedSource & { id: string }>(
  sources: T[],
  rows: { type: string; income_source_id: string | null; date: string; deleted_at: string | null }[],
  schedule: PaySchedule,
  today: string,
  early: EarlyStarts = {},
): { payday: string; sources: T[] } | null {
  // After the next period started early it's the current one, so "next" is
  // the payday after it (Task D2).
  const [, next] = nextPeriods(today, schedule, 2, early);
  const daysAway = differenceInCalendarDays(parseISO(next.start), parseISO(today));
  if (daysAway < 1 || daysAway > EARLY_PAY_DAYS) return null;
  const logged = new Set(
    rows
      .filter((r) => r.type === "income" && r.deleted_at == null && r.date >= next.start && r.date <= next.end)
      .map((r) => r.income_source_id),
  );
  const due = sources.filter((s) => !logged.has(s.id) && paysIn(s, schedule, next));
  return due.length > 0 ? { payday: next.start, sources: due } : null;
}

/** The Paid early? panel: "₱25,000 from Company A is due Nov 30." or "₱33,000 from 2 sources is due Nov 30." */
export function earlyPayLine(early: { payday: string; sources: { name: string; amount: number }[] }): string {
  const total = early.sources.reduce((sum, s) => sum + s.amount, 0);
  const from = early.sources.length === 1 ? early.sources[0].name : `${early.sources.length} sources`;
  return `${formatPeso(total)} from ${from} is due ${formatShortDate(early.payday)}.`;
}

export type StartEarlyOffer = {
  /** The next payday ("YYYY-MM-DD"), whose period would start today. */
  payday: string;
  /** Pay already logged early for it. */
  pay: number;
  /** The current period's leftover if it ends yesterday: what the payday screen will show. */
  leftover: number;
  /** Money out dated today, which moves to the new period. */
  movingOut: number;
};

/**
 * Start my next period now (owner, Nov 28; Task D3): offered once pay for
 * the next payday is logged early (dated that payday), from 5 days before
 * it, while that period hasn't started yet and the current one would keep
 * at least a day (the same rules as start_period_early()). `rows` are every
 * transaction; the numbers are the same math as closing a period, so the
 * dialog matches the payday screen.
 */
export function startEarlyOffer(
  openingBalance: number | null,
  rows: { type: string; amount: number; card_id: string | null; date: string; deleted_at: string | null }[],
  schedule: PaySchedule,
  today: string,
  early: EarlyStarts = {},
): StartEarlyOffer | null {
  const [current, next] = nextPeriods(today, schedule, 2, early);
  if (next.firstDay !== next.start) return null;
  const daysAway = differenceInCalendarDays(parseISO(next.start), parseISO(today));
  if (daysAway < 1 || daysAway > EARLY_PAY_DAYS) return null;
  if (today <= current.firstDay) return null;

  const live = rows.filter((r) => r.deleted_at == null);
  // TypeScript can't narrow the type strings; periodTotals and cashOnHand only read these four.
  type Row = Parameters<typeof cashOnHand>[1][number];
  const pay = live
    .filter((r) => r.type === "income" && r.date >= next.start && r.date <= next.end)
    .reduce((sum, r) => sum + r.amount, 0);
  if (pay <= 0) return null;
  return {
    payday: next.start,
    pay,
    leftover: cashOnHand(openingBalance, live.filter((r) => r.date < today) as Row[]),
    movingOut: periodTotals(live.filter((r) => r.date >= today && r.date < next.start) as Row[]).moneyOut,
  };
}
