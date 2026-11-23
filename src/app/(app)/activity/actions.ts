"use server";

import { getOrCreatePeriod } from "@/lib/budget-periods";
import { isActiveOn, receivedSourceIds, sourcePayday } from "@/lib/income";
import { type PaySchedule, type PaySlot, scheduleFromBudget, todayInManila } from "@/lib/periods";
import { requireAppUser } from "@/lib/require-app-user";
import { createClient } from "@/lib/supabase/server";
import {
  type BudgetGroup,
  type CategoryChoice,
  recentCategories,
  topCategories,
  type TransactionRow,
} from "@/lib/transactions";
import { SOMETHING_WRONG, toFieldErrors } from "@/lib/validation/field-errors";
import {
  type IncomeFormInput,
  incomeSchemaFor,
  type TransactionFormInput,
  transactionSchemaFor,
} from "@/lib/validation/transaction";

// The add sheet's Expense and Income tabs (activity.md §3, week-3-tasks.md 3c
// and 3d). RLS limits every query to the user's own rows; the checks here are
// for clear messages and for rules the database can't know (system categories
// aren't offered, and income always uses the Income one).

/** How many of the user's latest expenses decide "most used" (owner, Nov 23). */
const RECENT_EXPENSES = 200;
/** Tiles shown before More. */
const TOP_TILES = 5;
/** The picker's RECENT row (activity.md §4). */
const RECENT_TILES = 4;

export type SheetCategory = CategoryChoice & { icon: string; color: string };

/** A source card on the Income tab. */
export type SheetSource = {
  id: string;
  name: string;
  /** Expected each payday, in centavos; picking the card fills it in. */
  amount: number;
  /** This period's payday, or the next one it pays on; null if none ahead. */
  payday: { date: string; thisPeriod: boolean } | null;
  /** Already logged this period (or counted by onboarding, plan review 3.14). */
  received: boolean;
};

export type AddSheetData = {
  /** Manila "YYYY-MM-DD", the latest date allowed. */
  today: string;
  /** The first period's first day, the earliest date allowed. */
  firstPeriodStart: string;
  schedule: PaySchedule;
  currentPeriod: { start: string; end: string };
  /** This period's live rows, for the impact line. */
  periodRows: Pick<TransactionRow, "type" | "amount" | "deleted_at">[];
  /** The Income tab's cards: sources paying today, oldest first. */
  sources: SheetSource[];
  /** Every offerable category, best first; the grid shows the first five. */
  categories: SheetCategory[];
  topCount: number;
  /** The picker's RECENT row, newest first. */
  recentIds: string[];
  /** The budget's 50/30/20 percentages, for the picker's section headings. */
  targets: Record<BudgetGroup, number>;
};

/** Everything the sheet needs, for both tabs; called when it opens. */
export async function getAddSheetData(): Promise<AddSheetData> {
  const { budget } = await requireAppUser();
  const supabase = await createClient();
  const today = todayInManila(new Date());
  const period = await getOrCreatePeriod(supabase, budget, today);

  const [categories, recent, rows, sources, first] = await Promise.all([
    supabase.from("categories").select("id, name, kind, budget_group, system_key, icon, color"),
    supabase
      .from("transactions")
      .select("category_id")
      .eq("type", "expense")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(RECENT_EXPENSES),
    supabase
      .from("transactions")
      .select("type, amount, deleted_at, income_source_id")
      .eq("period_id", period.id)
      .is("deleted_at", null),
    supabase
      .from("income_sources")
      .select("id, name, amount, pay_slot, start_date, end_date")
      .eq("budget_id", budget.id)
      .order("created_at", { ascending: true }),
    firstPeriodStart(budget.id),
  ]);
  for (const result of [categories, recent, rows, sources]) {
    if (result.error) throw new Error(`Couldn't load the add sheet: ${result.error.message}`, { cause: result.error });
  }

  // Newest first: the query orders by created_at.
  const latestIds = recent.data!.map((r) => r.category_id);
  const schedule = scheduleFromBudget(budget);
  const received = receivedSourceIds(
    rows.data!,
    // The column's check constraint allows only the three pay slots.
    { start: period.start_date, paySlot: period.pay_slot as PaySlot, first_pay_received: period.first_pay_received },
    sources.data!,
    schedule,
  );

  return {
    today,
    firstPeriodStart: first ?? period.start_date,
    schedule,
    currentPeriod: { start: period.start_date, end: period.end_date },
    // The generated types say `string`; the column's check constraint allows
    // only the four transaction types.
    periodRows: rows.data! as AddSheetData["periodRows"],
    sources: sources
      .data!.filter((s) => isActiveOn(s, today))
      .map((s) => ({
        id: s.id,
        name: s.name,
        amount: s.amount,
        payday: sourcePayday(s, schedule, today),
        received: received.has(s.id),
      })),
    categories: topCategories(categories.data!, latestIds, Infinity),
    topCount: TOP_TILES,
    recentIds: recentCategories(categories.data!, latestIds, RECENT_TILES).map((c) => c.id),
    targets: { needs: budget.needs_pct, wants: budget.wants_pct, savings_debt: budget.savings_debt_pct },
  };
}

export type SaveExpenseResult = {
  ok?: true;
  /** The new row, for the toast and its Undo. */
  saved?: { id: string; amount: number };
  formError?: string;
  fieldErrors?: Partial<Record<keyof TransactionFormInput, string>>;
};

export async function saveExpense(input: TransactionFormInput): Promise<SaveExpenseResult> {
  const { budget } = await requireAppUser();
  const supabase = await createClient();
  const today = todayInManila(new Date());
  const first = (await firstPeriodStart(budget.id)) ?? today;

  // Validated again here with the same schema the sheet uses.
  const parsed = transactionSchemaFor({ today, firstPeriodStart: first }).safeParse(input);
  if (!parsed.success) return { fieldErrors: toFieldErrors<TransactionFormInput>(parsed.error.issues) };
  const values = parsed.data;
  if (values.type !== "expense") return { formError: SOMETHING_WRONG };

  // The category must be one the sheet offers: the user's own, an expense
  // category, and not a system one (Savings pot and Extra debt payment are
  // expense categories, so the database would accept them).
  const { data: category, error: categoryError } = await supabase
    .from("categories")
    .select("kind, system_key")
    .eq("id", values.categoryId)
    .maybeSingle();
  if (categoryError) return fail("load category", categoryError);
  if (!category || category.kind !== "expense" || category.system_key != null) {
    return { fieldErrors: { categoryId: "Pick a category." } };
  }

  try {
    // The period that contains the date, created if it's the first entry there.
    const period = await getOrCreatePeriod(supabase, budget, values.date);
    const { data, error } = await supabase
      .from("transactions")
      .insert({
        period_id: period.id,
        category_id: values.categoryId,
        type: "expense",
        amount: values.amount,
        date: values.date,
        note: values.note,
      })
      .select("id, amount")
      .single();
    if (error) return fail("save expense", error);
    return { ok: true, saved: data };
  } catch (error) {
    return fail("find period", error as Error);
  }
}

export type SaveIncomeResult = {
  ok?: true;
  saved?: { id: string; amount: number };
  formError?: string;
  fieldErrors?: Partial<Record<keyof IncomeFormInput, string>>;
};

export async function saveIncome(input: IncomeFormInput): Promise<SaveIncomeResult> {
  const { budget } = await requireAppUser();
  const supabase = await createClient();
  const today = todayInManila(new Date());
  const first = (await firstPeriodStart(budget.id)) ?? today;

  const parsed = incomeSchemaFor({ today, firstPeriodStart: first }).safeParse(input);
  if (!parsed.success) return { fieldErrors: toFieldErrors<IncomeFormInput>(parsed.error.issues) };
  const values = parsed.data;

  // A source must be one of this budget's, and not ended before the date.
  if (values.incomeSourceId) {
    const { data: source, error } = await supabase
      .from("income_sources")
      .select("budget_id, end_date")
      .eq("id", values.incomeSourceId)
      .maybeSingle();
    if (error) return fail("load income source", error);
    if (!source || source.budget_id !== budget.id || (source.end_date != null && source.end_date < values.date)) {
      return { fieldErrors: { source: "Pick where it's from." } };
    }
  }

  // Income always goes in the locked Income category (plan review 3.4).
  const { data: category, error: categoryError } = await supabase
    .from("categories")
    .select("id")
    .eq("system_key", "income")
    .maybeSingle();
  if (categoryError) return fail("load the Income category", categoryError);
  if (!category) return fail("find the Income category", { message: "missing system category" });

  try {
    const period = await getOrCreatePeriod(supabase, budget, values.date);
    const { data, error } = await supabase
      .from("transactions")
      .insert({
        period_id: period.id,
        category_id: category.id,
        type: "income",
        amount: values.amount,
        date: values.date,
        note: values.note,
        income_source_id: values.incomeSourceId,
      })
      .select("id, amount")
      .single();
    if (error) return fail("save income", error);
    return { ok: true, saved: data };
  } catch (error) {
    return fail("find period", error as Error);
  }
}

/** Undo from the toast: soft-deletes the row just saved (delete-pattern.md level 1). */
export async function undoTransaction(id: string): Promise<{ ok?: true; formError?: string }> {
  await requireAppUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("transactions")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .is("deleted_at", null)
    .select("id");
  if (error) return fail("undo", error);
  if (data.length === 0) return { formError: "That entry was already removed." };
  return { ok: true };
}

/** The budget's earliest period start, or null if it has none yet. */
async function firstPeriodStart(budgetId: string): Promise<string | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("budget_periods")
    .select("start_date")
    .eq("budget_id", budgetId)
    .order("start_date", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`Couldn't load the first period: ${error.message}`, { cause: error });
  return data?.start_date ?? null;
}

function fail(what: string, error: { code?: string; message: string }) {
  console.error(`activity: couldn't ${what}`, error.code, error.message);
  return { formError: SOMETHING_WRONG };
}
