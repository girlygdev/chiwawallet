import { describe, expect, it } from "vitest";
import { isTheme, resolveTheme, THEME_SCRIPT, THEME_STORAGE_KEY } from "@/lib/theme";

describe("resolveTheme", () => {
  it("light and dark ignore the device", () => {
    expect(resolveTheme("light", true)).toBe("light");
    expect(resolveTheme("dark", false)).toBe("dark");
  });

  it("system follows the device", () => {
    expect(resolveTheme("system", true)).toBe("dark");
    expect(resolveTheme("system", false)).toBe("light");
  });
});

describe("isTheme", () => {
  it("accepts only the three choices", () => {
    expect(isTheme("light")).toBe(true);
    expect(isTheme("system")).toBe(true);
    expect(isTheme("blue")).toBe(false);
    expect(isTheme(null)).toBe(false);
  });
});

// The script runs in <head> before React, so it can't import anything. Run it
// against a fake page to check it sets the class the same way resolveTheme does.
describe("THEME_SCRIPT", () => {
  function run(stored: string | null, deviceDark: boolean, storageThrows = false) {
    const classes = new Set<string>();
    const html = {
      classList: { toggle: (name: string, on: boolean) => (on ? classes.add(name) : classes.delete(name)) },
      style: { colorScheme: "" },
    };
    const localStorage = {
      getItem: (key: string) => {
        if (storageThrows) throw new Error("blocked");
        return key === THEME_STORAGE_KEY ? stored : null;
      },
    };
    const matchMedia = () => ({ matches: deviceDark });
    new Function("document", "localStorage", "matchMedia", THEME_SCRIPT)(
      { documentElement: html },
      localStorage,
      matchMedia,
    );
    return { dark: classes.has("dark"), colorScheme: html.style.colorScheme };
  }

  it.each([
    ["dark", false, true],
    ["light", true, false],
    ["system", true, true],
    ["system", false, false],
    [null, true, true], // nothing saved yet: match the device
    ["nonsense", false, false],
  ] as const)("saved %s, device dark %s → dark %s", (stored, deviceDark, dark) => {
    const result = run(stored, deviceDark);
    expect(result.dark).toBe(dark);
    expect(result.colorScheme).toBe(dark ? "dark" : "light");
  });

  it("doesn't break the page when storage is blocked", () => {
    expect(() => run(null, true, true)).not.toThrow();
  });
});
