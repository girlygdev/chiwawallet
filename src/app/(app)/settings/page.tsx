import type { Metadata } from "next";
import { PlaceholderPage } from "@/components/shell/placeholder-page";

export const metadata: Metadata = { title: "Settings · Chiwawallet" };

// Built in Week 8 (settings.md). Log out lives here on desktop.
export default function SettingsPage() {
  return (
    <PlaceholderPage
      title="Settings"
      mobile={{ backHref: "/more", backLabel: "Back to More" }}
      showLogOut
    />
  );
}
