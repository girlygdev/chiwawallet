import { z } from "zod";
import { parsePesoInput } from "@/lib/money";

// An income source (onboarding step 2 now, the Income screen in 2e). Shared by
// the form and its Server Actions. The amount arrives as typed text and leaves
// as integer centavos, so the browser and server parse it the same way.

export const PAY_SLOTS = ["payday_1", "payday_2", "every"] as const;

/**
 * The rules depend on the budget: only twice-a-month budgets have a payday 1
 * and payday 2 (checked here, not in the database, decided Nov 19).
 */
export function incomeSchemaFor(frequency: string) {
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
    })
    .refine((v) => frequency === "semi_monthly" || v.paySlot === "every", {
      path: ["paySlot"],
      message: "This budget has one payday, so income lands on every payday.",
    });
}

/** What the form holds: the amount is still text. */
export type IncomeFormInput = z.input<ReturnType<typeof incomeSchemaFor>>;
/** What the Server Action saves: the amount in centavos. */
export type IncomeValues = z.output<ReturnType<typeof incomeSchemaFor>>;
