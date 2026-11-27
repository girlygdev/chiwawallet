import { differenceInCalendarDays, parseISO } from "date-fns";
import { dateInMonth, getPeriod, type PaySchedule } from "@/lib/periods";

// Debt math (debts.md §1, week-4-tasks.md 4b): pure functions, no React.
// "Left" is worked out from the debt's payments, never stored (mvp-brief.md).
// Interest is display only and changes no number here.

export type DebtTerms = {
  total_amount: number;
  /**
   * "flexible" is "When I can" (Nov 24): no schedule, pay whenever there's extra.
   * "card" is a credit card (8b-1): no schedule either; its balance is cardBalance().
   */
  payment_type: "installments" | "one_time" | "flexible" | "card";
  /** Empty for flexible debts and cards (the database checks each type's fields). */
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

/**
 * Everything paid, and the extra payments apart (`extra`: in the Extra debt
 * payment category). Extra payments lower the last scheduled payments
 * first (debts.md §5, reducedSchedule()); the rest fill them from the oldest.
 */
export function debtPaidByKind(rows: { amount: number; deleted_at: string | null; extra: boolean }[]): {
  paid: number;
  extraPaid: number;
} {
  return {
    paid: debtPaid(rows),
    extraPaid: debtPaid(rows.filter((r) => r.extra)),
  };
}

/**
 * One debt's paid and extra paid from loaded payment rows, each with its
 * category's `system_key` (`category:categories(system_key)`): Extra debt
 * payment rows are the extra ones.
 */
export function debtPaidFor(
  rows: { debt_id: string | null; amount: number; deleted_at: string | null; category: unknown }[],
  debtId: string,
): { paid: number; extraPaid: number } {
  return debtPaidByKind(
    rows
      .filter((r) => r.debt_id === debtId)
      .map((r) => ({ ...r, extra: (r.category as { system_key: string | null } | null)?.system_key === "extra_debt" })),
  );
}

/**
 * The schedule after extra payments (debts.md §5: they "lower the last
 * payments first, so the debt-free date can move earlier"): `extraPaid` is
 * taken off the last payment, then the one before, and so on. A payment
 * brought to ₱0 is cleared. Numbers and due dates don't change.
 */
export function reducedSchedule(schedule: ScheduledPayment[], extraPaid: number): ScheduledPayment[] {
  let extra = Math.max(0, extraPaid);
  const reduced = [...schedule];
  for (let i = reduced.length - 1; i >= 0 && extra > 0; i--) {
    const off = Math.min(extra, reduced[i].amount);
    reduced[i] = { ...reduced[i], amount: reduced[i].amount - off };
    extra -= off;
  }
  return reduced;
}

/** "cleared": extra payments covered all of it, so it was never paid on its own (7e). */
export type PaymentStatus = "paid" | "cleared" | "due" | "planned" | "late";

/** Paid or cleared early: nothing left to pay on it. */
export function isSettled(status: PaymentStatus): boolean {
  return status === "paid" || status === "cleared";
}

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
  /** `amount` is what's left to pay after extras; `original` the scheduled amount; `cleared` the difference. */
  payments: (ScheduledPayment & { status: PaymentStatus; original: number; cleared: number; daysLate?: number })[];
};

/**
 * Where a debt stands (debts.md §1). Extra payments (`extraPaid`, part of
 * `paid`) shrink the schedule from the last payment (reducedSchedule());
 * the other payments count in order: one is Paid once they cover it and
 * every payment before it. One extra payments cleared entirely is Cleared
 * early ("cleared", 7e) and counts as made; one they partly lowered keeps
 * its status and carries `cleared`, for "₱1,500 cleared early".
 * An unpaid one is Late after its due date ("Late · 3 days"), Due when it
 * falls in the current `period`, and Planned otherwise.
 */
export function debtProgress(
  debt: DebtTerms,
  paid: number,
  today: string,
  period: { start: string; end: string },
  extraPaid = 0,
): DebtProgress {
  const full = debtSchedule(debt);
  const schedule = reducedSchedule(full, extraPaid);
  const scheduledPaid = paid - extraPaid;
  let covered = 0;
  let paymentsMade = 0;
  const payments = schedule.map((reduced, i) => {
    const original = full[i].amount;
    const payment = { ...reduced, original, cleared: original - reduced.amount };
    covered += payment.amount;
    // Cleared by extra payments, or covered by the scheduled ones.
    if (payment.amount === 0 && original > 0) {
      paymentsMade += 1;
      return { ...payment, status: "cleared" as const };
    }
    if (scheduledPaid >= covered) {
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
    // The last payment extra payments haven't cleared: it moves earlier.
    debtFreeBy:
      schedule.length > 0
        ? (schedule.findLast((p) => p.amount > 0) ?? schedule[schedule.length - 1]).due
        : targetMonthEnd(debt.target_date),
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

/**
 * What's left to pay: the total minus what's paid, never below ₱0; ₱0 once
 * marked paid off. The most a planned extra payment can be (5g-2).
 */
export function debtLeft(debt: { total_amount: number; paid: number; paid_off_at: string | null }): number {
  return isPaidOff(debt) ? 0 : debt.total_amount - debt.paid;
}

type SummaryDebt = DebtTerms & { name: string; paid: number; paid_off_at: string | null; extraPaid?: number };

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
    const progress = debtProgress(debt, debt.paid, today, period, debt.extraPaid ?? 0);
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

/** A payment's status in words (debts.md §6): "Paid", "Cleared early", "Due in 5 days", "Planned", "Late · 3 days". */
export function paymentStatusText(
  payment: { status: PaymentStatus; due: string; daysLate?: number },
  today: string,
): string {
  switch (payment.status) {
    case "paid":
      return "Paid";
    case "cleared":
      return "Cleared early";
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

/**
 * To a debt (6d-2): how a payment splits when a scheduled payment is due.
 * It pays that first (Debt payment, Needs); anything above it is extra
 * (Extra debt payment, Savings & debt payoff). Less than it still pays it.
 * `scheduled`: the unpaid scheduled amount this period, or null if none.
 */
export function debtPaymentSplit(amount: number, scheduled: number | null): { scheduled: number; extra: number } {
  if (scheduled == null) return { scheduled: 0, extra: amount };
  return { scheduled: Math.min(amount, scheduled), extra: Math.max(0, amount - scheduled) };
}

/** What a debt will owe after a payment, never below ₱0: "₱4,000 left after this" (dashboard.md §3). */
export function debtLeftAfter(left: number, payment: number): number {
  return Math.max(0, left - payment);
}

/**
 * A credit card's balance (8b-1): what was owed when it was added
 * (`total_amount`), plus purchases on it, minus payments to it. Never
 * stored. Below ₱0 when more was paid than owed (a credit on the card).
 * `rows` may hold other cards' and plain rows; only this card's count.
 */
export function cardBalance(
  startingBalance: number,
  rows: { type: string; amount: number; card_id: string | null; deleted_at: string | null }[],
  cardId: string,
): number {
  return rows.reduce((balance, r) => {
    if (r.deleted_at != null || r.card_id !== cardId) return balance;
    if (r.type === "expense") return balance + r.amount;
    if (r.type === "debt_payment") return balance - r.amount;
    return balance;
  }, startingBalance);
}
