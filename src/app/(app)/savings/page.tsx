import type { Metadata } from "next";
import { PlaceholderPage } from "@/components/shell/placeholder-page";

export const metadata: Metadata = { title: "Savings pots · Chiwawallet" };

// Built in Week 4 (savings.md). On mobile it's reached through More.
export default function SavingsPage() {
  return <PlaceholderPage title="Savings pots" mobile={{ backHref: "/more", backLabel: "Back to More" }} />;
}
