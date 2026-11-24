import { z } from "zod";
import { formatPeso, parsePesoInput } from "@/lib/money";

// New and Edit debt (debts.md §4). Shared by the form and its Server Actions.
// Money arrives as typed text and leaves as integer centavos.

export const PAYMENT_TYPES = ["installments", "one_time"] as const;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
// 0 to 100 with up to two decimals, like the database's numeric(5, 2).
const RATE = /^\d{1,3}(\.\d{1,2})?$/;
const RATE_MESSAGE = "Enter a rate from 0 to 100, like 3.5.";

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

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
    firstDueDate: z.string().regex(ISO_DATE, "Pick the first due date."),
    interestRate: z.string().trim(),
  })
  .superRefine((v, ctx) => {
    const issue = (path: string, message: string) => ctx.addIssue({ code: "custom", path: [path], message });

    if (v.interestRate !== "" && !(RATE.test(v.interestRate) && Number(v.interestRate) <= 100)) {
      issue("interestRate", RATE_MESSAGE);
    }
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
    if (payment * n < v.total) {
      issue(
        "payment",
        `${plural(n, "payment")} of ${formatPeso(payment)} only cover ${formatPeso(payment * n)} of ${formatPeso(v.total)}.`,
      );
    } else if (payment * (n - 1) >= v.total) {
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
    return {
      name: v.name,
      lender: v.lender === "" ? null : v.lender,
      total: v.total,
      paymentType: v.paymentType,
      // A one-time debt is one payment of the whole amount (the database checks it).
      numPayments: oneTime ? 1 : v.numPayments,
      payment: oneTime ? v.total : parsePesoInput(v.payment)!,
      firstDueDate: v.firstDueDate,
      interestRate: v.interestRate === "" ? null : Number(v.interestRate),
    };
  });

export type DebtFormInput = z.input<typeof debtSchema>;
export type DebtValues = z.output<typeof debtSchema>;

/**
 * "Each payment" fills in total ÷ number of payments (debts.md §4), rounded up
 * to the peso so the payments cover the total. Still editable.
 */
export function suggestedPayment(total: number, numPayments: number): number {
  return Math.ceil(total / (numPayments * 100)) * 100;
}
