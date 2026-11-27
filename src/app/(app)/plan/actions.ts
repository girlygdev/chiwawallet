"use server";

import { z } from "zod";
import { getOrCreatePeriod } from "@/lib/budget-periods";
import { debtLeft, debtPaid } from "@/lib/debts";
import { formatPeso, parsePesoInput } from "@/lib/money";
import { scheduleFromBudget, todayInManila } from "@/lib/periods";
import { coverFromPot, paidOnDate, plannablePeriods } from "@/lib/plan";
import { closePeriod, loadAssignData, loadPaydayData, openPlanPeriod, syncOpenPeriods } from "@/lib/plan-periods";
import { requireAppUser } from "@/lib/require-app-user";
import { createClient } from "@/lib/supabase/server";
import { SOMETHING_WRONG, toFieldErrors } from "@/lib/validation/field-errors";
import {
  type AssignInput,
  assignSchema,
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
 * bring back the same row. It's also marked `edited`, a hand change, so the
 * sync (5h) never brings a generated item back: an unedited removed item is
 * one the sync took out itself.
 */
export async function removePlanItem(id: string): Promise<Result> {
  const { budget } = await requireAppUser();
  if (!z.uuid().safeParse(id).success) return { formError: SOMETHING_WRONG };
  const item = await loadItem(id, budget.id, "live");
  if ("formError" in item) return item;
  if (item.paid) return { formError: "Paid. To remove it, delete its payment in Activity first." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("plan_items")
    .update({ deleted_at: new Date().toISOString(), edited: true })
    .eq("id", id)
    .is("deleted_at", null)
    .select("id");
  if (error) return fail("remove plan item", error);
  if (data.length === 0) return { formError: GONE };
  return { ok: true };
}

/**
 * Undo after Remove from plan: clears `deleted_at` and puts back the
 * `edited` the item had before, so an untouched item follows its source again.
 */
export async function restorePlanItem(id: string, edited: boolean): Promise<Result> {
  const { budget } = await requireAppUser();
  if (!z.uuid().safeParse(id).success || typeof edited !== "boolean") return { formError: SOMETHING_WRONG };
  const item = await loadItem(id, budget.id, "removed");
  if ("formError" in item) return item;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("plan_items")
    .update({ deleted_at: null, edited })
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
  // Every payday: the other open periods follow the new budget per payday (5h-1).
  if (scope === "every") await syncOpenPeriods(supabase, budget, todayInManila(new Date()));
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

export type MarkPaidResult = {
  ok?: true;
  /** The payment, for Undo; the item's name and paid amount, for the toast. */
  saved?: { transactionId: string; name: string; amount: number; kind: "pot" | "other" };
  formError?: string;
};

/**
 * Mark paid (plan.md §3, 6b-1): pays one item through mark_plan_item_paid()
 * (6a), which creates the payment and ticks the item together. The date is
 * today, or the period's last day for an earlier period that hasn't closed;
 * a future period can't be paid yet. `amount` is a variable bill's real
 * amount; otherwise the planned amount is paid.
 */
export async function markPaid(id: string, amountText?: string): Promise<MarkPaidResult> {
  const { budget } = await requireAppUser();
  if (!z.uuid().safeParse(id).success) return { formError: SOMETHING_WRONG };
  let amount: number | undefined;
  if (amountText !== undefined) {
    const centavos = parsePesoInput(amountText);
    if (centavos == null || centavos <= 0) return { formError: "Enter an amount above ₱0." };
    amount = centavos;
  }

  const found = await loadPayable(id, budget.id);
  if ("formError" in found) return found;
  const { item, paidOn } = found;
  const supabase = await createClient();

  const paid = amount ?? item.planned_amount;
  const { data: transactionId, error: payError } = await supabase.rpc("mark_plan_item_paid", {
    target_item: id,
    paid_on: paidOn,
    paid_amount: paid,
  });
  if (payError) {
    // mark_plan_item_paid()'s codes (6a).
    if (payError.code === "P0002") return { formError: GONE };
    if (payError.code === "55000") return { formError: "That's already paid." };
    if (payError.code === "22023") return { formError: "This item isn't ticked off." };
    return fail("mark paid", payError);
  }
  return { ok: true, saved: { transactionId, name: item.name, amount: paid, kind: item.pot_id ? "pot" : "other" } };
}

/**
 * Un-ticks a paid item: soft-deletes its payment, and the 6a trigger clears
 * paid_at. Returns the payment's id, so Undo can restore it with
 * restoreTransaction(), which ticks the item again.
 */
export async function unmarkPaid(id: string): Promise<{ ok?: true; transactionId?: string; formError?: string }> {
  const { budget } = await requireAppUser();
  if (!z.uuid().safeParse(id).success) return { formError: SOMETHING_WRONG };
  const found = await loadPayable(id, budget.id);
  if ("formError" in found) return found;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("transactions")
    .update({ deleted_at: new Date().toISOString() })
    .eq("plan_item_id", id)
    .is("deleted_at", null)
    .select("id");
  if (error) return fail("un-tick plan item", error);
  if (data.length === 0) return { formError: "That's already due again." };
  return { ok: true, transactionId: data[0].id };
}

/**
 * Give leftover a job (plan.md §7, 6f): one `assigned` plan item per pot
 * and debt, in the period. Checked here against live numbers: the period
 * hasn't ended, the total fits in its Not assigned yet, and each amount fits
 * its destination's cap (a pot's target, what's owed on a debt). Pots use
 * the Savings pot category and debts Extra debt payment (Savings & debt
 * payoff). Returns the new items, for Undo.
 */
export async function assignLeftover(input: AssignInput): Promise<{ ok?: true; ids?: string[]; total?: number; formError?: string }> {
  const { budget } = await requireAppUser();
  const parsed = assignSchema.safeParse(input);
  if (!parsed.success) return { formError: parsed.error.issues[0]?.message ?? SOMETHING_WRONG };
  const { periodStart, allocations } = parsed.data;
  const supabase = await createClient();
  const today = todayInManila(new Date());

  const plan = await openPlanPeriod(supabase, budget, periodStart, today);
  if (plan.period.start_date !== periodStart || plan.ended) return { formError: ENDED };
  const total = allocations.reduce((sum, a) => sum + a.amount, 0);
  const free = plan.summary.notAssigned;
  if (total > free) {
    return { formError: `Only ${formatPeso(Math.max(0, free))} is left to assign. Refresh to see what changed.` };
  }

  const { destinations } = await loadAssignData(supabase, budget, plan, today);
  for (const a of allocations) {
    const d = destinations.find((x) => x.kind === a.kind && x.id === a.id);
    if (!d) return { formError: SOMETHING_WRONG };
    if (d.cap != null && a.amount > d.cap) return { formError: `${d.name} can take ${formatPeso(d.cap)} at most.` };
  }

  const { data: categories, error: categoryError } = await supabase
    .from("categories")
    .select("id, system_key")
    .in("system_key", ["savings_pot", "extra_debt"]);
  if (categoryError) return fail("load categories", categoryError);
  const categoryOf = (key: string) => categories.find((c) => c.system_key === key)?.id;
  if (!categoryOf("savings_pot") || !categoryOf("extra_debt")) return fail("find system categories", { message: "missing" });

  const { data, error } = await supabase
    .from("plan_items")
    .insert(
      allocations.map((a) => ({
        period_id: plan.period.id,
        name: destinations.find((d) => d.kind === a.kind && d.id === a.id)!.name,
        planned_amount: a.amount,
        origin: "assigned",
        category_id: categoryOf(a.kind === "pot" ? "savings_pot" : "extra_debt")!,
        ...(a.kind === "pot" ? { pot_id: a.id } : { debt_id: a.id }),
      })),
    )
    .select("id");
  if (error) return fail("assign leftover", error);
  return { ok: true, ids: data.map((r) => r.id), total };
}

const closeChoiceSchema = z.object({
  start: z.iso.date(),
  choice: z.enum(["carry", "pot", "debt", "split"]),
  /** Cover it from a pot (an overspend): which pot. */
  potId: z.uuid().optional(),
});

/**
 * The payday screen's confirm (payday-rollover.md §4, 6h-2): applies the
 * choice for the waiting period `start`, then closes it (closePeriod()).
 * - Move it to a pot: a deposit of the leftover, dated the period's last day.
 * - Pay off a debt early: an extra payment of up to what's owed; the rest carries.
 * - Cover it from a pot (an overspend): a withdrawal of up to the pot's balance.
 * - Carry, and Split it myself (Give leftover a job on the new period): nothing more.
 * Live numbers come from loadPaydayData(), never the browser. If closing
 * fails after the transaction saved, the transaction is soft-deleted again.
 * Already closed (another tab): nothing to do.
 */
export async function closeWithChoice(input: z.input<typeof closeChoiceSchema>): Promise<{ ok?: true; currentStart?: string; formError?: string }> {
  const { budget } = await requireAppUser();
  const parsed = closeChoiceSchema.safeParse(input);
  if (!parsed.success) return { formError: SOMETHING_WRONG };
  const { start, choice, potId } = parsed.data;
  const supabase = await createClient();
  const today = todayInManila(new Date());

  const { data: old, error } = await supabase
    .from("budget_periods")
    .select("id, start_date, end_date, closed_at")
    .eq("budget_id", budget.id)
    .eq("start_date", start)
    .maybeSingle();
  if (error) return fail("load period", error);
  if (!old || old.end_date >= today) return { formError: SOMETHING_WRONG };
  if (old.closed_at) return { ok: true };

  const data = await loadPaydayData(supabase, budget, old, today);
  const leftover = data.review.leftover;
  const { data: categories, error: categoryError } = await supabase
    .from("categories")
    .select("id, system_key")
    .in("system_key", ["savings_pot", "extra_debt"]);
  if (categoryError) return fail("load categories", categoryError);
  const categoryOf = (key: string) => categories.find((c) => c.system_key === key)?.id;

  // The transaction the choice makes, if any.
  let row: { category_id: string; type: "savings" | "debt_payment"; amount: number; pot_id?: string; debt_id?: string } | null = null;
  if (choice === "pot" && leftover > 0 && data.pot) {
    row = { category_id: categoryOf("savings_pot")!, type: "savings", amount: leftover, pot_id: data.pot.id };
  } else if (choice === "debt" && leftover > 0 && data.debt) {
    row = { category_id: categoryOf("extra_debt")!, type: "debt_payment", amount: Math.min(leftover, data.debt.left), debt_id: data.debt.id };
  } else if (choice === "pot" && leftover < 0) {
    const pot = data.coverPots.find((p) => p.id === potId);
    if (!pot) return { formError: "Pick a pot to cover it from." };
    const { covered } = coverFromPot(-leftover, pot.balance);
    row = { category_id: categoryOf("savings_pot")!, type: "savings", amount: -covered, pot_id: pot.id };
  }

  let savedId: string | null = null;
  if (row && row.amount !== 0) {
    const { data: saved, error: saveError } = await supabase
      .from("transactions")
      .insert({ ...row, period_id: old.id, date: old.end_date })
      .select("id")
      .single();
    if (saveError) return fail("apply the payday choice", saveError);
    savedId = saved.id;
  }
  try {
    await closePeriod(supabase, budget, old, choice);
  } catch (closeError) {
    if (savedId) await supabase.from("transactions").update({ deleted_at: new Date().toISOString() }).eq("id", savedId);
    return fail("close the period", closeError as Error);
  }
  return { ok: true, currentStart: data.current.start };
}

/** Undo after Give leftover a job: soft-deletes the items it added. */
export async function undoAssign(ids: string[]): Promise<{ ok?: true; formError?: string }> {
  await requireAppUser();
  if (ids.length === 0 || ids.length > 50 || !ids.every((i) => z.uuid().safeParse(i).success)) return { formError: SOMETHING_WRONG };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("plan_items")
    .update({ deleted_at: new Date().toISOString() })
    .in("id", ids)
    .eq("origin", "assigned")
    .is("deleted_at", null)
    .is("paid_at", null)
    .select("id");
  if (error) return fail("undo assign", error);
  if (data.length === 0) return { formError: "Those were already removed or paid." };
  return { ok: true };
}

/**
 * An item Mark paid can tick or un-tick, with the date a payment gets: in
 * this budget, not removed, and in a period that has started and isn't
 * closed. Unlike loadItem(), an earlier period that has ended still counts
 * until it closes (6b-1).
 */
async function loadPayable(
  id: string,
  budgetId: string,
): Promise<{ item: { name: string; planned_amount: number; pot_id: string | null }; paidOn: string } | { formError: string }> {
  const supabase = await createClient();
  const { data: item, error } = await supabase
    .from("plan_items")
    .select("name, planned_amount, pot_id, deleted_at, period:budget_periods(budget_id, start_date, end_date, closed_at)")
    .eq("id", id)
    .maybeSingle();
  if (error) return fail("load plan item", error);
  // Each item has exactly one period.
  const period = item?.period as unknown as
    | { budget_id: string; start_date: string; end_date: string; closed_at: string | null }
    | undefined;
  if (!item || item.deleted_at != null || !period || period.budget_id !== budgetId) return { formError: GONE };
  if (period.closed_at != null) return { formError: "This period is closed, so its plan can't change." };
  const paidOn = paidOnDate(todayInManila(new Date()), { start: period.start_date, end: period.end_date });
  if (!paidOn) return { formError: "This payday hasn't started yet, so it can't be paid." };
  return { item, paidOn };
}

/**
 * The item, if it's in one of this budget's periods that hasn't ended.
 * `state` says whether it should be live (edit, remove) or removed (undo).
 */
async function loadItem(
  id: string,
  budgetId: string,
  state: "live" | "removed",
): Promise<{ origin: string; paid: boolean } | { formError: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("plan_items")
    .select("origin, deleted_at, paid_at, period:budget_periods(budget_id, end_date)")
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
  return { origin: data.origin, paid: data.paid_at != null };
}

function fail(what: string, error: { code?: string; message: string }): { formError: string } {
  console.error(`plan: couldn't ${what}`, error.code, error.message);
  return { formError: SOMETHING_WRONG };
}
