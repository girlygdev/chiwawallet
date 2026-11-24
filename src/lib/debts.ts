import { differenceInCalendarDays, parseISO } from "date-fns";
import { dateInMonth } from "@/lib/periods";

// Debt math (debts.md §1, week-4-tasks.md 4b): pure functions, no React.
// "Left" is worked out from the debt's payments, never stored (mvp-brief.md).
// Interest is display only and changes no number here.

export type DebtTerms = {
  total_amount: number;
  payment_type: "installments" | "one_time";
  num_payments: number;
  payment_amount: number;
  first_due_date: string;
};

export type ScheduledPayment = { number: number; due: string; amount: number };

/**
 * The payment schedule: `num_payments` payments, monthly from the first due
 * date, keeping its day (the 31st falls on a shorter month's last day,
 * debts.md fix #5). The last payment is whatever is left, so an uneven
 * amount still adds up to the total. A one-time debt is one payment.
 */
export function debtSchedule(debt: DebtTerms): ScheduledPayment[] {
  const year = Number(debt.first_due_date.slice(0, 4));
  const month = Number(debt.first_due_date.slice(5, 7));
  const day = Number(debt.first_due_date.slice(8, 10));
  const count = debt.payment_type === "one_time" ? 1 : debt.num_payments;
  const each = debt.payment_type === "one_time" ? debt.total_amount : debt.payment_amount;

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
  /** The last due date in the schedule (debts.md §1 "Debt-free by"). */
  debtFreeBy: string;
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
    debtFreeBy: schedule[schedule.length - 1].due,
    payments,
  };
}
