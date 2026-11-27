import { formatPeso } from "@/lib/money";
import type { PaySchedule } from "@/lib/periods";
import { cardNextDue, payingPeriodStart } from "@/lib/plan";

// Credit cards (Week 8 task 8b): pure helpers for the Debts page and the
// card form. A card's balance itself is cardBalance() in lib/debts.ts. Kept
// apart from lib/debts.ts because they need lib/plan.ts, which imports it.

export type CardTerms = { due_day: number; pay_slot: string };

/**
 * The card's next payment: this month's due day if it hasn't passed (today
 * counts), otherwise next month's. A day the month doesn't have becomes its
 * last day (the 31st in February → Feb 28). `payday` is the start of the
 * period that pays it, by the same rule as bills (payingPeriodStart()): the
 * card's payday on or before the due date. Due Dec 5 from the 30th → Nov 30.
 */
export function cardNextPayment(card: CardTerms, today: string, schedule: PaySchedule): { due: string; payday: string } {
  const due = cardNextDue(card.due_day, today);
  return { due, payday: payingPeriodStart(due, card.pay_slot, schedule) };
}

/**
 * What was bought with the card (its expenses), optionally within a period:
 * "₱3,200 charged this period". Payments to it and deleted rows don't count.
 */
export function cardCharged(
  rows: { type: string; amount: number; card_id: string | null; date: string; deleted_at: string | null }[],
  cardId: string,
  period?: { start: string; end: string },
): number {
  return rows.reduce((sum, r) => {
    if (r.deleted_at != null || r.type !== "expense" || r.card_id !== cardId) return sum;
    if (period && (r.date < period.start || r.date > period.end)) return sum;
    return sum + r.amount;
  }, 0);
}

/** The card's balance in words: "₱8,400 owed", or "₱200 credit" once more was paid than owed. */
export function cardOwedText(balance: number): string {
  return balance >= 0 ? `${formatPeso(balance)} owed` : `${formatPeso(-balance)} credit`;
}

/**
 * The add sheet's line for a purchase on a card (8b-3): "BPI card: ₱8,400 →
 * ₱9,600 owed. Your cash stays the same." `balance` is the card's balance now
 * (cardBalance()); `replaced` is the old amount when editing a purchase
 * that's already on this card, so only the change counts.
 */
export function cardImpactLine({
  name,
  balance,
  amount,
  replaced = 0,
}: {
  name: string;
  balance: number;
  amount: number;
  replaced?: number;
}): string {
  const after = balance - replaced + amount;
  // "₱8,400 → ₱9,600 owed" when both are owed; spelled out when either is a credit.
  const change =
    balance >= 0 && after >= 0
      ? `${formatPeso(balance)} → ${cardOwedText(after)}`
      : `${cardOwedText(balance)} → ${cardOwedText(after)}`;
  return `${name}: ${change}. Your cash stays the same.`;
}
