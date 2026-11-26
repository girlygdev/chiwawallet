"use server";

import { z } from "zod";
import { getOrCreatePeriod } from "@/lib/budget-periods";
import { debtLeft, debtPaid } from "@/lib/debts";
import { formatPeso } from "@/lib/money";
import { scheduleFromBudget, todayInManila } from "@/lib/periods";
import { missingStarterItems, type PlanOrigin, planSection, plannablePeriods, starterPlan } from "@/lib/plan";
import { openPlanPeriod } from "@/lib/plan-periods";
import { requireAppUser } from "@/lib/require-app-user";
import { createClient } from "@/lib/supabase/server";
import type { BudgetGroup } from "@/lib/transactions";
import { SOMETHING_WRONG, toFieldErrors } from "@/lib/validation/field-errors";
import {
  type DebtPaymentInput,
  debtPaymentSchema,
  type EditPlanItemInput,
  editPlanItemSchema,
  type OneOffItemInput,
  oneOffItemSchema,
  type SetBudgetInput,
  setBudgetSchema,
} from "@/lib/validation/plan-item";

// Edit item, Remove from plan (and its Undo), and Use this starter plan
// (plan.md §3, §5; week-5-tasks.md 5e). RLS limits every query to the
// user's own rows. On top of that, each action checks the item's period
// belongs to the current budget and hasn't ended: an ended period's plan is
// read-only, even from an old link.

type Result = { ok?: true; formError?: string; fieldErrors?: Partial<Record<keyof EditPlanItemInput, string>> };

const GONE = "That item is no longer in this plan. Refresh the page.";
const ENDED = "This period has ended, so its plan can't change.";

/**
 * Edit item: name and amount, and Needed by for one-offs. Only this period's
 * row changes; its bill, pot or debt keeps its link and its own amount.
 * `edited` tells 5h's sync to leave the item alone from now on.
 */
export async function updatePlanItem(id: string, input: EditPlanItemInput): Promise<Result> {
  const { budget } = await requireAppUser();
  if (!z.uuid().safeParse(id).success) return { formError: SOMETHING_WRONG };
  const parsed = editPlanItemSchema.safeParse(input);
  if (!parsed.success) return { fieldErrors: toFieldErrors<EditPlanItemInput>(parsed.error.issues) };

  const item = await loadItem(id, budget.id, "live");
  if ("formError" in item) return item;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("plan_items")
    .update({
      name: parsed.data.name,
      planned_amount: parsed.data.amount,
      // Only one-offs have a Needed by (the database checks it too).
      ...(item.origin === "one_off" ? { needed_by: parsed.data.neededBy } : {}),
      edited: true,
    })
    .eq("id", id)
    .is("deleted_at", null)
    .select("id");
  if (error) return fail("update plan item", error);
  if (data.length === 0) return { formError: GONE };
  return { ok: true };
}

/**
 * Remove from plan (delete-pattern.md level 1): a soft delete, so Undo can
 * bring back the same row. A generated item stays removed for this period:
 * add_plan_items() skips deleted rows too.
 */
export async function removePlanItem(id: string): Promise<Result> {
  const { budget } = await requireAppUser();
  if (!z.uuid().safeParse(id).success) return { formError: SOMETHING_WRONG };
  const item = await loadItem(id, budget.id, "live");
  if ("formError" in item) return item;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("plan_items")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .is("deleted_at", null)
    .select("id");
  if (error) return fail("remove plan item", error);
  if (data.length === 0) return { formError: GONE };
  return { ok: true };
}

/** Undo after Remove from plan: clears `deleted_at`. */
export async function restorePlanItem(id: string): Promise<Result> {
  const { budget } = await requireAppUser();
  if (!z.uuid().safeParse(id).success) return { formError: SOMETHING_WRONG };
  const item = await loadItem(id, budget.id, "removed");
  if ("formError" in item) return item;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("plan_items")
    .update({ deleted_at: null })
    .eq("id", id)
    .not("deleted_at", "is", null)
    .select("id");
  // 23505: a starter item whose group was added again in the meantime
  // (plan_items_starter_key allows one live starter item per group).
  if (error?.code === "23505") return { formError: "It's already in this plan." };
  if (error) return fail("restore plan item", error);
  if (data.length === 0) return { formError: "That item is already back." };
  return { ok: true };
}

/**
 * Use this starter plan: the budget's split of this payday's expected pay,
 * as three `starter` items. Adds only the groups not there yet, so a double
 * tap or a second tab adds nothing more. The pay is worked out here from the
 * period's income items, never taken from the browser.
 */
export async function addStarterPlan(periodStart: string): Promise<Result> {
  const { budget } = await requireAppUser();
  if (!z.iso.date().safeParse(periodStart).success) return { formError: SOMETHING_WRONG };
  const supabase = await createClient();

  const { data: period, error: periodError } = await supabase
    .from("budget_periods")
    .select("id, end_date")
    .eq("budget_id", budget.id)
    .eq("start_date", periodStart)
    .maybeSingle();
  if (periodError) return fail("load period", periodError);
  if (!period) return { formError: SOMETHING_WRONG };
  if (period.end_date < todayInManila(new Date())) return { formError: ENDED };

  const { data: items, error } = await supabase
    .from("plan_items")
    .select("origin, planned_amount, budget_group, income_source_id, bill_id, pot_id, debt_id, category:categories(budget_group)")
    .eq("period_id", period.id)
    .is("deleted_at", null);
  if (error) return fail("load the plan", error);

  // The same rule the Plan uses for MONEY IN (planSection()); the generated
  // types say `string` for origin and budget_group, which check constraints narrow.
  const shaped = items.map((i) => {
    const category = i.category as unknown as { budget_group: string | null } | null;
    const group = (category ? category.budget_group : i.budget_group) as BudgetGroup | null;
    return { ...i, origin: i.origin as PlanOrigin, budget_group: i.budget_group as BudgetGroup | null, group };
  });
  const pay = shaped.filter((i) => planSection(i) === "income").reduce((sum, i) => sum + i.planned_amount, 0);
  const missing = missingStarterItems(starterPlan(pay, budget), shaped);
  if (missing.length === 0) return { ok: true };

  const { error: insertError } = await supabase
    .from("plan_items")
    .insert(missing.map((s) => ({ period_id: period.id, ...s })));
  // 23505: another tab added it first, which is what was asked for.
  if (insertError && insertError.code !== "23505") return fail("add the starter plan", insertError);
  return { ok: true };
}

export type AddOneOffResult = {
  ok?: true;
  /** The new row, for the toast and its Undo, and the period to go to. */
  saved?: { id: string; name: string; periodStart: string };
  formError?: string;
  fieldErrors?: Partial<Record<keyof OneOffItemInput, string>>;
};

/**
 * Add one-off item (plan.md §6, task 5f): a `one_off` plan item in the
 * chosen payday's period, created if it hasn't been opened yet. The period
 * must be one the sheet offers: the current one or up to 3 months ahead.
 */
export async function addOneOffItem(input: OneOffItemInput): Promise<AddOneOffResult> {
  const { budget } = await requireAppUser();
  const parsed = oneOffItemSchema.safeParse(input);
  if (!parsed.success) return { fieldErrors: toFieldErrors<OneOffItemInput>(parsed.error.issues) };
  const values = parsed.data;

  // No first period given: the list starts at the current period, never a past one.
  const offered = plannablePeriods(todayInManila(new Date()), scheduleFromBudget(budget), null);
  if (!offered.some((p) => p.start === values.periodStart)) {
    return { fieldErrors: { periodStart: "Pick which payday pays for it." } };
  }

  const supabase = await createClient();
  // A spending category of the user's own. The database would also take the
  // system Savings pot or Debt payment ones, which aren't offered here.
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
    const period = await getOrCreatePeriod(supabase, budget, values.periodStart);
    const { data, error } = await supabase
      .from("plan_items")
      .insert({
        period_id: period.id,
        name: values.name,
        planned_amount: values.amount,
        origin: "one_off",
        needed_by: values.neededBy,
        category_id: values.categoryId,
      })
      .select("id, name")
      .single();
    if (error) return fail("add one-off item", error);
    return { ok: true, saved: { ...data, periodStart: period.start_date } };
  } catch (error) {
    return fail("find period", error as Error);
  }
}

export type SetBudgetResult = {
  ok?: true;
  saved?: { name: string; amount: number };
  formError?: string;
  fieldErrors?: Partial<Record<keyof SetBudgetInput, string>>;
};

/**
 * Set a budget (plan.md fix #2, 5g-1) in the period being viewed: the
 * category's spending budget item there is created or changed, never added
 * twice (plan_items_budget_key). "Every payday" also saves the category's
 * budget per payday, which generatePlan() copies into periods as they open;
 * "This period only" marks the item `edited`, so 5h's sync leaves it alone.
 */
export async function setBudget(periodStart: string, input: SetBudgetInput): Promise<SetBudgetResult> {
  const { budget } = await requireAppUser();
  if (!z.iso.date().safeParse(periodStart).success) return { formError: SOMETHING_WRONG };
  const parsed = setBudgetSchema.safeParse(input);
  if (!parsed.success) return { fieldErrors: toFieldErrors<SetBudgetInput>(parsed.error.issues) };
  const { categoryId, amount, scope } = parsed.data;
  const supabase = await createClient();

  const [period, category] = await Promise.all([
    supabase.from("budget_periods").select("id, end_date").eq("budget_id", budget.id).eq("start_date", periodStart).maybeSingle(),
    supabase.from("categories").select("name, kind, system_key").eq("id", categoryId).maybeSingle(),
  ]);
  if (period.error) return fail("load period", period.error);
  if (category.error) return fail("load category", category.error);
  if (!period.data) return { formError: SOMETHING_WRONG };
  if (period.data.end_date < todayInManila(new Date())) return { formError: ENDED };
  // Only the user's own spending categories have budgets (not system ones).
  if (!category.data || category.data.kind !== "expense" || category.data.system_key != null) {
    return { fieldErrors: { categoryId: "Pick a category." } };
  }

  if (scope === "every") {
    const { error } = await supabase.from("categories").update({ default_budget: amount }).eq("id", categoryId);
    if (error) return fail("save budget per payday", error);
  }

  // This period's budget item for the category, removed ones included: the
  // unique key counts them, so a removed one is brought back, not re-added.
  const { data: existing, error: findError } = await supabase
    .from("plan_items")
    .select("id")
    .eq("period_id", period.data.id)
    .eq("origin", "recurring")
    .eq("category_id", categoryId)
    .is("income_source_id", null)
    .is("bill_id", null)
    .is("pot_id", null)
    .is("debt_id", null)
    .maybeSingle();
  if (findError) return fail("load budget item", findError);

  const edited = scope === "period";
  const { error } = existing
    ? await supabase.from("plan_items").update({ planned_amount: amount, deleted_at: null, edited }).eq("id", existing.id)
    : await supabase.from("plan_items").insert({
        period_id: period.data.id,
        name: category.data.name,
        category_id: categoryId,
        planned_amount: amount,
        origin: "recurring",
        edited,
      });
  if (error) return fail("set budget", error);
  return { ok: true, saved: { name: category.data.name, amount } };
}

export type AddDebtPaymentResult = {
  ok?: true;
  saved?: { id: string; name: string; periodStart: string };
  formError?: string;
  fieldErrors?: Partial<Record<keyof DebtPaymentInput, string>>;
};

/**
 * Plan a debt payment (5g-2): an extra payment on an active debt, paid from
 * the chosen payday (the current period or up to 3 months ahead). A
 * `one_off` item with `debt_id` and the Extra debt payment category, so it
 * counts as Savings & debt payoff. It can't be more than what's left.
 */
export async function addDebtPayment(input: DebtPaymentInput): Promise<AddDebtPaymentResult> {
  const { budget } = await requireAppUser();
  const parsed = debtPaymentSchema.safeParse(input);
  if (!parsed.success) return { fieldErrors: toFieldErrors<DebtPaymentInput>(parsed.error.issues) };
  const values = parsed.data;

  const offered = plannablePeriods(todayInManila(new Date()), scheduleFromBudget(budget), null);
  if (!offered.some((p) => p.start === values.periodStart)) {
    return { fieldErrors: { periodStart: "Pick which payday pays for it." } };
  }

  const supabase = await createClient();
  const [debt, payments, category] = await Promise.all([
    supabase.from("debts").select("name, total_amount, paid_off_at").eq("id", values.debtId).maybeSingle(),
    supabase
      .from("transactions")
      .select("amount, deleted_at")
      .eq("type", "debt_payment")
      .eq("debt_id", values.debtId)
      .is("deleted_at", null),
    supabase.from("categories").select("id").eq("system_key", "extra_debt").maybeSingle(),
  ]);
  for (const result of [debt, payments, category]) {
    if (result.error) return fail("load debt", result.error);
  }
  if (!category.data) return fail("find the Extra debt payment category", { message: "missing system category" });
  // RLS hides other users' debts, so a missing one is gone or not theirs.
  if (!debt.data) return { fieldErrors: { debtId: "Pick a debt." } };

  const left = debtLeft({ ...debt.data, paid: debtPaid(payments.data!) });
  if (left <= 0) return { fieldErrors: { debtId: `${debt.data.name} is paid off.` } };
  if (values.amount > left) return { fieldErrors: { amount: `Only ${formatPeso(left)} left on ${debt.data.name}.` } };

  try {
    const period = await getOrCreatePeriod(supabase, budget, values.periodStart);
    const { data, error } = await supabase
      .from("plan_items")
      .insert({
        period_id: period.id,
        name: debt.data.name,
        planned_amount: values.amount,
        origin: "one_off",
        category_id: category.data.id,
        debt_id: values.debtId,
      })
      .select("id, name")
      .single();
    if (error) return fail("plan debt payment", error);
    return { ok: true, saved: { ...data, periodStart: period.start_date } };
  } catch (error) {
    return fail("find period", error as Error);
  }
}

/**
 * The impact box's "before" for the payday card picked: that period's Not
 * assigned yet, worked out exactly as its Plan shows it. Opening it is the
 * same as tapping its chip: a future period is created with its items.
 */
export async function getPeriodNotAssigned(start: string): Promise<{ start: string; end: string; notAssigned: number } | null> {
  const { budget } = await requireAppUser();
  if (!z.iso.date().safeParse(start).success) return null;
  const supabase = await createClient();
  const plan = await openPlanPeriod(supabase, budget, start, todayInManila(new Date()));
  // openPlanPeriod() falls back to the current period for one it can't open.
  if (plan.period.start_date !== start) return null;
  return { start, end: plan.period.end_date, notAssigned: plan.summary.notAssigned };
}

/**
 * The item, if it's in one of this budget's periods that hasn't ended.
 * `state` says whether it should be live (edit, remove) or removed (undo).
 */
async function loadItem(
  id: string,
  budgetId: string,
  state: "live" | "removed",
): Promise<{ origin: string } | { formError: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("plan_items")
    .select("origin, deleted_at, period:budget_periods(budget_id, end_date)")
    .eq("id", id)
    .maybeSingle();
  if (error) return fail("load plan item", error);
  // Each item has exactly one period.
  const period = data?.period as unknown as { budget_id: string; end_date: string } | undefined;
  if (!data || !period || period.budget_id !== budgetId) return { formError: GONE };
  if ((data.deleted_at == null) !== (state === "live")) {
    return { formError: state === "live" ? GONE : "That item is already back." };
  }
  if (period.end_date < todayInManila(new Date())) return { formError: ENDED };
  return { origin: data.origin };
}

function fail(what: string, error: { code?: string; message: string }): { formError: string } {
  console.error(`plan: couldn't ${what}`, error.code, error.message);
  return { formError: SOMETHING_WRONG };
}
