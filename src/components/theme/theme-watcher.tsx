"use client";

import { useEffect } from "react";
import { deviceDarkQuery, readStoredTheme, showTheme } from "./apply-theme";
import { THEME_STORAGE_KEY } from "@/lib/theme";

// Mounted once in the root layout. Keeps the page in step when:
// - the device switches light/dark while "Match device" is chosen, and
// - the choice changes in another tab.
export function ThemeWatcher() {
  useEffect(() => {
    const query = deviceDarkQuery();
    const onDeviceChange = () => {
      if (readStoredTheme() === "system") showTheme("system");
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key === THEME_STORAGE_KEY) showTheme(readStoredTheme());
    };
    query.addEventListener("change", onDeviceChange);
    window.addEventListener("storage", onStorage);
    return () => {
      query.removeEventListener("change", onDeviceChange);
      window.removeEventListener("storage", onStorage);
    };
  }, []);
  return null;
}
