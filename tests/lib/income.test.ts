import { describe, expect, it } from "vitest";
import {
  describeIncome,
  expectedForPeriod,
  expectedForSlot,
  expectedIncome,
  incomeImpact,
  isActiveOn,
  monthlyAmount,
  receivedSourceIds,
  removalImpact,
  sourcePayday,
  sourceScheduleLine,
  upcomingPaydays,
} from "@/lib/income";

describe("removalImpact: the delete dialog's effect lines", () => {
  const semi: PaySchedule = { frequency: "semi_monthly", payDay1: 15, payDay2: 30 };
  const others = [{ amount: 2_500_000, pay_slot: "every" }];

  it("deleting a 30th-only source lowers the 30th and the month", () => {
    expect(removalImpact(others, { amount: 800_000, pay_slot: "payday_2" }, semi)).toEqual([
      { label: "30th payday", before: 3_300_000, after: 2_500_000 },
      { label: "Each month", before: 5_800_000, after: 5_000_000 },
    ]);
  });

  it("deleting the only source takes everything to ₱0", () => {
    expect(removalImpact([], { amount: 3_000_000, pay_slot: "every" }, { frequency: "monthly", payDay1: 30 })).toEqual([
      { label: "Each month", before: 3_000_000, after: 0 },
    ]);
  });
});

describe("isActiveOn: a source counts from its start date to its end date", () => {
  const source = { amount: 1, pay_slot: "every", start_date: "2026-11-15", end_date: "2026-12-15" };
  it.each([
    ["2026-11-14", false],
    ["2026-11-15", true],
    ["2026-12-15", true],
    ["2026-12-16", false],
  ])("%s → %s", (date, active) => {
    expect(isActiveOn(source, date)).toBe(active);
  });

  it("no end date: active from the start on", () => {
    expect(isActiveOn({ ...source, end_date: null }, "2030-01-01")).toBe(true);
  });
});

describe("expectedForPeriod and upcomingPaydays", () => {
  const semi: PaySchedule = { frequency: "semi_monthly", payDay1: 15, payDay2: 30 };
  const sources = [
    { amount: 2_500_000, pay_slot: "every", start_date: "2026-11-15", end_date: null },
    // Freelance on the 30th, which stops after Dec 15.
    { amount: 800_000, pay_slot: "payday_2", start_date: "2026-11-15", end_date: "2026-12-15" },
    // A new job that starts in December.
    { amount: 100_000, pay_slot: "payday_1", start_date: "2026-12-15", end_date: null },
  ];

  it("counts only sources active on the period's payday", () => {
    expect(expectedForPeriod(sources, semi, { start: "2026-11-30", paySlot: "payday_2" })).toBe(3_300_000);
    expect(expectedForPeriod(sources, semi, { start: "2026-12-15", paySlot: "payday_1" })).toBe(2_600_000);
    expect(expectedForPeriod(sources, semi, { start: "2026-12-30", paySlot: "payday_2" })).toBe(2_500_000);
  });

  it("lists the next paydays from the current period on", () => {
    expect(upcomingPaydays("2026-11-19", semi, sources, 4)).toEqual([
      { date: "2026-11-15", label: "15th", total: 2_500_000, current: true },
      { date: "2026-11-30", label: "30th", total: 3_300_000, current: false },
      { date: "2026-12-15", label: "15th", total: 2_600_000, current: false },
      { date: "2026-12-30", label: "30th", total: 2_500_000, current: false },
    ]);
  });
});

describe("monthlyAmount and sourceScheduleLine", () => {
  const semi: PaySchedule = { frequency: "semi_monthly", payDay1: 15, payDay2: 30 };

  it("twice a month: every payday counts twice, one payday once", () => {
    expect(monthlyAmount({ amount: 2_500_000, pay_slot: "every" }, semi)).toBe(5_000_000);
    expect(monthlyAmount({ amount: 800_000, pay_slot: "payday_2" }, semi)).toBe(800_000);
    expect(sourceScheduleLine({ amount: 2_500_000, pay_slot: "every" }, semi)).toBe(
      "Every payday · ₱50,000 a month",
    );
    expect(sourceScheduleLine({ amount: 800_000, pay_slot: "payday_2" }, semi)).toBe("30th only · ₱8,000 a month");
  });

  it("monthly and weekly", () => {
    expect(monthlyAmount({ amount: 3_000_000, pay_slot: "every" }, { frequency: "monthly", payDay1: 30 })).toBe(
      3_000_000,
    );
    const weekly: PaySchedule = { frequency: "weekly", payWeekday: 5 };
    expect(monthlyAmount({ amount: 500_000, pay_slot: "every" }, weekly)).toBe(2_166_667);
    expect(sourceScheduleLine({ amount: 500_000, pay_slot: "every" }, weekly)).toBe(
      "Every payday · about ₱21,666.67 a month",
    );
  });
});

describe("expectedForSlot: income expected in one period", () => {
  const sources = [
    { amount: 2_500_000, pay_slot: "every" },
    { amount: 800_000, pay_slot: "payday_2" },
  ];
  const semi: PaySchedule = { frequency: "semi_monthly", payDay1: 15, payDay2: 30 };

  it("twice a month: the period's own payday", () => {
    expect(expectedForSlot(sources, semi, "payday_1")).toBe(2_500_000);
    expect(expectedForSlot(sources, semi, "payday_2")).toBe(3_300_000);
  });

  it("monthly and weekly: everything lands every period", () => {
    expect(expectedForSlot(sources, { frequency: "monthly", payDay1: 30 }, "every")).toBe(3_300_000);
    expect(expectedForSlot(sources, { frequency: "weekly", payWeekday: 5 }, "every")).toBe(3_300_000);
  });
});

describe("describeIncome: the onboarding rail's detail line", () => {
  it("counts sources and the month", () => {
    const semi: PaySchedule = { frequency: "semi_monthly", payDay1: 15, payDay2: 30 };
    expect(
      describeIncome([{ amount: 2_500_000, pay_slot: "every" }, { amount: 800_000, pay_slot: "payday_2" }], semi),
    ).toBe("2 sources · ₱58,000 a month");
    expect(describeIncome([{ amount: 2_500_000, pay_slot: "every" }], semi)).toBe("1 source · ₱50,000 a month");
  });

  it("weekly says about", () => {
    expect(describeIncome([{ amount: 500_000, pay_slot: "every" }], { frequency: "weekly", payWeekday: 5 })).toBe(
      "1 source · about ₱21,666.67 a month",
    );
  });
});
import type { PaySchedule } from "@/lib/periods";

const semi: PaySchedule = { frequency: "semi_monthly", payDay1: 15, payDay2: 30 };
const monthly: PaySchedule = { frequency: "monthly", payDay1: 30 };
const weekly: PaySchedule = { frequency: "weekly", payWeekday: 5 };

describe("expectedIncome", () => {
  it("twice a month: each payday gets its own sources plus 'every payday' ones", () => {
    const sources = [
      { amount: 2_500_000, pay_slot: "every" }, // main job, both paydays
      { amount: 800_000, pay_slot: "payday_2" }, // freelance, 30th only
    ];
    expect(expectedIncome(sources, semi)).toEqual({
      paydays: [
        { slot: "payday_1", label: "15th", total: 2_500_000 },
        { slot: "payday_2", label: "30th", total: 3_300_000 },
      ],
      perMonth: 5_800_000,
      perMonthIsEstimate: false,
    });
  });

  it("monthly: one payday, and a month is that payday", () => {
    expect(expectedIncome([{ amount: 3_000_000, pay_slot: "every" }], monthly)).toEqual({
      paydays: [{ slot: "every", label: "30th", total: 3_000_000 }],
      perMonth: 3_000_000,
      perMonthIsEstimate: false,
    });
  });

  it("weekly: a month is about 52 ÷ 12 weeks, rounded to the centavo", () => {
    expect(expectedIncome([{ amount: 500_000, pay_slot: "every" }], weekly)).toEqual({
      paydays: [{ slot: "every", label: "Fri", total: 500_000 }],
      perMonth: 2_166_667, // ₱5,000 × 52 ÷ 12 = ₱21,666.666…
      perMonthIsEstimate: true,
    });
  });

  it("no sources: zero everywhere", () => {
    expect(expectedIncome([], semi).perMonth).toBe(0);
  });
});

describe("incomeImpact: the before → after lines in the income form", () => {
  const existing = [{ amount: 2_500_000, pay_slot: "every" }];

  it("adding a 15th-only source changes the 15th and the month", () => {
    expect(incomeImpact(existing, { amount: 300_000, pay_slot: "payday_1" }, semi)).toEqual([
      { label: "15th payday", before: 2_500_000, after: 2_800_000 },
      { label: "Each month", before: 5_000_000, after: 5_300_000 },
    ]);
  });

  it("an every-payday source changes both paydays", () => {
    expect(incomeImpact(existing, { amount: 100_000, pay_slot: "every" }, semi)).toEqual([
      { label: "15th payday", before: 2_500_000, after: 2_600_000 },
      { label: "30th payday", before: 2_500_000, after: 2_600_000 },
      { label: "Each month", before: 5_000_000, after: 5_200_000 },
    ]);
  });

  it("weekly labels the month as an estimate", () => {
    const lines = incomeImpact([], { amount: 500_000, pay_slot: "every" }, weekly);
    expect(lines.at(-1)).toEqual({ label: "About each month", before: 0, after: 2_166_667 });
  });
});

describe("sourcePayday: the date on a source card in the add sheet", () => {
  const semi: PaySchedule = { frequency: "semi_monthly", payDay1: 15, payDay2: 30 };
  const main = { amount: 2_500_000, pay_slot: "every", start_date: "2026-11-01", end_date: null };
  const freelance = { amount: 800_000, pay_slot: "payday_2", start_date: "2026-11-01", end_date: null };

  it("gives this period's payday when the source pays in it", () => {
    expect(sourcePayday(main, semi, "2026-11-20")).toEqual({ date: "2026-11-15", thisPeriod: true });
  });

  it("gives the next payday when it doesn't", () => {
    expect(sourcePayday(freelance, semi, "2026-11-20")).toEqual({ date: "2026-11-30", thisPeriod: false });
  });

  it("waits for a source that starts later, even mid-period", () => {
    const newJob = { ...main, start_date: "2026-11-20" };
    expect(sourcePayday(newJob, semi, "2026-11-20")).toEqual({ date: "2026-11-30", thisPeriod: false });
  });

  it("is null for a source that has ended", () => {
    expect(sourcePayday({ ...main, end_date: "2026-11-10" }, semi, "2026-11-20")).toBeNull();
  });

  it("works for weekly and monthly budgets, where every source lands on the one payday", () => {
    const weekly: PaySchedule = { frequency: "weekly", payWeekday: 5 }; // Fridays
    // Fri Nov 20, 2026 is a payday.
    expect(sourcePayday(main, weekly, "2026-11-22")).toEqual({ date: "2026-11-20", thisPeriod: true });
    const monthly: PaySchedule = { frequency: "monthly", payDay1: 30 };
    expect(sourcePayday({ ...main, start_date: "2026-10-01" }, monthly, "2026-11-20")).toEqual({
      date: "2026-10-30",
      thisPeriod: true,
    });
    // Starting Nov 1 misses the Oct 30 payday, so it waits for Nov 30.
    expect(sourcePayday(main, monthly, "2026-11-20")).toEqual({ date: "2026-11-30", thisPeriod: false });
  });
});

describe("receivedSourceIds: the Received tag", () => {
  const semi: PaySchedule = { frequency: "semi_monthly", payDay1: 15, payDay2: 30 };
  const sources = [
    { id: "main", amount: 2_500_000, pay_slot: "every", start_date: "2026-11-01", end_date: null },
    { id: "freelance", amount: 800_000, pay_slot: "payday_2", start_date: "2026-11-01", end_date: null },
    { id: "allowance", amount: 300_000, pay_slot: "payday_1", start_date: "2026-11-01", end_date: null },
  ];
  const period = { start: "2026-11-15", paySlot: "payday_1" as const, first_pay_received: false };
  const income = (income_source_id: string | null, deleted_at: string | null = null) => ({
    type: "income",
    income_source_id,
    deleted_at,
  });

  it("marks sources with income logged this period, skipping deleted and one-time rows", () => {
    const rows = [income("allowance"), income("main", "2026-11-16T00:00:00Z"), income(null), { ...income("main"), type: "expense" }];
    expect(receivedSourceIds(rows, period, sources, semi)).toEqual(new Set(["allowance"]));
  });

  it("in the first period, counts the pay that onboarding said had arrived (3.14)", () => {
    const first = { ...period, first_pay_received: true };
    // Main and Allowance pay on the 15th; Freelance doesn't.
    expect(receivedSourceIds([], first, sources, semi)).toEqual(new Set(["main", "allowance"]));
  });
});
