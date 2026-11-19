// Light, dark or match the device (settings.md "Appearance", profiles.theme).
// The choice is kept on the device (localStorage) so it applies before the
// page draws, even when logged out; logged-in users also save it to their
// profile so it follows them to other devices.

export const THEMES = ["light", "dark", "system"] as const;
export type Theme = (typeof THEMES)[number];

export const THEME_STORAGE_KEY = "chiwawallet-theme";

export function isTheme(value: unknown): value is Theme {
  return typeof value === "string" && (THEMES as readonly string[]).includes(value);
}

/** What actually shows: "system" becomes light or dark from the device setting. */
export function resolveTheme(theme: Theme, deviceDark: boolean): "light" | "dark" {
  if (theme === "system") return deviceDark ? "dark" : "light";
  return theme;
}

/**
 * Runs in <head> before anything draws, so a dark-mode user never sees a
 * white flash. It can't import code, so it repeats resolveTheme() in plain JS
 * (tests check they agree). try/catch: storage can be blocked (private
 * browsing), and the page must still load, in the device's theme.
 */
export const THEME_SCRIPT = `(function () {
  var theme = "system";
  try {
    var saved = localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});
    if (saved === "light" || saved === "dark" || saved === "system") theme = saved;
  } catch (e) {}
  var dark = theme === "dark" || (theme === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
  document.documentElement.style.colorScheme = dark ? "dark" : "light";
})();`;
