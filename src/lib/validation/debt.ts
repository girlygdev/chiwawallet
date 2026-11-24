import { z } from "zod";
import { formatPeso, parsePesoInput } from "@/lib/money";

// New and Edit debt (debts.md §4). Shared by the form and its Server Actions.
// Money arrives as typed text and leaves as integer centavos.

/** "flexible" is "When I can" (owner, Nov 24): no schedule, pay whenever there's extra. */
export const PAYMENT_TYPES = ["installments", "one_time", "flexible"] as const;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;
// 0 to 100 with up to two decimals, like the database's numeric(5, 2).
const RATE = /^\d{1,3}(\.\d{1,2})?$/;
const RATE_MESSAGE = "Enter a rate from 0 to 100, like 3.5.";

export const debtSchema = z
  .object({
    name: z.string().trim().min(1, "Name this debt, like Credit card.").max(40, "Keep it to 40 characters or fewer."),
    lender: z.string().trim().max(40, "Keep it to 40 characters or fewer."),
    total: z
      .string()
      .transform((text, ctx) => {
        const centavos = parsePesoInput(text);
        if (centavos == null) {
          ctx.addIssue({ code: "custom", message: "Enter an amount, like 12,000." });
          return z.NEVER;
        }
        return centavos;
      })
      .refine((centavos) => centavos > 0, "Enter an amount above ₱0."),
    paymentType: z.enum(PAYMENT_TYPES, { error: "Pick how you'll pay it." }),
    // Installments only; checked below.
    numPayments: z.number(),
    // Installments only, as typed; checked below.
    payment: z.string(),
    // Installments and one payment; checked below ("" for flexible).
    firstDueDate: z.string(),
    interestRate: z.string().trim(),
    // Flexible only: "Aim to pay off by" as "YYYY-MM", or "" (optional).
    targetMonth: z.string().optional().default(""),
  })
  .superRefine((v, ctx) => {
    const issue = (path: string, message: string) => ctx.addIssue({ code: "custom", path: [path], message });

    if (v.interestRate !== "" && !(RATE.test(v.interestRate) && Number(v.interestRate) <= 100)) {
      issue("interestRate", RATE_MESSAGE);
    }
    if (v.paymentType === "flexible") {
      if (v.targetMonth !== "" && !MONTH.test(v.targetMonth)) issue("targetMonth", "Pick a month.");
      return;
    }
    if (!ISO_DATE.test(v.firstDueDate)) issue("firstDueDate", "Pick the first due date.");
    if (v.paymentType !== "installments") return;

    const n = v.numPayments;
    const validCount = Number.isInteger(n) && n >= 2 && n <= 60;
    if (!validCount) issue("numPayments", "Pick 2 to 60 payments.");

    const payment = parsePesoInput(v.payment);
    if (payment == null) return issue("payment", "Enter an amount, like 4,000.");
    if (payment <= 0) return issue("payment", "Enter an amount above ₱0.");
    if (!validCount) return;

    // The payments must cover the total, and the last one must be above ₱0:
    // the schedule makes the last payment whatever is left (lib/debts.ts).
    // Payments that don't add up to the total are fine: the last one takes
    // the difference, and the form says so in yellow (debts.md §4 "Check",
    // lastPaymentNote()). Only a last payment of ₱0 or less is refused.
    if (payment * (n - 1) >= v.total) {
      const needed = Math.ceil(v.total / payment);
      issue(
        "payment",
        needed === 1
          ? `One payment of ${formatPeso(payment)} pays off ${formatPeso(v.total)}. Choose One payment.`
          : `${formatPeso(v.total)} is paid off after ${needed} payments of ${formatPeso(payment)}. Use ${needed} payments.`,
      );
    }
  })
  .transform((v) => {
    const oneTime = v.paymentType === "one_time";
    const flexible = v.paymentType === "flexible";
    return {
      name: v.name,
      lender: v.lender === "" ? null : v.lender,
      total: v.total,
      paymentType: v.paymentType,
      // One payment is the whole amount; a flexible debt has no schedule at
      // all (the database checks each type's fields).
      numPayments: flexible ? null : oneTime ? 1 : v.numPayments,
      payment: flexible ? null : oneTime ? v.total : parsePesoInput(v.payment)!,
      firstDueDate: flexible ? null : v.firstDueDate,
      interestRate: v.interestRate === "" ? null : Number(v.interestRate),
      // Stored as the 1st of the month; flexible debts only.
      targetDate: flexible && v.targetMonth !== "" ? `${v.targetMonth}-01` : null,
    };
  });

export type DebtFormInput = z.input<typeof debtSchema>;
export type DebtValues = z.output<typeof debtSchema>;

/**
 * New debt's yellow check line (debts.md §4), when the payments don't add up
 * to the total: "Payments add up to ₱14,000, ₱1,000 less than the total. The
 * last payment will be ₱6,000." Null when they match (or for one payment).
 */
export function lastPaymentNote(total: number, numPayments: number, payment: number): string | null {
  const sum = payment * numPayments;
  if (numPayments < 2 || sum === total) return null;
  const difference = Math.abs(total - sum);
  const last = total - payment * (numPayments - 1);
  return `Payments add up to ${formatPeso(sum)}, ${formatPeso(difference)} ${sum < total ? "less" : "more"} than the total. The last payment will be ${formatPeso(last)}.`;
}

/**
 * "Each payment" fills in total ÷ number of payments (debts.md §4), rounded up
 * to the peso so the payments cover the total. Still editable.
 */
export function suggestedPayment(total: number, numPayments: number): number {
  return Math.ceil(total / (numPayments * 100)) * 100;
}
