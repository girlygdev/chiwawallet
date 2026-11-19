import { isTheme, resolveTheme, type Theme, THEME_STORAGE_KEY } from "@/lib/theme";

// Browser-only helpers shared by the toggle, the profile sync and the watcher.

const deviceDarkQuery = () => window.matchMedia("(prefers-color-scheme: dark)");

/** The saved choice on this device, or "system" if none (or storage is blocked). */
export function readStoredTheme(): Theme {
  try {
    const saved = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isTheme(saved) ? saved : "system";
  } catch {
    return "system";
  }
}

/** Saves the choice on this device and shows it right away. */
export function applyTheme(theme: Theme) {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Blocked storage: still switch for this visit.
  }
  showTheme(theme);
  // Tell other toggles on the page (sidebar and More can both be mounted).
  window.dispatchEvent(new CustomEvent("chiwawallet-theme", { detail: theme }));
}

/** Adds or removes the .dark class (globals.css) for a choice. */
export function showTheme(theme: Theme) {
  const dark = resolveTheme(theme, deviceDarkQuery().matches) === "dark";
  document.documentElement.classList.toggle("dark", dark);
  document.documentElement.style.colorScheme = dark ? "dark" : "light";
}

export { deviceDarkQuery };
