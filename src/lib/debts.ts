import { differenceInCalendarDays, parseISO } from "date-fns";
import { dateInMonth, getPeriod, type PaySchedule } from "@/lib/periods";

// Debt math (debts.md §1, week-4-tasks.md 4b): pure functions, no React.
// "Left" is worked out from the debt's payments, never stored (mvp-brief.md).
// Interest is display only and changes no number here.

export type DebtTerms = {
  total_amount: number;
  /** "flexible" is "When I can" (Nov 24): no schedule, pay whenever there's extra. */
  payment_type: "installments" | "one_time" | "flexible";
  /** Empty for flexible debts (the database checks each type's fields). */
  num_payments: number | null;
  payment_amount: number | null;
  first_due_date: string | null;
  /** Flexible debts only: "Aim to pay off by", the 1st of that month. */
  target_date?: string | null;
};

export type ScheduledPayment = { number: number; due: string; amount: number };

/**
 * The payment schedule: `num_payments` payments, monthly from the first due
 * date, keeping its day (the 31st falls on a shorter month's last day,
 * debts.md fix #5). The last payment is whatever is left, so an uneven
 * amount still adds up to the total. A one-time debt is one payment; a
 * flexible ("When I can") debt has none.
 */
export function debtSchedule(debt: DebtTerms): ScheduledPayment[] {
  if (debt.payment_type === "flexible" || debt.first_due_date == null) return [];
  const year = Number(debt.first_due_date.slice(0, 4));
  const month = Number(debt.first_due_date.slice(5, 7));
  const day = Number(debt.first_due_date.slice(8, 10));
  const count = debt.payment_type === "one_time" ? 1 : (debt.num_payments ?? 1);
  const each = debt.payment_type === "one_time" ? debt.total_amount : (debt.payment_amount ?? debt.total_amount);

  return Array.from({ length: count }, (_, i) => ({
    number: i + 1,
    due: dateInMonth(year, month + i, day),
    amount: i === count - 1 ? debt.total_amount - each * (count - 1) : each,
  }));
}

/** What has been paid: the debt's payments, skipping deleted ones. */
export function debtPaid(rows: { amount: number; deleted_at: string | null }[]): number {
  return rows.reduce((sum, r) => (r.deleted_at == null ? sum + r.amount : sum), 0);
}

export type PaymentStatus = "paid" | "due" | "planned" | "late";

export type DebtProgress = {
  paid: number;
  /** Never below ₱0. */
  left: number;
  paidOff: boolean;
  /** How many scheduled payments the paid amount fully covers. */
  paymentsMade: number;
  /**
   * The last due date in the schedule (debts.md §1 "Debt-free by"). For a
   * flexible debt, the end of its target month, or null without one.
   */
  debtFreeBy: string | null;
  payments: (ScheduledPayment & { status: PaymentStatus; daysLate?: number })[];
};

/**
 * Where a debt stands (debts.md §1). Payments count in order: one is Paid
 * once everything paid covers it and every payment before it. An unpaid one
 * is Late after its due date ("Late · 3 days"), Due when it falls in the
 * current `period`, and Planned otherwise.
 */
export function debtProgress(
  debt: DebtTerms,
  paid: number,
  today: string,
  period: { start: string; end: string },
): DebtProgress {
  const schedule = debtSchedule(debt);
  let covered = 0;
  let paymentsMade = 0;
  const payments = schedule.map((payment) => {
    covered += payment.amount;
    if (paid >= covered) {
      paymentsMade += 1;
      return { ...payment, status: "paid" as const };
    }
    if (payment.due < today) {
      return {
        ...payment,
        status: "late" as const,
        daysLate: differenceInCalendarDays(parseISO(today), parseISO(payment.due)),
      };
    }
    const inPeriod = payment.due >= period.start && payment.due <= period.end;
    return { ...payment, status: inPeriod ? ("due" as const) : ("planned" as const) };
  });

  const left = Math.max(debt.total_amount - paid, 0);
  return {
    paid,
    left,
    paidOff: left === 0,
    paymentsMade,
    debtFreeBy: schedule.length > 0 ? schedule[schedule.length - 1].due : targetMonthEnd(debt.target_date),
    payments,
  };
}

// A target month ("2027-06-01") → its last day ("2027-06-30"), or null.
function targetMonthEnd(target: string | null | undefined): string | null {
  if (!target) return null;
  return dateInMonth(Number(target.slice(0, 4)), Number(target.slice(5, 7)), 31);
}

/**
 * New debt's hint for a flexible debt with a target (Nov 24): "To be
 * debt-free by Jun 2027, pay about ₱900 a month." What's left over the
 * months from this one to the target month, rounded up to ₱100. Null when
 * nothing is left or the month has passed.
 */
export function flexibleMonthly(left: number, today: string, targetDate: string): number | null {
  if (left <= 0) return null;
  const months =
    (Number(targetDate.slice(0, 4)) - Number(today.slice(0, 4))) * 12 +
    (Number(targetDate.slice(5, 7)) - Number(today.slice(5, 7))) +
    1;
  if (months < 1) return null;
  // Whole ₱100 steps (10,000 centavos), rounded up so the target is met.
  const STEP = 10_000;
  return Math.ceil(left / (months * STEP)) * STEP;
}

// ---------------------------------------------------------------------------
// The Debts screen (debts.md §1–3, task 4f)
// ---------------------------------------------------------------------------

/**
 * Which payday pays a payment (debts.md §1): the payday that starts the
 * period containing the due date. Nov 25 → the Nov 15 payday; Dec 5 → Nov 30.
 */
export function paydayFor(due: string, schedule: PaySchedule): string {
  return getPeriod(due, schedule).start;
}

/** Finished: marked paid off ("Mark it paid off"), or nothing left. */
export function isPaidOff(debt: { total_amount: number; paid: number; paid_off_at: string | null }): boolean {
  return debt.paid_off_at != null || debt.paid >= debt.total_amount;
}

type SummaryDebt = DebtTerms & { name: string; paid: number; paid_off_at: string | null };

export type DebtsSummary = {
  /** "Total owed": what's left across active debts. */
  totalOwed: number;
  /** The hero bar: "₱4,000 of ₱12,000 paid" across active debts. */
  activeTotal: number;
  activePaid: number;
  /** Unpaid payments due in the current period. */
  dueThisPeriod: number;
  /** The earliest of those, for "SPayLater · Nov 25". */
  nextDue: { name: string; date: string } | null;
  /** The last due date across active debts, if every payment is made. */
  debtFreeBy: string | null;
  /** Every payment ever, finished debts included. */
  paidSoFar: number;
  activeCount: number;
  paidOffCount: number;
};

/** The Debts page's numbers (debts.md §1–3). */
export function debtsSummary(
  debts: SummaryDebt[],
  today: string,
  period: { start: string; end: string },
): DebtsSummary {
  const summary: DebtsSummary = {
    totalOwed: 0,
    activeTotal: 0,
    activePaid: 0,
    dueThisPeriod: 0,
    nextDue: null,
    debtFreeBy: null,
    paidSoFar: 0,
    activeCount: 0,
    paidOffCount: 0,
  };
  for (const debt of debts) {
    summary.paidSoFar += debt.paid;
    if (isPaidOff(debt)) {
      summary.paidOffCount += 1;
      continue;
    }
    const progress = debtProgress(debt, debt.paid, today, period);
    summary.activeCount += 1;
    summary.totalOwed += progress.left;
    summary.activeTotal += debt.total_amount;
    summary.activePaid += Math.min(debt.paid, debt.total_amount);
    for (const p of progress.payments) {
      if (p.status !== "due") continue;
      summary.dueThisPeriod += p.amount;
      if (!summary.nextDue || p.due < summary.nextDue.date) summary.nextDue = { name: debt.name, date: p.due };
    }
    // A flexible debt without a target has no date, so it doesn't move this.
    const by = progress.debtFreeBy;
    if (by && (!summary.debtFreeBy || by > summary.debtFreeBy)) summary.debtFreeBy = by;
  }
  return summary;
}

/** A payment's status in words (debts.md §6): "Paid", "Due in 5 days", "Planned", "Late · 3 days". */
export function paymentStatusText(
  payment: { status: PaymentStatus; due: string; daysLate?: number },
  today: string,
): string {
  switch (payment.status) {
    case "paid":
      return "Paid";
    case "planned":
      return "Planned";
    case "late": {
      const days = payment.daysLate ?? 0;
      return `Late · ${days} ${days === 1 ? "day" : "days"}`;
    }
    case "due": {
      const days = differenceInCalendarDays(parseISO(payment.due), parseISO(today));
      if (days <= 0) return "Due today";
      if (days === 1) return "Due tomorrow";
      return `Due in ${days} days`;
    }
  }
}
