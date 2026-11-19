import { z } from "zod";
import { parsePesoInput } from "@/lib/money";

// An income source: onboarding step 2 and the Income screen. Shared by the
// form and its Server Actions. The amount arrives as typed text and leaves as
// integer centavos, so the browser and server parse it the same way.

export const PAY_SLOTS = ["payday_1", "payday_2", "every"] as const;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const START_MESSAGE = "Pick when this income starts.";

/**
 * The rules depend on the budget: only twice-a-month budgets have a payday 1
 * and payday 2 (checked here, not in the database, decided Nov 19).
 * `requireStartDate`: the Income screen asks for "Starts". Onboarding doesn't;
 * it uses the current period's start (plan review 3.3).
 */
export function incomeSchemaFor(frequency: string, { requireStartDate = false } = {}) {
  return z
    .object({
      name: z
        .string()
        .trim()
        .min(1, "Name this income, like Main job.")
        .max(40, "Keep it to 40 characters or fewer."),
      amount: z
        .string()
        .transform((text, ctx) => {
          const centavos = parsePesoInput(text);
          if (centavos == null) {
            ctx.addIssue({ code: "custom", message: "Enter an amount, like 25,000." });
            return z.NEVER;
          }
          return centavos;
        })
        // Above zero even when it varies: it's the typical amount used for
        // planning (decided Nov 19).
        .refine((centavos) => centavos > 0, "Enter an amount above ₱0."),
      amountVaries: z.boolean(),
      paySlot: z.enum(PAY_SLOTS, { error: "Pick the payday it lands on." }),
      // <input type="date"> gives "YYYY-MM-DD", or "" when empty.
      startDate: z.string().optional(),
      endDate: z
        .string()
        .optional()
        .transform((d) => (d ? d : null)),
    })
    .superRefine((v, ctx) => {
      if (frequency !== "semi_monthly" && v.paySlot !== "every") {
        ctx.addIssue({
          code: "custom",
          path: ["paySlot"],
          message: "This budget has one payday, so income lands on every payday.",
        });
      }
      const hasStart = v.startDate != null && v.startDate !== "";
      if ((requireStartDate || hasStart) && !(hasStart && ISO_DATE.test(v.startDate!))) {
        ctx.addIssue({ code: "custom", path: ["startDate"], message: START_MESSAGE });
      }
      if (v.endDate != null && !ISO_DATE.test(v.endDate)) {
        ctx.addIssue({ code: "custom", path: ["endDate"], message: "Pick a valid end date." });
      } else if (v.endDate != null && hasStart && v.endDate < v.startDate!) {
        // ISO dates compare correctly as plain strings.
        ctx.addIssue({ code: "custom", path: ["endDate"], message: "Pick an end date on or after the start." });
      }
    });
}

/** What the form holds: the amount is still text. */
export type IncomeFormInput = z.input<ReturnType<typeof incomeSchemaFor>>;
/** What the Server Action saves: the amount in centavos. */
export type IncomeValues = z.output<ReturnType<typeof incomeSchemaFor>>;
