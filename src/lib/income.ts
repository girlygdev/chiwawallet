import { formatPeso } from "@/lib/money";
import { nextPeriods, type PaySchedule, type PaySlot, paydayLabel } from "@/lib/periods";

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

export type UpcomingPayday = { date: string; label: string; total: number; current: boolean };

/** The next `count` paydays from the current period on, with expected totals. */
export function upcomingPaydays(
  today: string,
  schedule: PaySchedule,
  sources: DatedSource[],
  count: number,
): UpcomingPayday[] {
  return nextPeriods(today, schedule, count).map((period, i) => ({
    date: period.start,
    label: paydayLabel(schedule, period.paySlot),
    total: expectedForPeriod(sources, schedule, period),
    current: i === 0,
  }));
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
