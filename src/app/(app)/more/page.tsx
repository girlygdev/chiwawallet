import type { Metadata } from "next";
import { PlaceholderPage } from "@/components/shell/placeholder-page";

export const metadata: Metadata = { title: "More · Chiwawallet" };

// The mobile hub, built in Week 3 (more-and-categories.md). Log out lives here on mobile.
export default function MorePage() {
  return <PlaceholderPage title="More" mobile="title" showLogOut />;
}
