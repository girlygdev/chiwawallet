"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useSyncExternalStore } from "react";
import { type Theme, THEME_STORAGE_KEY } from "@/lib/theme";
import { cn } from "@/lib/utils";
import { saveThemeToProfile } from "./actions";
import { applyTheme, readStoredTheme } from "./apply-theme";

const OPTIONS: { value: Theme; label: string; Icon: typeof Sun }[] = [
  { value: "light", label: "Light", Icon: Sun },
  { value: "dark", label: "Dark", Icon: Moon },
  { value: "system", label: "Match device", Icon: Monitor },
];

// Re-read the choice when it changes here (applyTheme's event: the other
// toggle or the profile sync) or in another tab (storage event).
function subscribe(onChange: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key === THEME_STORAGE_KEY) onChange();
  };
  window.addEventListener("chiwawallet-theme", onChange);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener("chiwawallet-theme", onChange);
    window.removeEventListener("storage", onStorage);
  };
}

/**
 * Light / Dark / Match device (settings.md "Appearance"). Applies right away,
 * saves on this device, and, when `saveToProfile` (logged-in pages), to the
 * profile too. "icons": the compact sidebar version; "labels": More and
 * Settings. Real radio buttons in a fieldset, so keyboards and screen readers
 * work without extra code.
 */
export function ThemeToggle({
  variant,
  saveToProfile = false,
  className,
}: {
  variant: "icons" | "labels";
  saveToProfile?: boolean;
  className?: string;
}) {
  // The device's saved choice, read like any outside store. On the server
  // (and the first browser render) it's undefined, so nothing is selected
  // until the real value is known; guessing would make the two renders disagree.
  const theme = useSyncExternalStore(subscribe, readStoredTheme, () => undefined);

  const choose = (next: Theme) => {
    applyTheme(next);
    if (saveToProfile) void saveThemeToProfile(next);
  };

  const icons = variant === "icons";
  return (
    <fieldset className={cn("flex flex-col gap-1.5", className)}>
      <legend className={cn(icons ? "sr-only" : "mb-1.5 text-sm font-bold text-ink")}>Theme</legend>
      <div className="flex rounded-[14px] bg-track p-1">
        {OPTIONS.map(({ value, label, Icon }) => (
          <label
            key={value}
            title={icons ? label : undefined}
            className={cn(
              "flex min-w-0 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-[10px] text-[15px] font-bold text-text-2",
              icons ? "h-11" : "h-10 px-2",
              "has-checked:bg-surface has-checked:font-extrabold has-checked:text-ink has-checked:shadow-sm",
              "has-focus-visible:outline-2 has-focus-visible:outline-link",
            )}
          >
            <input
              type="radio"
              name={`theme-${variant}`}
              value={value}
              checked={theme === value}
              onChange={() => choose(value)}
              className="sr-only"
            />
            <Icon aria-hidden size={icons ? 18 : 16} />
            {/* The icon-only version still names each option for screen readers. */}
            <span className={cn(icons && "sr-only")}>{label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
