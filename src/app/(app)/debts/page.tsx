import type { Metadata } from "next";
import { PlaceholderPage } from "@/components/shell/placeholder-page";

export const metadata: Metadata = { title: "Debts · Chiwawallet" };

// Built in Week 4 (debts.md). On mobile it's reached through More.
export default function DebtsPage() {
  return <PlaceholderPage title="Debts" mobile={{ backHref: "/more", backLabel: "Back to More" }} />;
}
