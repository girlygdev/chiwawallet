import { z } from "zod";

// Shared by the sign-up form (browser) and its Server Action (server),
// so both check exactly the same rules. Messages follow auth-screens.md.

export const emailSchema = z
  .string()
  .trim()
  .min(1, "Enter your email.")
  .pipe(z.email("Enter a valid email, like you@example.com."));

// "At least 8 characters, with a number." Must match Supabase Auth's password settings.
export const newPasswordSchema = z
  .string()
  .min(8, "Use at least 8 characters.")
  .max(72, "Use 72 characters or fewer.") // Supabase's bcrypt hashing ignores anything past 72 bytes
  .regex(/\d/, "Add at least one number.");

export const signUpSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(1, "Tell us what to call you.")
    .max(40, "Keep it to 40 characters or fewer."),
  email: emailSchema,
  password: newPasswordSchema,
  // The DPA consent record: must be ticked, never pre-ticked.
  // A boolean (not z.literal(true)) so the form can start unticked with `false`.
  consent: z.boolean().refine((v) => v, "Please agree to the Privacy Notice and Terms."),
});

export type SignUpInput = z.infer<typeof signUpSchema>;
