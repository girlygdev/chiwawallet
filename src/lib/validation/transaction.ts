import { format, isValid, parseISO } from "date-fns";
import { z } from "zod";
import { parsePesoInput } from "@/lib/money";

// The add and edit transaction sheet (activity.md §3) and its Server Actions.
// The amount arrives as typed text and leaves as integer centavos.
// Expense, income and savings (Add or Withdraw, with a pot; 4e). Debt
// payments join in Week 5 with plan items.

export const SHEET_TYPES = ["expense", "income"] as const;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** "2026-02-30" passes the pattern but isn't a real day; date-fns catches it. */
function isRealDate(text: string) {
  return ISO_DATE.test(text) && isValid(parseISO(text)) && format(parseISO(text), "yyyy-MM-dd") === text;
}

type DateLimits = { today: string; firstPeriodStart: string };

/** The amount as typed ("₱1,240.50") → centavos above 0. */
const amountField = () =>
  z
    .string()
    .transform((text, ctx) => {
      const centavos = parsePesoInput(text);
      if (centavos == null) {
        ctx.addIssue({ code: "custom", message: "Enter an amount, like 180." });
        return z.NEVER;
      }
      return centavos;
    })
    .refine((centavos) => centavos > 0, "Enter an amount above ₱0.");

/** A real day, not in the future, and not before the first period. */
const dateField = ({ today, firstPeriodStart }: DateLimits) =>
  // <input type="date"> gives "YYYY-MM-DD", or "" when empty.
  z
    .string()
    // abort: a date that isn't real stops here, so it gets one message.
    .refine(isRealDate, { message: "Pick a valid date.", abort: true })
    // ISO dates compare correctly as plain strings.
    .refine((d) => d <= today, "Pick today or an earlier day.")
    .refine(
      (d) => d >= firstPeriodStart,
      `Pick ${format(parseISO(firstPeriodStart), "MMM d")} or later, when your first period starts.`,
    );

/**
 * `today` and `firstPeriodStart` are "YYYY-MM-DD" in Manila time, passed in so
 * the schema stays pure: no future dates, and nothing before the first period
 * (week-3-tasks.md 3c).
 */
export function transactionSchemaFor(limits: DateLimits) {
  return z
    .object({
      type: z.enum(SHEET_TYPES),
      amount: amountField(),
      categoryId: z.uuid("Pick a category."),
      date: dateField(limits),
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

/** The Income tab's "One-time income" choice (no source). */
export const ONE_TIME = "one-time";

/**
 * The Income tab (activity.md §3 Income): pay from one of the user's
 * sources, or one-time income whose name is saved as the note. The category
 * isn't here: income always uses the locked Income category, set on the server.
 */
export function incomeSchemaFor(limits: DateLimits) {
  return z
    .object({
      amount: amountField(),
      // A source's id, or ONE_TIME.
      source: z.string().refine((s) => s === ONE_TIME || z.uuid().safeParse(s).success, "Pick where it's from."),
      name: z.string().trim().max(100, "Keep the name to 100 characters or fewer.").optional(),
      date: dateField(limits),
    })
    .superRefine((v, ctx) => {
      if (v.source === ONE_TIME && !v.name) {
        ctx.addIssue({ code: "custom", path: ["name"], message: "Name it, like 13th month pay." });
      }
    })
    .transform(({ amount, source, name, date }) => ({
      amount,
      incomeSourceId: source === ONE_TIME ? null : source,
      // A source's pay has no note; its name shows instead.
      note: source === ONE_TIME ? name! : null,
      date,
    }));
}

export type IncomeFormInput = z.input<ReturnType<typeof incomeSchemaFor>>;
export type IncomeValues = z.output<ReturnType<typeof incomeSchemaFor>>;

export const SAVINGS_DIRECTIONS = ["add", "withdraw"] as const;

/**
 * The Savings tab (activity.md §3 Savings, week-4-tasks.md 4e): add to or
 * withdraw from a pot. The amount is typed above zero and saved signed: a
 * withdrawal is a negative savings amount (plan review 3.5). The category
 * isn't here: savings always use the locked Savings pot category, set on the
 * server. Locked pots and the pot's balance are checked on the server.
 */
export function savingsSchemaFor(limits: DateLimits) {
  return z
    .object({
      direction: z.enum(SAVINGS_DIRECTIONS, { error: "Pick Add to pot or Withdraw." }),
      amount: amountField(),
      potId: z.uuid("Pick a pot."),
      date: dateField(limits),
    })
    .transform((v) => ({ ...v, amount: v.direction === "withdraw" ? -v.amount : v.amount }));
}

export type SavingsFormInput = z.input<ReturnType<typeof savingsSchemaFor>>;
export type SavingsValues = z.output<ReturnType<typeof savingsSchemaFor>>;
