import { describe, expect, it } from "vitest";
import { potSchemaFor } from "@/lib/validation/pot";

const valid = {
  name: "Laptop fund",
  icon: "laptop",
  color: "blue",
  target: "40,000",
  targetMonth: "2027-06",
  startingBalance: "",
  contribution: "2,000",
  paySlot: "every",
  isLocked: false,
};

function errorsFor(frequency: string, input: Record<string, unknown>) {
  const result = potSchemaFor(frequency).safeParse({ ...valid, ...input });
  if (result.success) return {};
  return Object.fromEntries(result.error.issues.map((i) => [i.path[0], i.message]));
}

describe("potSchemaFor", () => {
  it("turns money into centavos and the month into its first day", () => {
    expect(potSchemaFor("semi_monthly").parse({ ...valid, name: " Laptop fund " })).toEqual({
      name: "Laptop fund",
      icon: "laptop",
      color: "blue",
      target: 4_000_000,
      targetDate: "2027-06-01",
      startingBalance: 0,
      contribution: 200_000,
      paySlot: "every",
      isLocked: false,
    });
  });

  it("target and target month are optional", () => {
    const parsed = potSchemaFor("semi_monthly").parse({ ...valid, target: "", targetMonth: "" });
    expect(parsed).toMatchObject({ target: null, targetDate: null });
  });

  it("checks the name, icon and colour", () => {
    expect(errorsFor("semi_monthly", { name: "" }).name).toBe("Name this pot, like Laptop fund.");
    expect(errorsFor("semi_monthly", { icon: "rocket" }).icon).toBe("Pick an icon.");
    expect(errorsFor("semi_monthly", { color: "pink" }).color).toBe("Pick a colour.");
  });

  it("the default pots' icons are offered", () => {
    expect(errorsFor("semi_monthly", { icon: "life-buoy" })).toEqual({});
    expect(errorsFor("semi_monthly", { icon: "calendar-clock" })).toEqual({});
  });

  it("checks the money fields", () => {
    expect(errorsFor("semi_monthly", { target: "0" }).target).toBe("Enter a target above ₱0, or leave it empty.");
    expect(errorsFor("semi_monthly", { target: "abc" }).target).toBe("Enter an amount, like 40,000.");
    expect(errorsFor("semi_monthly", { startingBalance: "-5" }).startingBalance).toBe("Enter ₱0 or more.");
    expect(errorsFor("semi_monthly", { contribution: "" }).contribution).toBe("Enter how much to save each time, or 0.");
    expect(errorsFor("semi_monthly", { contribution: "0" })).toEqual({});
  });

  it("checks the target month", () => {
    expect(errorsFor("semi_monthly", { targetMonth: "June 2027" }).targetMonth).toBe("Pick a month.");
    expect(errorsFor("semi_monthly", { targetMonth: "2027-13" }).targetMonth).toBe("Pick a month.");
  });

  it("no split: payday 1, payday 2 or every on twice-a-month budgets; only every otherwise", () => {
    for (const paySlot of ["payday_1", "payday_2", "every"]) {
      expect(errorsFor("semi_monthly", { paySlot })).toEqual({});
    }
    expect(errorsFor("semi_monthly", { paySlot: "split" }).paySlot).toBe("Pick which payday it saves from.");
    expect(errorsFor("monthly", { paySlot: "payday_2" }).paySlot).toBe(
      "This budget has one payday, so it saves from every payday.",
    );
  });
});
