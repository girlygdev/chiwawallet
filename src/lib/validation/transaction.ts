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
      // "Paid with" (8b-3): a credit card's id, or empty for cash. Whether
      // it's the user's own open card is checked on the server.
      cardId: z
        .union([z.uuid("Pick Cash or one of your cards."), z.literal("")])
        .optional()
        .transform((id) => (id ? id : null)),
    })
    .superRefine((v, ctx) => {
      if (v.cardId != null && v.type !== "expense") {
        ctx.addIssue({ code: "custom", path: ["cardId"], message: "Only an expense can be paid with a card." });
      }
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

/** To a pot, From a pot, Pot to pot (6d-1) and To a debt (6d-2): the Transfer tab. */
export const SAVINGS_DIRECTIONS = ["add", "withdraw", "move", "debt"] as const;

/**
 * The Transfer tab (activity.md §3, "Changed Nov 24"; 4e, 6d-1): to a pot,
 * from a pot, or pot to pot. The amount is typed above zero. A deposit is
 * saved positive and a withdrawal negative (plan review 3.5); a move keeps
 * the amount positive, and the Server Action saves it as a withdrawal from
 * `potId` and a deposit to `toPotId`. To a debt (6d-2) has `debtId` instead
 * of a pot, and its amount stays positive. The categories aren't here:
 * they're the locked system ones, set on the server. Locked pots, balances
 * and what's left on a debt are checked on the server.
 */
export function savingsSchemaFor(limits: DateLimits) {
  return z
    .object({
      direction: z.enum(SAVINGS_DIRECTIONS, { error: "Pick To a pot, From a pot, Pot to pot or To a debt." }),
      amount: amountField(),
      /** Every direction but To a debt. */
      potId: z.string(),
      /** Pot to pot only; ignored otherwise. */
      toPotId: z.string().optional(),
      /** To a debt only; ignored otherwise. */
      debtId: z.string().optional(),
      date: dateField(limits),
    })
    .superRefine((v, ctx) => {
      if (v.direction === "debt") {
        if (!v.debtId || !z.uuid().safeParse(v.debtId).success) {
          ctx.addIssue({ code: "custom", path: ["debtId"], message: "Pick a debt." });
        }
        return;
      }
      if (!z.uuid().safeParse(v.potId).success) ctx.addIssue({ code: "custom", path: ["potId"], message: "Pick a pot." });
      if (v.direction !== "move") return;
      if (!v.toPotId || !z.uuid().safeParse(v.toPotId).success) {
        ctx.addIssue({ code: "custom", path: ["toPotId"], message: "Pick the pot to move it to." });
      } else if (v.toPotId === v.potId) {
        ctx.addIssue({ code: "custom", path: ["toPotId"], message: "Pick a different pot to move it to." });
      }
    })
    .transform((v) => ({
      ...v,
      amount: v.direction === "withdraw" ? -v.amount : v.amount,
      toPotId: v.direction === "move" ? v.toPotId! : null,
      debtId: v.direction === "debt" ? v.debtId! : null,
    }));
}

export type SavingsFormInput = z.input<ReturnType<typeof savingsSchemaFor>>;
export type SavingsValues = z.output<ReturnType<typeof savingsSchemaFor>>;
