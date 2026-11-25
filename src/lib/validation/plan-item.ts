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
