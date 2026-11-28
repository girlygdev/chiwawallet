import { describe, expect, it } from "vitest";
import {
  type ActivityRow,
  dayHeading,
  filterRows,
  periodNav,
  resolvePeriod,
  rowLabels,
  typeLabel,
} from "@/lib/activity";
import type { PaySchedule } from "@/lib/periods";

const semi: PaySchedule = { frequency: "semi_monthly", payDay1: 15, payDay2: 30 };

let n = 0;
function row(fields: Partial<ActivityRow> & Pick<ActivityRow, "type" | "amount">): ActivityRow {
  n += 1;
  return {
    id: `t${n}`,
    date: "2026-11-20",
    created_at: `2026-11-20T00:00:0${n % 10}Z`,
    deleted_at: null,
    card_id: null,
    note: null,
    category: { id: "food", name: "Food", icon: "shopping-basket", color: "green" },
    source: null,
    ...fields,
  };
}

const incomeCategory = { id: "income", name: "Income", icon: "wallet", color: "green" };
const lunch = row({ type: "expense", amount: 18_000, note: "Lunch" });
const groceries = row({ type: "expense", amount: 124_000 });
const jeep = row({
  type: "expense",
  amount: 5_000,
  note: "Jeep fare",
  category: { id: "transport", name: "Transport", icon: "car", color: "blue" },
});
const pay = row({ type: "income", amount: 2_500_000, category: incomeCategory, source: { name: "Main job" } });
const bonus = row({ type: "income", amount: 200_000, note: "Bonus", category: incomeCategory });
const toPot = row({ type: "savings", amount: 300_000, category: { id: "pot", name: "Savings pot", icon: "piggy-bank", color: "green" } });
const loan = row({ type: "debt_payment", amount: 400_000, category: { id: "debt", name: "Extra debt payment", icon: "credit-card", color: "red" } });
const all = [lunch, groceries, jeep, pay, bonus, toPot, loan];

describe("rowLabels: a row's name and detail line", () => {
  it("names an expense by its note, else its category", () => {
    expect(rowLabels(lunch)).toEqual({ name: "Lunch", detail: "Food" });
    expect(rowLabels(groceries)).toEqual({ name: "Food", detail: "Expense" });
  });

  it("names pay by its source, and one-time income by its note", () => {
    expect(rowLabels(pay)).toEqual({ name: "Main job", detail: "Income" });
    expect(rowLabels(bonus)).toEqual({ name: "Bonus", detail: "Income · One-time" });
  });

  it("tags a purchase on a card with the card's name (8b-3)", () => {
    expect(rowLabels(row({ type: "expense", amount: 1, note: "Lunch", card: { name: "BPI card" } }))).toEqual({
      name: "Lunch",
      detail: "Food · BPI card",
    });
    expect(rowLabels(row({ type: "expense", amount: 1, card: { name: "BPI card" } }))).toEqual({
      name: "Food",
      detail: "Expense · BPI card",
    });
  });

  it("doesn't tag a payment to a card (it isn't paid with it)", () => {
    expect(rowLabels(row({ type: "debt_payment", amount: 1, note: "Card bill", card: { name: "BPI card" } })).detail).toBe("Food");
  });

  it("calls income with neither a source nor a note (a deleted source) Income", () => {
    expect(rowLabels(row({ type: "income", amount: 1, category: incomeCategory }))).toEqual({
      name: "Income",
      detail: "Income",
    });
  });
});

describe("typeLabel", () => {
  it("names each type for the desktop TYPE column", () => {
    expect([lunch, pay, toPot, loan].map((r) => typeLabel(r.type))).toEqual([
      "Expense",
      "Income",
      "Savings",
      "Debt payment",
    ]);
  });
});

describe("filterRows", () => {
  const ids = (rows: ActivityRow[]) => rows.map((r) => r.id);

  it("keeps everything for All", () => {
    expect(filterRows(all, { type: "all", query: "", categoryId: "" })).toEqual(all);
  });

  it("splits by chip: Spending is expenses and debt payments", () => {
    expect(ids(filterRows(all, { type: "spending", query: "", categoryId: "" }))).toEqual(
      ids([lunch, groceries, jeep, loan]),
    );
    expect(ids(filterRows(all, { type: "income", query: "", categoryId: "" }))).toEqual(ids([pay, bonus]));
    expect(ids(filterRows(all, { type: "savings", query: "", categoryId: "" }))).toEqual(ids([toPot]));
  });

  it("searches names, notes, categories and sources, ignoring case and outer spaces", () => {
    expect(ids(filterRows(all, { type: "all", query: " JEEP ", categoryId: "" }))).toEqual(ids([jeep]));
    expect(ids(filterRows(all, { type: "all", query: "transport", categoryId: "" }))).toEqual(ids([jeep]));
    expect(ids(filterRows(all, { type: "all", query: "main", categoryId: "" }))).toEqual(ids([pay]));
    expect(filterRows(all, { type: "all", query: "zzz", categoryId: "" })).toEqual([]);
  });

  it("finds a card purchase by the card's name", () => {
    const onCard = row({ type: "expense", amount: 1, card: { name: "BPI card" } });
    expect(ids(filterRows([...all, onCard], { type: "all", query: "bpi", categoryId: "" }))).toEqual(ids([onCard]));
  });

  it("filters by category, combined with the chip", () => {
    expect(ids(filterRows(all, { type: "spending", query: "", categoryId: "food" }))).toEqual(ids([lunch, groceries]));
    expect(filterRows(all, { type: "income", query: "", categoryId: "food" })).toEqual([]);
  });
});

describe("dayHeading", () => {
  it("says Today for today, else the date, with the year when it differs", () => {
    expect(dayHeading("2026-11-23", "2026-11-23")).toBe("Today, Nov 23");
    expect(dayHeading("2026-11-22", "2026-11-23")).toBe("Nov 22");
    expect(dayHeading("2025-12-30", "2026-01-02")).toBe("Dec 30, 2025");
  });
});

describe("resolvePeriod: the ?period= in the URL", () => {
  const limits = { today: "2026-11-23", firstStart: "2026-10-15" };

  it("is the current period when missing or not a real date", () => {
    expect(resolvePeriod(undefined, semi, limits).start).toBe("2026-11-15");
    expect(resolvePeriod("nope", semi, limits).start).toBe("2026-11-15");
    expect(resolvePeriod("2026-02-30", semi, limits).start).toBe("2026-11-15");
  });

  it("snaps any day to the period that contains it", () => {
    expect(resolvePeriod("2026-11-03", semi, limits)).toEqual({ start: "2026-10-30", end: "2026-11-14", paySlot: "payday_2", firstDay: "2026-10-30" });
  });

  it("keeps to the first period through the current one", () => {
    expect(resolvePeriod("2026-12-15", semi, limits).start).toBe("2026-11-15");
    expect(resolvePeriod("2026-09-01", semi, limits).start).toBe("2026-10-15");
  });
});

describe("periodNav: the period bar's arrows", () => {
  const limits = { today: "2026-11-23", firstStart: "2026-10-30" };

  it("goes back to the first period and forward to the current one", () => {
    expect(periodNav({ start: "2026-11-15", end: "2026-11-29" }, semi, limits)).toEqual({
      prev: "2026-10-30",
      next: null,
    });
    expect(periodNav({ start: "2026-10-30", end: "2026-11-14" }, semi, limits)).toEqual({
      prev: null,
      next: "2026-11-15",
    });
  });
});

describe("Activity with a period started early (Task D2, owner Nov 28)", () => {
  // The Nov 30 period started early, on Nov 28; today is Nov 28.
  const early = { "2026-11-30": "2026-11-28" };
  const limits = { today: "2026-11-28", firstStart: "2026-10-30" };

  it("shows the started-early period as the current one", () => {
    expect(resolvePeriod(undefined, semi, limits, early)).toEqual({
      start: "2026-11-30", end: "2026-12-14", paySlot: "payday_2", firstDay: "2026-11-28",
    });
    expect(resolvePeriod("2026-11-20", semi, limits, early)).toMatchObject({ start: "2026-11-15", end: "2026-11-27" });
  });

  it("steps between the shortened period and the early one", () => {
    expect(periodNav({ start: "2026-11-15", end: "2026-11-27", firstDay: "2026-11-15" }, semi, limits, early)).toEqual({
      prev: "2026-10-30",
      next: "2026-11-30",
    });
    expect(periodNav({ start: "2026-11-30", end: "2026-12-14", firstDay: "2026-11-28" }, semi, limits, early)).toEqual({
      prev: "2026-11-15",
      next: null,
    });
  });
});
