"use client";

import { useEffect } from "react";
import { isTheme } from "@/lib/theme";
import { applyTheme, readStoredTheme } from "./apply-theme";

/**
 * On app pages: if the profile's saved theme differs from this device's, the
 * profile wins (decided Nov 19), so a choice made on one device shows up on
 * the next one after logging in.
 */
export function ThemeSync({ profileTheme }: { profileTheme: string }) {
  useEffect(() => {
    if (isTheme(profileTheme) && profileTheme !== readStoredTheme()) applyTheme(profileTheme);
  }, [profileTheme]);
  return null;
}
