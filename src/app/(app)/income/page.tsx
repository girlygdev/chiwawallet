import type { Metadata } from "next";
import { PlaceholderPage } from "@/components/shell/placeholder-page";

export const metadata: Metadata = { title: "Income · Chiwawallet" };

// Built in Week 2 (income.md). On mobile it's reached through More.
export default function IncomePage() {
  return <PlaceholderPage title="Income" mobile={{ backHref: "/more", backLabel: "Back to More" }} />;
}
