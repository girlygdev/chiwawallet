import { describe, expect, it } from "vitest";
import {
  consentSchema,
  emailSchema,
  logInSchema,
  setPasswordSchema,
  signUpSchema,
} from "@/lib/validation/auth";

// The first error message for a failed parse, or null if it passed.
function firstError(result: { success: boolean; error?: { issues: { message: string }[] } }) {
  return result.success ? null : (result.error?.issues[0]?.message ?? null);
}

const validSignUp = {
  displayName: "Ana",
  email: "ana@example.com",
  password: "chiwawa123",
  consent: true,
};

describe("emailSchema", () => {
  it("trims spaces around the email", () => {
    expect(emailSchema.parse("  ana@example.com ")).toBe("ana@example.com");
  });

  it("asks for an email when empty", () => {
    expect(firstError(emailSchema.safeParse("   "))).toBe("Enter your email.");
  });

  it("rejects an email without a domain", () => {
    expect(firstError(emailSchema.safeParse("ana@"))).toBe(
      "Enter a valid email, like you@example.com.",
    );
  });
});

describe("signUpSchema", () => {
  it("accepts a valid sign-up", () => {
    expect(signUpSchema.safeParse(validSignUp).success).toBe(true);
  });

  it("requires the consent box to be ticked", () => {
    expect(firstError(signUpSchema.safeParse({ ...validSignUp, consent: false }))).toBe(
      "Please confirm you're 18 or older and agree to the Privacy Notice and Terms.",
    );
  });

  it("requires a name that isn't only spaces", () => {
    expect(firstError(signUpSchema.safeParse({ ...validSignUp, displayName: "   " }))).toBe(
      "Tell us what to call you.",
    );
  });

  it("limits the name to 40 characters", () => {
    const result = signUpSchema.safeParse({ ...validSignUp, displayName: "a".repeat(41) });
    expect(firstError(result)).toBe("Keep it to 40 characters or fewer.");
  });

  it("requires passwords of at least 8 characters", () => {
    expect(firstError(signUpSchema.safeParse({ ...validSignUp, password: "abc1" }))).toBe(
      "Use at least 8 characters.",
    );
  });

  it("requires a number in the password", () => {
    expect(firstError(signUpSchema.safeParse({ ...validSignUp, password: "abcdefgh" }))).toBe(
      "Add at least one number.",
    );
  });

  it("rejects passwords over 72 characters", () => {
    const result = signUpSchema.safeParse({ ...validSignUp, password: `1${"a".repeat(72)}` });
    expect(firstError(result)).toBe("Use 72 characters or fewer.");
  });
});

describe("consentSchema", () => {
  it("only needs a name and consent", () => {
    expect(consentSchema.safeParse({ displayName: "Ana", consent: true }).success).toBe(true);
  });

  it("requires the consent box to be ticked", () => {
    expect(consentSchema.safeParse({ displayName: "Ana", consent: false }).success).toBe(false);
  });
});

describe("logInSchema", () => {
  it("accepts an old password that doesn't follow today's rules", () => {
    expect(logInSchema.safeParse({ email: "ana@example.com", password: "abc" }).success).toBe(true);
  });

  it("asks for a password when empty", () => {
    expect(firstError(logInSchema.safeParse({ email: "ana@example.com", password: "" }))).toBe(
      "Enter your password.",
    );
  });
});

describe("setPasswordSchema", () => {
  it("accepts matching passwords", () => {
    const result = setPasswordSchema.safeParse({
      password: "chiwawa123",
      confirmPassword: "chiwawa123",
      signOutOthers: true,
    });
    expect(result.success).toBe(true);
  });

  it("shows the mismatch under the confirm field", () => {
    const result = setPasswordSchema.safeParse({
      password: "chiwawa123",
      confirmPassword: "chiwawa124",
      signOutOthers: true,
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(["confirmPassword"]);
    expect(result.error?.issues[0]?.message).toBe("Passwords don't match.");
  });
});
