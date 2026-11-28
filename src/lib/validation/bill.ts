import { z } from "zod";
import { parsePesoInput } from "@/lib/money";

// New and Edit bill (bills.md §4). Shared by the form and its Server Actions.
// The amount arrives as typed text and leaves as integer centavos, so the
// browser and the server parse it the same way.

export const BILL_FREQUENCIES = ["monthly", "quarterly", "yearly"] as const;
export const BILL_PAY_SLOTS = ["payday_1", "payday_2", "split", "every"] as const;

const PAY_SLOT_MESSAGE = "Pick which payday pays it.";
const MONTH_MESSAGE = "Pick the month it's first due.";

/**
 * The rules depend on the budget, like income sources: twice-a-month budgets
 * pick payday 1, payday 2 or split; weekly and monthly budgets have one
 * payday, so it's always `every` (owner, Nov 24) and the form hides it.
 */
export function billSchemaFor(budgetFrequency: string) {
  const onePayday = budgetFrequency !== "semi_monthly";
  return z
    .object({
      name: z.string().trim().min(1, "Name this bill, like Meralco.").max(40, "Keep it to 40 characters or fewer."),
      amount: z
        .string()
        .transform((text, ctx) => {
          const centavos = parsePesoInput(text);
          if (centavos == null) {
            ctx.addIssue({ code: "custom", message: "Enter an amount, like 2,500." });
            return z.NEVER;
          }
          return centavos;
        })
        // Above zero even when it varies: it's the typical amount for planning.
        .refine((centavos) => centavos > 0, "Enter an amount above ₱0."),
      amountVaries: z.boolean(),
      categoryId: z.uuid("Pick a category."),
      frequency: z.enum(BILL_FREQUENCIES, { error: "Pick how often it's due." }),
      dueDay: z.number({ error: "Pick the day it's due." }).int("Pick the day it's due.").min(1, "Pick the day it's due.").max(31, "Pick the day it's due."),
      // Checked below: needed for quarterly and yearly only.
      firstDueMonth: z.number().nullable().optional(),
      paySlot: z.enum(BILL_PAY_SLOTS, { error: PAY_SLOT_MESSAGE }),
      remind: z.boolean(),
      // "Paid with" (Nov 28): a credit card's id, or empty for Cash. Whether
      // it's the user's own open card is checked on the server (and by the
      // database).
      cardId: z
        .union([z.uuid("Pick Cash or one of your cards."), z.literal("")])
        .optional()
        .transform((id) => (id ? id : null)),
    })
    .superRefine((v, ctx) => {
      const m = v.firstDueMonth;
      if (v.frequency !== "monthly" && !(m != null && Number.isInteger(m) && m >= 1 && m <= 12)) {
        ctx.addIssue({ code: "custom", path: ["firstDueMonth"], message: MONTH_MESSAGE });
      }
      if (onePayday && v.paySlot !== "every") {
        ctx.addIssue({ code: "custom", path: ["paySlot"], message: "This budget has one payday, so that payday pays it." });
      }
      if (!onePayday && v.paySlot === "every") {
        // "every" on a twice-a-month budget would pay the whole bill twice.
        ctx.addIssue({ code: "custom", path: ["paySlot"], message: PAY_SLOT_MESSAGE });
      }
    })
    // Monthly bills have no first month (the database requires it empty).
    .transform((v) => ({ ...v, firstDueMonth: v.frequency === "monthly" ? null : (v.firstDueMonth ?? null) }));
}

/** What the form holds: the amount is still text. */
export type BillFormInput = z.input<ReturnType<typeof billSchemaFor>>;
/** What the Server Action saves: the amount in centavos. */
export type BillValues = z.output<ReturnType<typeof billSchemaFor>>;
