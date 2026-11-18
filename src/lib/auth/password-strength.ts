// Password strength for the Set new password panel (auth-screens.md).
// A rough guide for the user, not a security check: the real rules are the
// Zod schema (8+ characters with a number) and Supabase's own settings.

export type StrengthLevel = "Weak" | "Okay" | "Strong";

export type PasswordStrength = {
  score: 0 | 1 | 2 | 3 | 4; // how many of the 4 meter segments are filled
  level: StrengthLevel | null; // null while the field is empty
  hasMinLength: boolean;
  hasNumber: boolean;
};

export function passwordStrength(password: string): PasswordStrength {
  const hasMinLength = password.length >= 8;
  const hasNumber = /\d/.test(password);
  const isLong = password.length >= 12;
  // Upper and lower case letters, or any symbol.
  const hasMix =
    (/[a-z]/.test(password) && /[A-Z]/.test(password)) || /[^A-Za-z0-9]/.test(password);

  const score = [hasMinLength, hasNumber, isLong, hasMix].filter(Boolean).length as PasswordStrength["score"];

  let level: StrengthLevel | null = null;
  if (password.length > 0) {
    // Below the minimum rules it's always Weak, however long it is.
    level = !hasMinLength || !hasNumber ? "Weak" : score === 4 ? "Strong" : "Okay";
  }

  return { score, level, hasMinLength, hasNumber };
}
