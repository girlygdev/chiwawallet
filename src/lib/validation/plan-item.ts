import { format, isValid, parseISO } from "date-fns";
import { z } from "zod";
import { parsePesoInput } from "@/lib/money";

// Plan items: Add one-off item (plan.md §6, task 5f) and Edit item (5e).
// Shared by the forms and their Server Actions. The amount arrives as typed
// text and leaves as integer centavos, so browser and server parse it alike.

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** "2026-02-30" passes the pattern but isn't a real day; date-fns catches it. */
function isRealDate(text: string) {
  return ISO_DATE.test(text) && isValid(parseISO(text)) && format(parseISO(text), "yyyy-MM-dd") === text;
}

const nameField = (emptyMessage: string) =>
  z.string().trim().min(1, emptyMessage).max(40, "Keep it to 40 characters or fewer.");

/** The amount as typed ("₱2,500.50") → centavos above 0. */
const amountField = z
  .string()
  .transform((text, ctx) => {
    const centavos = parsePesoInput(text);
    if (centavos == null) {
      ctx.addIssue({ code: "custom", message: "Enter an amount, like 2,500." });
      return z.NEVER;
    }
    return centavos;
  })
  .refine((centavos) => centavos > 0, "Enter an amount above ₱0.");

/** Optional: <input type="date"> gives "" when empty, which becomes null. */
const neededByField = z
  .string()
  .optional()
  .transform((text) => (text ? text : null))
  .refine((d) => d == null || isRealDate(d), "Pick a valid date.");

export const oneOffItemSchema = z.object({
  name: nameField("Say what it's for, like Dad's birthday gift."),
  amount: amountField,
  neededBy: neededByField,
  // The chosen payday's period, by its start date. The Server Action checks
  // it's one of the periods the sheet offered.
  periodStart: z.string().refine(isRealDate, "Pick which payday pays for it."),
  categoryId: z.uuid("Pick a category."),
});

export type OneOffItemInput = z.input<typeof oneOffItemSchema>;
export type OneOffItem = z.output<typeof oneOffItemSchema>;

/** Edit item: name and amount, and Needed by for one-offs (Nov 25: items have no note). */
export const editPlanItemSchema = z.object({
  name: nameField("Give it a name."),
  amount: amountField,
  neededBy: neededByField,
});

export type EditPlanItemInput = z.input<typeof editPlanItemSchema>;
export type EditPlanItem = z.output<typeof editPlanItemSchema>;

/**
 * Set a budget (plan.md fix #2, 5g-1): a spending category's budget in the
 * period being viewed. "every" also saves it as the category's budget per
 * payday; "period" changes this period only.
 */
export const setBudgetSchema = z.object({
  categoryId: z.uuid("Pick a category."),
  amount: amountField,
  scope: z.enum(["every", "period"], { error: "Pick how often." }),
});

export type SetBudgetInput = z.input<typeof setBudgetSchema>;
export type SetBudget = z.output<typeof setBudgetSchema>;

/**
 * Plan a debt payment (5g-2): an extra amount on one of the user's active
 * debts, paid from the chosen payday. The Server Action checks it's no more
 * than what's left on the debt.
 */
export const debtPaymentSchema = z.object({
  debtId: z.uuid("Pick a debt."),
  amount: amountField,
  periodStart: z.string().refine(isRealDate, "Pick which payday pays for it."),
});

export type DebtPaymentInput = z.input<typeof debtPaymentSchema>;
export type DebtPayment = z.output<typeof debtPaymentSchema>;

/**
 * Give leftover a job (6f): the period, and the amount for each pot and
 * debt above ₱0 (centavos; the page's steppers work in centavos). The buffer
 * isn't sent: it saves nothing. The Server Action checks the total and caps.
 */
export const assignSchema = z.object({
  periodStart: z.string().refine(isRealDate, "Pick a period."),
  allocations: z
    .array(
      z.object({
        kind: z.enum(["pot", "debt"]),
        id: z.uuid(),
        amount: z.number().int().positive(),
      }),
    )
    .min(1, "Give some of it a job first.")
    .max(50)
    .refine((list) => new Set(list.map((a) => `${a.kind}:${a.id}`)).size === list.length, "Each place once."),
});

export type AssignInput = z.input<typeof assignSchema>;
