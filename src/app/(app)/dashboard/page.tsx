import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/shell/page-header";
import { PageShell } from "@/components/shell/page-shell";
import { requireAppUser } from "@/lib/require-app-user";

export const metadata: Metadata = { title: "Dashboard · Chiwawallet" };

// Placeholder so sign-up has somewhere to land. The real dashboard
// (dashboard.md) is built from Week 2. Log out moved to More and Settings.
export default function DashboardPage() {
  return (
    <PageShell>
      <PageHeader title="Your payday at a glance" mobile="greeting" />
      {/* Cache Components: the login check reads cookies, so it sits in <Suspense>. */}
      <Suspense fallback={<p className="text-[15px] text-text-3">Loading…</p>}>
        <DashboardBody />
      </Suspense>
    </PageShell>
  );
}

async function DashboardBody() {
  await requireAppUser();
  return (
    <p className="text-[15px] text-text-3">You&apos;re in. Your dashboard is coming soon.</p>
  );
}
