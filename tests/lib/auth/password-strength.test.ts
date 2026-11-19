import { describe, expect, it } from "vitest";
import { passwordStrength } from "@/lib/auth/password-strength";

describe("passwordStrength", () => {
  it("shows no level while the field is empty", () => {
    expect(passwordStrength("")).toEqual({
      score: 0,
      level: null,
      hasMinLength: false,
      hasNumber: false,
    });
  });

  it("is Weak without a number, however long", () => {
    const result = passwordStrength("abcdefghijklmnop");
    expect(result.level).toBe("Weak");
    expect(result.hasMinLength).toBe(true);
    expect(result.hasNumber).toBe(false);
  });

  it("is Weak under 8 characters, even with a number and symbols", () => {
    expect(passwordStrength("Ab1!").level).toBe("Weak");
  });

  it("is Okay when it meets the rules but is short and plain", () => {
    const result = passwordStrength("abcdefg1");
    expect(result.level).toBe("Okay");
    expect(result.score).toBe(2);
  });

  it("is Okay at 12+ characters without mixed case or a symbol", () => {
    expect(passwordStrength("abcdefghijk1").level).toBe("Okay");
  });

  it("is Okay with mixed case but under 12 characters", () => {
    expect(passwordStrength("Abcdefg1").level).toBe("Okay");
  });

  it("is Strong at 12+ characters with mixed case", () => {
    const result = passwordStrength("Abcdefghijk1");
    expect(result.level).toBe("Strong");
    expect(result.score).toBe(4);
  });

  it("is Strong at 12+ characters with a symbol instead of mixed case", () => {
    expect(passwordStrength("abcdefghij1!").level).toBe("Strong");
  });
});
