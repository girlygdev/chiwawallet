import type { Metadata } from "next";
import { PlaceholderPage } from "@/components/shell/placeholder-page";

export const metadata: Metadata = { title: "Bills · Chiwawallet" };

// Built in Week 4 (bills.md). On mobile it's reached through More.
export default function BillsPage() {
  return <PlaceholderPage title="Bills" mobile={{ backHref: "/more", backLabel: "Back to More" }} />;
}
