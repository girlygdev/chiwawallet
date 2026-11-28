import { addDays, format, parseISO } from "date-fns";
import { formatPeso } from "@/lib/money";
import { dateInMonth, getPeriod, ordinal, type PaySchedule, type PaySlot } from "@/lib/periods";

// Savings pot math (savings.md §1, week-4-tasks.md 4b): pure functions, no
// React. Balances are worked out from transactions, never stored
// (mvp-brief.md): a withdrawal is a negative savings amount (plan review 3.5).

/** The starting balance plus deposits minus withdrawals, skipping deleted rows. */
export function potBalance(pot: { starting_balance: number }, rows: { amount: number; deleted_at: string | null }[]): number {
  return rows.reduce((sum, r) => (r.deleted_at == null ? sum + r.amount : sum), pot.starting_balance);
}

/** How far along the target is, 0 to 1 (for the progress bar); null without a target. */
export function potProgress(balance: number, target: number | null): number | null {
  if (target == null) return null;
  return Math.min(Math.max(balance / target, 0), 1);
}

type Contributes = { pay_slot: PaySlot };

// Does this payday pay into the pot? Pots on "every" save every payday. On a
// weekly or monthly budget every period is "every", so any pot saves then.
const savesOn = (pot: Contributes, paySlot: PaySlot) =>
  pot.pay_slot === "every" || paySlot === "every" || paySlot === pot.pay_slot;

/**
 * The paydays after `today`, oldest first, as { date, paySlot }. Each
 * period's start is its payday. Stops after `limit` paydays.
 */
function* comingPaydays(schedule: PaySchedule, today: string, limit: number) {
  let period = getPeriod(today, schedule);
  for (let i = 0; i < limit; i++) {
    const nextDay = format(addDays(parseISO(period.end), 1), "yyyy-MM-dd");
    period = getPeriod(nextDay, schedule);
    yield { date: period.start, paySlot: period.paySlot };
  }
}

// About 50 years of weekly paydays: far enough for any real goal.
const MAX_PAYDAYS = 2_600;

/**
 * The goal date (savings.md §1 "On track for…"): step through the coming
 * paydays, adding the planned contribution on the pot's paydays, until the
 * balance reaches the target. Returns that payday ("YYYY-MM-DD"; show its
 * month), or null with no target, no contribution, or the target already
 * reached.
 */
export function potGoalDate(
  pot: Contributes & { target_amount: number | null; planned_contribution: number },
  balance: number,
  schedule: PaySchedule,
  today: string,
): string | null {
  if (pot.target_amount == null || pot.planned_contribution <= 0 || balance >= pot.target_amount) return null;
  let saved = balance;
  for (const payday of comingPaydays(schedule, today, MAX_PAYDAYS)) {
    if (!savesOn(pot, payday.paySlot)) continue;
    saved += pot.planned_contribution;
    if (saved >= pot.target_amount) return payday.date;
  }
  return null;
}

/**
 * New pot's second projection line (savings.md §4): "Save ₱2,900 each payday
 * to make it by June." What's left, split over the pot's paydays from after
 * today to the end of the target month, rounded up to the nearest ₱100.
 * Null without a target or date, when it's reached, or with no payday left.
 */
export function contributionNeeded(
  pot: Contributes & { target_amount: number | null; target_date: string | null },
  balance: number,
  schedule: PaySchedule,
  today: string,
): number | null {
  if (pot.target_amount == null || pot.target_date == null || balance >= pot.target_amount) return null;
  // target_date is the 1st of the month; the goal is the end of that month.
  const monthEnd = dateInMonth(Number(pot.target_date.slice(0, 4)), Number(pot.target_date.slice(5, 7)), 31);

  let paydays = 0;
  for (const payday of comingPaydays(schedule, today, MAX_PAYDAYS)) {
    if (payday.date > monthEnd) break;
    if (savesOn(pot, payday.paySlot)) paydays += 1;
  }
  if (paydays === 0) return null;

  // Whole ₱100 steps (10,000 centavos), rounded up so the goal is met.
  const STEP = 10_000;
  return Math.ceil((pot.target_amount - balance) / (paydays * STEP)) * STEP;
}

// ---------------------------------------------------------------------------
// The Savings screen (savings.md §1–2, task 4d)
// ---------------------------------------------------------------------------

type Planned = Contributes & { planned_contribution: number };

/** How many of a pot's paydays fall in a month, times 12 (whole numbers). */
function paydaysPerYear(pot: Contributes, schedule: PaySchedule): number {
  switch (schedule.frequency) {
    case "weekly":
      return 52;
    case "monthly":
      return 12;
    case "semi_monthly":
      return pot.pay_slot === "every" ? 24 : 12;
  }
}

/**
 * "Monthly saving plan" (savings.md §1): each pot's contribution × its
 * paydays a month. Weekly budgets count 52 ÷ 12 paydays a month. Rounded
 * once, to the centavo.
 */
export function monthlySavingPlan(pots: Planned[], schedule: PaySchedule): number {
  const perYear = pots.reduce((sum, p) => sum + p.planned_contribution * paydaysPerYear(p, schedule), 0);
  return Math.round(perYear / 12);
}

/** "₱3k", "₱1.5k"; under ₱1,000 the whole amount ("₱500"). */
const thousands = new Intl.NumberFormat("en-PH", { maximumFractionDigits: 1 });
function shortPeso(centavos: number): string {
  const pesos = centavos / 100;
  return pesos >= 1000 ? `₱${thousands.format(pesos / 1000)}k` : formatPeso(centavos);
}

/** The Monthly saving plan stat names this many pots, then counts the rest. */
const PLAN_PARTS = 4;

/**
 * The Monthly saving plan stat's line (savings.md §3): each saving pot's
 * monthly amount, "₱3k + ₱4k + ₱5k", the parts monthlySavingPlan() adds up.
 */
export function savingPlanParts(pots: Planned[], schedule: PaySchedule): string {
  const parts = pots
    .filter((p) => p.planned_contribution > 0)
    .map((p) => shortPeso(Math.round((p.planned_contribution * paydaysPerYear(p, schedule)) / 12)));
  if (parts.length === 0) return "No savings plans yet";
  const rest = parts.length - PLAN_PARTS;
  return rest > 0 ? `${parts.slice(0, PLAN_PARTS).join(" + ")} + ${rest} more` : parts.join(" + ");
}

/** Added this period's line (savings.md §3): this period's unpaid planned deposits. */
export function morePlannedLine(unpaidPlanned: number): string {
  return unpaidPlanned > 0 ? `${formatPeso(unpaidPlanned)} more planned` : "Nothing else planned";
}

const SHORT_WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** "₱3,000 every 15th", "₱2,000 each payday", "₱500 every Fri", or "No savings plan yet". */
export function potScheduleLine(pot: Planned, schedule: PaySchedule): string {
  if (pot.planned_contribution <= 0) return "No savings plan yet";
  const amount = formatPeso(pot.planned_contribution);
  switch (schedule.frequency) {
    case "weekly":
      return `${amount} every ${SHORT_WEEKDAYS[schedule.payWeekday]}`;
    case "monthly":
      return `${amount} every ${ordinal(schedule.payDay1)}`;
    case "semi_monthly":
      if (pot.pay_slot === "every") return `${amount} each payday`;
      return `${amount} every ${ordinal(pot.pay_slot === "payday_1" ? schedule.payDay1 : schedule.payDay2)}`;
  }
}

export type PotStatus =
  | { kind: "locked" }
  | { kind: "no_target" }
  | { kind: "reached" }
  | { kind: "no_plan" }
  | { kind: "behind"; needed: number; by: string }
  | { kind: "on_track"; date: string };

/**
 * A pot card's status tag (savings.md §2): "Locked · deposits only", "On
 * track for May 2027", or "Behind" with what each payday would need to make
 * the target date ("Behind: save ₱4,700 each payday to make it by Dec").
 * Also: reached, no target, and a target with no savings plan.
 */
export function potStatus(
  pot: Planned & { target_amount: number | null; target_date: string | null; is_locked: boolean },
  balance: number,
  schedule: PaySchedule,
  today: string,
): PotStatus {
  if (pot.is_locked) return { kind: "locked" };
  if (pot.target_amount == null) return { kind: "no_target" };
  if (balance >= pot.target_amount) return { kind: "reached" };
  if (pot.planned_contribution <= 0) return { kind: "no_plan" };
  const needed = contributionNeeded(pot, balance, schedule, today);
  if (pot.target_date != null && needed != null && needed > pot.planned_contribution) {
    return { kind: "behind", needed, by: pot.target_date };
  }
  const date = potGoalDate(pot, balance, schedule, today);
  return date ? { kind: "on_track", date } : { kind: "no_plan" };
}

/**
 * Plan savings, over the pot's cap (potAssignCap()): "Only ₱5,000 more fits
 * in Emergency Fund's target.", or at ₱0 that the target is covered. Used by
 * the form before saving and by its Server Action.
 */
export function potCapMessage(name: string, cap: number): string {
  return cap > 0 ? `Only ${formatPeso(cap)} more fits in ${name}'s target.` : `${name}'s target is already covered.`;
}

/** "₱17,000 to go": the target minus the balance, never below ₱0. */
export function potToGo(balance: number, target: number): number {
  return Math.max(target - balance, 0);
}

/** "Total saved" (savings.md §1): the sum of the pots' balances. */
export function totalSaved(balances: number[]): number {
  return balances.reduce((sum, b) => sum + b, 0);
}

export type PotProjection = {
  /** Starting balance plus what was deposited so far. */
  balance: number;
  perMonth: number;
  perYear: number;
  /** The payday the target is reached, or null (no target, no plan, reached). */
  goalDate: string | null;
  /** What each payday would need to make the target date, when the plan falls short. */
  needed: number | null;
  reached: boolean;
};

/**
 * New and Edit pot's projection box (savings.md §4): "At ₱4,000 a month you
 * reach ₱40,000 by Sep 2027." and, when a target date won't be met, "Save
 * ₱2,900 each payday to make it by June." `depositsSoFar` is 0 for a new pot;
 * for an edited one, its balance minus its saved starting balance, so a new
 * "Already saved" amount still counts what was deposited since.
 */
export function potProjection(
  pot: Planned & { target_amount: number | null; target_date: string | null; starting_balance: number },
  depositsSoFar: number,
  schedule: PaySchedule,
  today: string,
): PotProjection {
  const balance = pot.starting_balance + depositsSoFar;
  const perMonth = monthlySavingPlan([pot], schedule);
  const needed = contributionNeeded(pot, balance, schedule, today);
  return {
    balance,
    perMonth,
    perYear: perMonth * 12,
    goalDate: potGoalDate(pot, balance, schedule, today),
    needed: needed != null && needed > pot.planned_contribution ? needed : null,
    reached: pot.target_amount != null && balance >= pot.target_amount,
  };
}

/** Delete pot's "Move it to Emergency" line: the other pot's balance after the move. */
export function balanceAfterMove(destinationBalance: number, moved: number): number {
  return destinationBalance + moved;
}

/**
 * The Savings tab's impact line (activity.md §3 Savings): "Travel will be at
 * ₱8,000 of ₱20,000". `change` is signed (a withdrawal is negative). When
 * editing a row, `replacing` is its saved amount, which the balance already
 * includes.
 */
export function potBalanceAfter(balance: number, change: number, replacing = 0): number {
  return balance - replacing + change;
}

/**
 * Pot to pot (6d-1): both pots' balances before and after moving `amount`
 * from one to the other. Cash on hand doesn't change.
 */
export function potTransfer(
  fromBalance: number,
  toBalance: number,
  amount: number,
): { from: { before: number; after: number }; to: { before: number; after: number } } {
  return {
    from: { before: fromBalance, after: fromBalance - amount },
    to: { before: toBalance, after: toBalance + amount },
  };
}

const wholePercent = new Intl.NumberFormat("en-PH", { style: "percent", maximumFractionDigits: 0 });

/**
 * A Dashboard pot card's bar and line (dashboard.md §2 "Pot card"): how far
 * along its target ("43% of ₱30,000"), "No target" without one (no bar), or
 * for a locked pot a full bar and "Locked savings".
 */
export function potCardLine(
  balance: number,
  target: number | null,
  locked: boolean,
): { share: number | null; text: string; locked: boolean } {
  if (locked) return { share: 1, text: "Locked savings", locked };
  const share = potProgress(balance, target);
  if (share == null || target == null) return { share: null, text: "No target", locked };
  return { share, text: `${wholePercent.format(share)} of ${formatPeso(target)}`, locked };
}

/**
 * A pot's line on the desktop Dashboard (dashboard.md §3): "+₱3,000 this
 * period" for the net moved in (or out) this period; before anything has
 * moved, "₱2,000 planned this period" from its unpaid planned items; else none.
 */
export function potPeriodLine(moved: number, plannedUnpaid: number): string | null {
  if (moved !== 0) return `${formatPeso(moved, { signed: true })} this period`;
  if (plannedUnpaid > 0) return `${formatPeso(plannedUnpaid)} planned this period`;
  return null;
}
