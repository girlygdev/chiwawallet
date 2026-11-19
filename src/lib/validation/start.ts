import { z } from "zod";
import { parsePesoInput } from "@/lib/money";

// Onboarding step 3 "Starting point" (onboarding.md §5). Shared by the form
// and its Server Action.

const BALANCE_MESSAGE = "Enter what you have right now. ₱0 is fine.";

export const startSchema = z.object({
  // Typed text → centavos. ₱0 and negative amounts are real answers
  // (plan review 3.1), so there's no minimum.
  openingBalance: z.string().transform((text, ctx) => {
    const centavos = parsePesoInput(text);
    if (centavos == null) {
      ctx.addIssue({ code: "custom", message: BALANCE_MESSAGE });
      return z.NEVER;
    }
    return centavos;
  }),
  // "Has your Nov 15 pay already arrived?" (plan review 3.14).
  payReceived: z.enum(["yes", "no"], { error: "Pick yes or no." }).transform((answer) => answer === "yes"),
});

export type StartFormInput = z.input<typeof startSchema>;
export type StartValues = z.output<typeof startSchema>;
