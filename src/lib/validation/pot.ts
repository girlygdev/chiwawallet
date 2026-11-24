import { z } from "zod";
import { parsePesoInput } from "@/lib/money";
import { CATEGORY_COLORS } from "@/lib/validation/category";

// New and Edit pot (savings.md §4). Shared by the form and its Server Actions.
// Money arrives as typed text and leaves as integer centavos.

/**
 * The pot icons: the spec's 6, plus calendar-clock for the default Sinking
 * Funds pot (4a-2). Lucide name and its label.
 */
export const POT_ICONS = [
  { name: "laptop", label: "Laptop" },
  { name: "life-buoy", label: "Emergency" },
  { name: "plane", label: "Travel" },
  { name: "house", label: "Home" },
  { name: "gift", label: "Gift" },
  { name: "graduation-cap", label: "School" },
  { name: "calendar-clock", label: "Planned costs" },
] as const;

export const POT_PAY_SLOTS = ["payday_1", "payday_2", "every"] as const;

type IconName = (typeof POT_ICONS)[number]["name"];
type ColorName = (typeof CATEGORY_COLORS)[number]["name"];
const iconNames = POT_ICONS.map((i) => i.name) as [IconName, ...IconName[]];
const colorNames = CATEGORY_COLORS.map((c) => c.name) as [ColorName, ...ColorName[]];

const MONTH = /^(\d{4})-(0[1-9]|1[0-2])$/;

/** An optional peso field: "" is null, otherwise centavos (checked below). */
const optionalPesos = z.string().transform((text) => (text.trim() === "" ? null : parsePesoInput(text)));

/**
 * Twice-a-month budgets pick payday 1, payday 2 or every payday (no split,
 * plan review 3.8). Weekly and monthly budgets have one payday: always every.
 */
export function potSchemaFor(budgetFrequency: string) {
  const onePayday = budgetFrequency !== "semi_monthly";
  return z
    .object({
      name: z.string().trim().min(1, "Name this pot, like Laptop fund.").max(40, "Keep it to 40 characters or fewer."),
      icon: z.enum(iconNames, { error: "Pick an icon." }),
      color: z.enum(colorNames, { error: "Pick a colour." }),
      // Each is text as typed; "" means empty.
      target: z.string(),
      targetMonth: z.string(),
      startingBalance: z.string(),
      contribution: z.string(),
      paySlot: z.enum(POT_PAY_SLOTS, { error: "Pick which payday it saves from." }),
      isLocked: z.boolean(),
    })
    .superRefine((v, ctx) => {
      const issue = (path: string, message: string) => ctx.addIssue({ code: "custom", path: [path], message });

      const target = optionalPesos.parse(v.target);
      if (v.target.trim() !== "" && target == null) issue("target", "Enter an amount, like 40,000.");
      else if (target != null && target <= 0) issue("target", "Enter a target above ₱0, or leave it empty.");

      if (v.targetMonth !== "" && !MONTH.test(v.targetMonth)) issue("targetMonth", "Pick a month.");

      const starting = optionalPesos.parse(v.startingBalance);
      if (v.startingBalance.trim() !== "" && starting == null) issue("startingBalance", "Enter an amount, like 5,000.");
      else if (starting != null && starting < 0) issue("startingBalance", "Enter ₱0 or more.");

      // Required, but ₱0 is fine: the default pots start at ₱0 (4a-2).
      const contribution = optionalPesos.parse(v.contribution);
      if (contribution == null) issue("contribution", "Enter how much to save each time, or 0.");
      else if (contribution < 0) issue("contribution", "Enter ₱0 or more.");

      if (onePayday && v.paySlot !== "every") issue("paySlot", "This budget has one payday, so it saves from every payday.");
    })
    // The checks above passed, so every parse below gives a number or null.
    .transform(({ targetMonth, ...v }) => ({
      name: v.name,
      icon: v.icon,
      color: v.color,
      target: optionalPesos.parse(v.target),
      // Stored as the 1st of the month (the database checks that).
      targetDate: targetMonth === "" ? null : `${targetMonth}-01`,
      startingBalance: optionalPesos.parse(v.startingBalance) ?? 0,
      contribution: optionalPesos.parse(v.contribution)!,
      paySlot: v.paySlot,
      isLocked: v.isLocked,
    }));
}

export type PotFormInput = z.input<ReturnType<typeof potSchemaFor>>;
export type PotValues = z.output<ReturnType<typeof potSchemaFor>>;
