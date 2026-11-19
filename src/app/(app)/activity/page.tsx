import type { Metadata } from "next";
import { PlaceholderPage } from "@/components/shell/placeholder-page";

export const metadata: Metadata = { title: "Transactions · Chiwawallet" };

// Built in Week 3 (activity.md). Mobile calls it Activity, desktop Transactions.
export default function ActivityPage() {
  return <PlaceholderPage title="Transactions" mobile="title" />;
}
