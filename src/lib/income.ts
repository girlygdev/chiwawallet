import { type PaySchedule, type PaySlot, paydayLabel } from "@/lib/periods";

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

export type ImpactLine = { label: string; before: number; after: number };

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
