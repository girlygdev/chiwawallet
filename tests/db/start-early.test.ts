import { describe, expect, it } from "vitest";
import { anonClient, signUpUser, type TestUser } from "./helpers";

// Starting the next period early (Task D1, owner Nov 28; migration
// 20261128110000_start_period_early): budget_periods.started_early_on and
// start_period_early(). The function uses the database's clock in Manila, so
// these periods are built around today's date rather than fixed dates.

const NOT_ALLOWED = "22023";
const NOT_NOW = "55000";
const GONE = "P0002";
const CHECK_VIOLATION = "23514";
const PERMISSION_DENIED = "42501";

/** Today in Manila, "YYYY-MM-DD", like the database's (now() at time zone 'Asia/Manila')::date. */
const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(new Date());
/** `days` from today, "YYYY-MM-DD" (UTC math on a date-only value never shifts a day). */
function fromToday(days: number): string {
  const d = new Date(`${today}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

type Setup = { user: TestUser; budgetId: string; current: string; next: string; meals: string };

/**
 * A user whose current period runs from `currentFrom` days ago to tomorrow
 * (or `nextIn` − 1), and whose next period starts in `nextIn` days.
 */
async function setUp({ nextIn = 2, currentFrom = -10 } = {}): Promise<Setup> {
  const user = await signUpUser();
  const insert = async (table: string, row: Record<string, unknown>) => {
    const { data, error } = await user.client.from(table).insert(row).select("id").single();
    if (error) throw new Error(`Couldn't create ${table}: ${error.message}`);
    return data.id as string;
  };
  const budgetId = await insert("budgets", { name: "Main budget", frequency: "semi_monthly", pay_day_1: 15, pay_day_2: 30 });
  const current = await insert("budget_periods", {
    budget_id: budgetId, start_date: fromToday(currentFrom), end_date: fromToday(nextIn - 1), pay_slot: "payday_1",
  });
  const next = await insert("budget_periods", {
    budget_id: budgetId, start_date: fromToday(nextIn), end_date: fromToday(nextIn + 14), pay_slot: "payday_2",
  });
  const { data: meals } = await user.client.from("categories").select("id").eq("name", "Meals").single();
  return { user, budgetId, current, next, meals: meals!.id };
}

const startEarly = (s: Setup, period = s.next, client = s.user.client) => client.rpc("start_period_early", { target_period: period });

const period = async (s: Setup, id: string) =>
  (await s.user.client.from("budget_periods").select("start_date, end_date, started_early_on").eq("id", id).single()).data!;

const spend = (s: Setup, periodId: string, date: string) =>
  s.user.client.from("transactions").insert({ period_id: periodId, category_id: s.meals, type: "expense", amount: 18_000, date }).select("id").single();

describe("start_period_early()", () => {
  it("starts the next period today and ends the current one yesterday", async () => {
    const s = await setUp();
    const { error } = await startEarly(s);
    expect(error).toBeNull();
    expect(await period(s, s.next)).toEqual({ start_date: fromToday(2), end_date: fromToday(16), started_early_on: today });
    expect(await period(s, s.current)).toMatchObject({ end_date: fromToday(-1), started_early_on: null });
  });

  it("moves today's spending to the next period and keeps yesterday's", async () => {
    const s = await setUp();
    const todays = (await spend(s, s.current, today)).data!.id;
    const yesterdays = (await spend(s, s.current, fromToday(-1))).data!.id;
    expect((await startEarly(s)).error).toBeNull();
    const { data: rows } = await s.user.client.from("transactions").select("id, period_id").in("id", [todays, yesterdays]);
    expect(Object.fromEntries(rows!.map((r) => [r.id, r.period_id]))).toEqual({ [todays]: s.next, [yesterdays]: s.current });
  });

  it("then dates from today go in the next period only", async () => {
    const s = await setUp();
    await startEarly(s);
    expect((await spend(s, s.current, today)).error?.code).toBe(CHECK_VIOLATION);
    expect((await spend(s, s.next, today)).error).toBeNull();
    expect((await spend(s, s.next, fromToday(-1))).error?.code).toBe(CHECK_VIOLATION);
  });

  it("works up to 5 days before the payday, and not earlier or on it", async () => {
    expect((await startEarly(await setUp({ nextIn: 5 }))).error).toBeNull();
    expect((await startEarly(await setUp({ nextIn: 6 }))).error?.code).toBe(NOT_ALLOWED);
    expect((await startEarly(await setUp({ nextIn: 0, currentFrom: -14 }))).error?.code).toBe(NOT_ALLOWED);
  });

  it("refuses when the current period would have no days left", async () => {
    // The current period began today.
    expect((await startEarly(await setUp({ currentFrom: 0 }))).error?.code).toBe(NOT_ALLOWED);
  });

  it("starts a period only once", async () => {
    const s = await setUp();
    await startEarly(s);
    expect((await startEarly(s)).error?.code).toBe(NOT_NOW);
  });

  it("refuses when either period is closed", async () => {
    const closed = { closed_at: new Date().toISOString() };
    const a = await setUp();
    await a.user.client.from("budget_periods").update(closed).eq("id", a.current);
    expect((await startEarly(a)).error?.code).toBe(NOT_NOW);
    const b = await setUp();
    await b.user.client.from("budget_periods").update(closed).eq("id", b.next);
    expect((await startEarly(b)).error?.code).toBe(NOT_NOW);
  });

  it("needs the period right before it", async () => {
    const s = await setUp();
    await s.user.client.from("budget_periods").delete().eq("id", s.current);
    expect((await startEarly(s)).error?.code).toBe(GONE);
  });

  it("can't touch someone else's period", async () => {
    const s = await setUp();
    const other = await setUp();
    expect((await startEarly(other, other.next, s.user.client)).error?.code).toBe(GONE);
    expect((await period(other, other.next)).started_early_on).toBeNull();
  });

  it("isn't open to logged-out visitors", async () => {
    const s = await setUp();
    expect((await startEarly(s, s.next, anonClient())).error?.code).toBe(PERMISSION_DENIED);
  });
});

describe("budget_periods.started_early_on", () => {
  it("can't be written directly, only through start_period_early()", async () => {
    const s = await setUp();
    const update = await s.user.client.from("budget_periods").update({ started_early_on: today }).eq("id", s.next);
    expect(update.error?.code).toBe(PERMISSION_DENIED);
    const insert = await s.user.client.from("budget_periods").insert({
      budget_id: s.budgetId, start_date: fromToday(17), end_date: fromToday(30), pay_slot: "payday_1", started_early_on: fromToday(15),
    });
    expect(insert.error?.code).toBe(PERMISSION_DENIED);
  });
});

describe("start_period_early(): early pay (Task D3, owner Nov 28)", () => {
  const income = async (s: Setup) => (await s.user.client.from("categories").select("id").eq("system_key", "income").single()).data!.id as string;
  const earn = async (s: Setup, periodId: string, date: string) =>
    (await s.user.client.from("transactions").insert({ period_id: periodId, category_id: await income(s), type: "income", amount: 2_500_000, date }).select("id").single()).data!.id as string;
  const dateOf = async (s: Setup, id: string) => (await s.user.client.from("transactions").select("date").eq("id", id).single()).data!.date;

  it("re-dates pay logged early for the payday to today", async () => {
    const s = await setUp();
    const early = await earn(s, s.next, fromToday(2));
    expect((await startEarly(s)).error).toBeNull();
    expect(await dateOf(s, early)).toBe(today);
  });

  it("leaves other income alone", async () => {
    const s = await setUp();
    const earlier = await earn(s, s.current, fromToday(-3));
    const later = await earn(s, s.next, fromToday(4)); // after the payday: not early pay
    await startEarly(s);
    expect(await dateOf(s, earlier)).toBe(fromToday(-3));
    expect(await dateOf(s, later)).toBe(fromToday(4));
  });
});
