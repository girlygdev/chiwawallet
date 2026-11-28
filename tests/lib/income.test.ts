import { describe, expect, it } from "vitest";
import {
  describeIncome,
  expectedForPeriod,
  expectedForSlot,
  expectedIncome,
  incomeImpact,
  incomeResult,
  isActiveOn,
  monthlyAmount,
  duePay,
  earlyPay,
  earlyPayLine,
  receivedOn,
  receivedSourceIds,
  removalImpact,
  sourcePayday,
  sourceScheduleLine,
  sourceStatusLines,
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
      { date: "2026-11-15", label: "15th", total: 2_500_000, current: true, received: false },
      { date: "2026-11-30", label: "30th", total: 3_300_000, current: false, received: false },
      { date: "2026-12-15", label: "15th", total: 2_600_000, current: false, received: false },
      { date: "2026-12-30", label: "30th", total: 2_500_000, current: false, received: false },
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

describe("upcomingPaydays: Received on the current payday", () => {
  const semi: PaySchedule = { frequency: "semi_monthly", payDay1: 15, payDay2: 30 };
  const sources = [
    { id: "main", amount: 2_500_000, pay_slot: "every", start_date: "2026-11-01", end_date: null },
    { id: "allowance", amount: 300_000, pay_slot: "payday_1", start_date: "2026-11-01", end_date: null },
    { id: "freelance", amount: 800_000, pay_slot: "payday_2", start_date: "2026-11-01", end_date: null },
  ];

  it("is Received only when every source paying this payday is logged", () => {
    const some = upcomingPaydays("2026-11-20", semi, sources, 2, new Set(["main"]));
    expect(some.map((p) => p.received)).toEqual([false, false]);
    // Freelance doesn't pay on the 15th, so it isn't needed.
    const all = upcomingPaydays("2026-11-20", semi, sources, 2, new Set(["main", "allowance"]));
    expect(all.map((p) => p.received)).toEqual([true, false]);
  });

  it("isn't Received when nothing pays this payday", () => {
    expect(upcomingPaydays("2026-11-20", semi, [sources[2]], 1, new Set(["freelance"]))[0].received).toBe(false);
  });
});

describe("receivedOn: when each source's pay arrived this period", () => {
  const semi: PaySchedule = { frequency: "semi_monthly", payDay1: 15, payDay2: 30 };
  const sources = [
    { id: "main", amount: 2_500_000, pay_slot: "every", start_date: "2026-11-01", end_date: null },
    { id: "freelance", amount: 800_000, pay_slot: "payday_2", start_date: "2026-11-01", end_date: null },
  ];
  const period = { start: "2026-11-15", paySlot: "payday_1" as const, first_pay_received: false };
  const row = (income_source_id: string, date: string, extra = {}) => ({
    type: "income",
    income_source_id,
    date,
    deleted_at: null,
    ...extra,
  });

  it("gives the latest live date per source", () => {
    const rows = [
      row("main", "2026-11-15"),
      row("main", "2026-11-17"),
      row("freelance", "2026-11-20", { deleted_at: "2026-11-20T00:00:00Z" }),
    ];
    expect(receivedOn(rows, period, sources, semi)).toEqual(new Map([["main", "2026-11-17"]]));
  });

  it("uses the payday for pay onboarding counted (3.14), unless it was also logged", () => {
    const first = { ...period, first_pay_received: true };
    expect(receivedOn([], first, sources, semi)).toEqual(new Map([["main", "2026-11-15"]]));
    expect(receivedOn([row("main", "2026-11-16")], first, sources, semi)).toEqual(new Map([["main", "2026-11-16"]]));
  });
});

describe("sourceStatusLines: the source card's status lines", () => {
  const semi: PaySchedule = { frequency: "semi_monthly", payDay1: 15, payDay2: 30 };
  const main = { amount: 2_500_000, pay_slot: "every", start_date: "2026-11-01", end_date: null };
  const freelance = { amount: 800_000, pay_slot: "payday_2", start_date: "2026-11-01", end_date: null };

  it("shows this period's payday, received or expected, then the next one", () => {
    expect(sourceStatusLines(main, semi, "2026-11-23", "2026-11-16")).toEqual([
      { text: "15th: Received Nov 16", tone: "positive" },
      { text: "30th: Expected Nov 30", tone: "neutral" },
    ]);
    expect(sourceStatusLines(main, semi, "2026-11-23", null)).toEqual([
      { text: "15th: Expected Nov 15", tone: "neutral" },
      { text: "30th: Expected Nov 30", tone: "neutral" },
    ]);
  });

  it("shows only the next payday for a source that doesn't pay this period", () => {
    expect(sourceStatusLines(freelance, semi, "2026-11-23", null)).toEqual([
      { text: "30th: Expected Nov 30", tone: "neutral" },
    ]);
  });

  it("shows nothing next for a source that ends this period", () => {
    expect(sourceStatusLines({ ...main, end_date: "2026-11-20" }, semi, "2026-11-18", null)).toEqual([
      { text: "15th: Expected Nov 15", tone: "neutral" },
    ]);
  });

  it("uses the weekday on weekly budgets", () => {
    const weekly: PaySchedule = { frequency: "weekly", payWeekday: 5 };
    expect(sourceStatusLines(main, weekly, "2026-11-23", null)).toEqual([
      { text: "Fri: Expected Nov 20", tone: "neutral" },
      { text: "Fri: Expected Nov 27", tone: "neutral" },
    ]);
  });
});

describe("incomeResult: the Recently received result line", () => {
  it("compares what arrived with what was expected", () => {
    expect(incomeResult(2_500_000, 2_500_000)).toEqual({ text: "Received as expected", tone: "positive" });
    expect(incomeResult(2_450_000, 2_500_000)).toEqual({ text: "₱500 less than expected", tone: "warn" });
    expect(incomeResult(2_550_050, 2_500_000)).toEqual({ text: "₱500.50 more than expected", tone: "positive" });
  });
});

describe("duePay: the empty state's I got paid button", () => {
  const semi: PaySchedule = { frequency: "semi_monthly", payDay1: 15, payDay2: 30 };
  const sources = [
    { id: "freelance", name: "Freelance", amount: 800_000, pay_slot: "payday_2", start_date: "2026-11-01", end_date: null },
    { id: "main", name: "Main job", amount: 2_500_000, pay_slot: "every", start_date: "2026-11-01", end_date: null },
    { id: "allowance", name: "Allowance", amount: 300_000, pay_slot: "payday_1", start_date: "2026-11-01", end_date: null },
  ];

  it("is the first source paying this period that isn't logged yet", () => {
    expect(duePay(sources, new Set(), semi, "2026-11-20")?.id).toBe("main");
    expect(duePay(sources, new Set(["main"]), semi, "2026-11-20")?.id).toBe("allowance");
  });

  it("is null when everything due is logged, or nothing pays this period", () => {
    expect(duePay(sources, new Set(["main", "allowance"]), semi, "2026-11-20")).toBeNull();
    expect(duePay([sources[0]], new Set(), semi, "2026-11-20")).toBeNull();
  });
});

describe("earlyPayLine: the Paid early? panel", () => {
  const a = { name: "Company A", amount: 2_500_000 };
  const b = { name: "Freelance", amount: 800_000 };

  it("names one source, or counts several", () => {
    expect(earlyPayLine({ payday: "2026-11-30", sources: [a] })).toBe("₱25,000 from Company A is due Nov 30.");
    expect(earlyPayLine({ payday: "2026-11-30", sources: [a, b] })).toBe("₱33,000 from 2 sources is due Nov 30.");
  });
});

describe("earlyPay: Paid early? (owner, Nov 28)", () => {
  const semi: PaySchedule = { frequency: "semi_monthly", payDay1: 15, payDay2: 30 };
  const sources = [
    { id: "freelance", name: "Freelance", amount: 800_000, pay_slot: "payday_2", start_date: "2026-11-01", end_date: null },
    { id: "main", name: "Company A", amount: 2_500_000, pay_slot: "every", start_date: "2026-11-01", end_date: null },
    { id: "allowance", name: "Allowance", amount: 300_000, pay_slot: "payday_1", start_date: "2026-11-01", end_date: null },
  ];
  const pay = (income_source_id: string, date = "2026-11-30", extra: object = {}) => ({
    type: "income",
    income_source_id,
    date,
    deleted_at: null as string | null,
    ...extra,
  });
  const ids = (result: ReturnType<typeof earlyPay>) => result?.sources.map((s) => s.id);

  it("lists the next payday's sources from 5 days before it", () => {
    // Nov 30 is the next payday; Allowance pays on the 15th only.
    expect(earlyPay(sources, [], semi, "2026-11-25")).toEqual({ payday: "2026-11-30", sources: [sources[0], sources[1]] });
    expect(ids(earlyPay(sources, [], semi, "2026-11-29"))).toEqual(["freelance", "main"]);
  });

  it("is null more than 5 days before the payday", () => {
    expect(earlyPay(sources, [], semi, "2026-11-24")).toBeNull();
    expect(earlyPay(sources, [], semi, "2026-11-16")).toBeNull();
  });

  it("drops sources already logged for that payday, and is null once all are", () => {
    expect(ids(earlyPay(sources, [pay("main")], semi, "2026-11-28"))).toEqual(["freelance"]);
    expect(earlyPay(sources, [pay("main"), pay("freelance")], semi, "2026-11-28")).toBeNull();
  });

  it("ignores deleted rows, other types and pay from another period", () => {
    const rows = [
      pay("main", "2026-11-30", { deleted_at: "2026-11-28T10:00:00Z" }),
      pay("main", "2026-11-30", { type: "expense" }),
      // This period's pay (Nov 15) doesn't count for Nov 30.
      pay("main", "2026-11-15"),
    ];
    expect(ids(earlyPay(sources, rows, semi, "2026-11-28"))).toEqual(["freelance", "main"]);
  });

  it("skips a source that hasn't started by the payday or has ended", () => {
    const later = [
      { ...sources[0], start_date: "2026-12-01" },
      { ...sources[1], end_date: "2026-11-29" },
    ];
    expect(earlyPay(later, [], semi, "2026-11-28")).toBeNull();
  });

  it("works for a month-end payday that moves (Feb 28) and for monthly budgets", () => {
    // The 30th in February is the 28th (2027): from Feb 23.
    expect(earlyPay(sources, [], semi, "2027-02-23")?.payday).toBe("2027-02-28");
    expect(earlyPay(sources, [], semi, "2027-02-22")).toBeNull();
    const monthly: PaySchedule = { frequency: "monthly", payDay1: 1 };
    expect(earlyPay(sources, [], monthly, "2026-11-27")).toEqual({ payday: "2026-12-01", sources });
  });
});

describe("income after the next period started early (Task D2, owner Nov 28)", () => {
  const semi: PaySchedule = { frequency: "semi_monthly", payDay1: 15, payDay2: 30 };
  const sources = [
    { id: "freelance", name: "Freelance", amount: 800_000, pay_slot: "payday_2", start_date: "2026-11-01", end_date: null },
    { id: "main", name: "Company A", amount: 2_500_000, pay_slot: "every", start_date: "2026-11-01", end_date: null },
    { id: "allowance", name: "Allowance", amount: 300_000, pay_slot: "payday_1", start_date: "2026-11-01", end_date: null },
  ];
  // The Nov 30 period started on Nov 28; today is Nov 28.
  const early = { "2026-11-30": "2026-11-28" };

  it("duePay() looks at the Nov 30 payday, not the 15th", () => {
    // Company A came early; Freelance is still due on the 30th.
    expect(duePay(sources, new Set(["main"]), semi, "2026-11-28", early)?.id).toBe("freelance");
    expect(duePay(sources, new Set(["main", "freelance"]), semi, "2026-11-28", early)).toBeNull();
  });

  it("earlyPay() has nothing to offer: the next payday is Dec 15", () => {
    expect(earlyPay(sources, [], semi, "2026-11-28", early)).toBeNull();
  });

  it("upcomingPaydays() and sourceStatusLines() start from the Nov 30 payday", () => {
    expect(upcomingPaydays("2026-11-28", semi, sources, 2, new Set(), early).map((p) => p.date)).toEqual(["2026-11-30", "2026-12-15"]);
    expect(sourceStatusLines(sources[0], semi, "2026-11-28", null, early)[0].text).toBe("30th: Expected Nov 30");
  });

  it("sourcePayday() calls the Nov 30 payday this period's", () => {
    expect(sourcePayday(sources[0], semi, "2026-11-28", early)).toEqual({ date: "2026-11-30", thisPeriod: true });
  });
});
