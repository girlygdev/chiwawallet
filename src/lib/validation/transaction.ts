import { format, isValid, parseISO } from "date-fns";
import { z } from "zod";
import { parsePesoInput } from "@/lib/money";

// The add and edit transaction sheet (activity.md §3) and its Server Actions.
// The amount arrives as typed text and leaves as integer centavos.
// Expense and income only for now: savings (Add or Withdraw, with a pot) and
// debt payments join in Weeks 4-5 with their links.

export const SHEET_TYPES = ["expense", "income"] as const;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** "2026-02-30" passes the pattern but isn't a real day; date-fns catches it. */
function isRealDate(text: string) {
  return ISO_DATE.test(text) && isValid(parseISO(text)) && format(parseISO(text), "yyyy-MM-dd") === text;
}

/**
 * `today` and `firstPeriodStart` are "YYYY-MM-DD" in Manila time, passed in so
 * the schema stays pure: no future dates, and nothing before the first period
 * (week-3-tasks.md 3c).
 */
export function transactionSchemaFor({ today, firstPeriodStart }: { today: string; firstPeriodStart: string }) {
  return z
    .object({
      type: z.enum(SHEET_TYPES),
      amount: z
        .string()
        .transform((text, ctx) => {
          const centavos = parsePesoInput(text);
          if (centavos == null) {
            ctx.addIssue({ code: "custom", message: "Enter an amount, like 180." });
            return z.NEVER;
          }
          return centavos;
        })
        .refine((centavos) => centavos > 0, "Enter an amount above ₱0."),
      categoryId: z.uuid("Pick a category."),
      // <input type="date"> gives "YYYY-MM-DD", or "" when empty.
      date: z
        .string()
        // abort: a date that isn't real stops here, so it gets one message.
        .refine(isRealDate, { message: "Pick a valid date.", abort: true })
        // ISO dates compare correctly as plain strings.
        .refine((d) => d <= today, "Pick today or an earlier day.")
        .refine(
          (d) => d >= firstPeriodStart,
          `Pick ${format(parseISO(firstPeriodStart), "MMM d")} or later, when your first period starts.`,
        ),
      note: z
        .string()
        .trim()
        .max(100, "Keep the note to 100 characters or fewer.")
        .optional()
        .transform((n) => (n ? n : null)),
      // Empty for one-time income.
      incomeSourceId: z
        .union([z.uuid(), z.literal("")])
        .optional()
        .transform((id) => (id ? id : null)),
    })
    .superRefine((v, ctx) => {
      if (v.incomeSourceId != null && v.type !== "income") {
        ctx.addIssue({ code: "custom", path: ["incomeSourceId"], message: "Only income can come from a source." });
      }
    });
}

/** What the sheet holds: the amount is still text. */
export type TransactionFormInput = z.input<ReturnType<typeof transactionSchemaFor>>;
/** What the Server Action saves: the amount in centavos. */
export type TransactionValues = z.output<ReturnType<typeof transactionSchemaFor>>;
