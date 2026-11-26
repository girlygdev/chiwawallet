import { z } from "zod";
import { parsePesoInput } from "@/lib/money";

// New and Edit category (more-and-categories.md §2). Shared by the form and
// its Server Actions. "Budget per payday" (5g-1) is saved as
// categories.default_budget; generatePlan() copies it into each period.

export const BUDGET_GROUPS = ["needs", "wants", "savings_debt"] as const;

/**
 * The icons offered: the spec's 20 in its order, then the 4 added with the
 * Nov 24 defaults (Meals, Groceries, Market, Subscriptions). Lucide name and
 * its label. Every default category's icon must be here, or Edit can't save it.
 */
export const CATEGORY_ICONS = [
  { name: "paw-print", label: "Pet" },
  { name: "shopping-basket", label: "Groceries" },
  { name: "house", label: "Home" },
  { name: "zap", label: "Electricity" },
  { name: "droplet", label: "Water" },
  { name: "wifi", label: "Internet" },
  { name: "smartphone", label: "Phone" },
  { name: "heart-pulse", label: "Health" },
  { name: "pill", label: "Medicine" },
  { name: "graduation-cap", label: "School" },
  { name: "gift", label: "Gifts" },
  { name: "plane", label: "Travel" },
  { name: "car", label: "Car" },
  { name: "fuel", label: "Gas" },
  { name: "coffee", label: "Coffee" },
  { name: "shirt", label: "Clothes" },
  { name: "gamepad-2", label: "Games" },
  { name: "dumbbell", label: "Fitness" },
  { name: "scissors", label: "Grooming" },
  { name: "baby", label: "Kids" },
  { name: "utensils", label: "Meals" },
  { name: "shopping-cart", label: "Cart" },
  { name: "store", label: "Store" },
  { name: "tv", label: "TV" },
] as const;

/** The six colours, matching the database check and the cat-* tokens. */
export const CATEGORY_COLORS = [
  { name: "orange", label: "Orange" },
  { name: "blue", label: "Blue" },
  { name: "purple", label: "Purple" },
  { name: "yellow", label: "Yellow" },
  { name: "red", label: "Red" },
  { name: "green", label: "Green" },
] as const;

type IconName = (typeof CATEGORY_ICONS)[number]["name"];
type ColorName = (typeof CATEGORY_COLORS)[number]["name"];

const iconNames = CATEGORY_ICONS.map((i) => i.name) as [IconName, ...IconName[]];
const colorNames = CATEGORY_COLORS.map((c) => c.name) as [ColorName, ...ColorName[]];

export const categorySchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Name this category, like Food.")
    .max(30, "Keep it to 30 characters or fewer."),
  budgetGroup: z.enum(BUDGET_GROUPS, { error: "Pick a group." }),
  icon: z.enum(iconNames, { error: "Pick an icon." }),
  color: z.enum(colorNames, { error: "Pick a colour." }),
  /** Optional, as typed ("3,000"): empty means no budget (null), else centavos above 0. */
  budgetPerPayday: z
    .string()
    .optional()
    .transform((text, ctx) => {
      if (!text?.trim()) return null;
      const centavos = parsePesoInput(text);
      if (centavos == null || centavos <= 0) {
        ctx.addIssue({ code: "custom", message: "Enter an amount above ₱0, or leave it empty." });
        return z.NEVER;
      }
      return centavos;
    }),
});

export type CategoryFormInput = z.input<typeof categorySchema>;
export type CategoryValues = z.output<typeof categorySchema>;

/** The unique-name error (the database ignores case and outer spaces). */
export const duplicateNameMessage = (name: string) => `You already have a category called ${name.trim()}.`;
