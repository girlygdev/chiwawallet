import type { Metadata } from "next";
import { Suspense } from "react";
import { CategoryList } from "@/components/categories/category-list";
import { HeaderStickerLink, PageHeader } from "@/components/shell/page-header";
import { PageShell } from "@/components/shell/page-shell";
import { Skeleton, SkeletonRegion } from "@/components/skeleton";
import { CATEGORIES_HREF } from "@/lib/categories";
import { requireAppUser } from "@/lib/require-app-user";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Categories · Chiwawallet" };

// More › Categories and Settings › Manage categories (more-and-categories.md
// §3, week-3-tasks.md 3h). Delete category comes in 3h-2.
export default function CategoriesPage() {
  return (
    <PageShell>
      <PageHeader
        title="Categories"
        mobile={{ backHref: "/more", backLabel: "Back to More" }}
        eyebrow="Settings"
        desktopAction={<HeaderStickerLink href={`${CATEGORIES_HREF}/new`}>New category</HeaderStickerLink>}
      />
      {/* Cache Components: reading the user's categories needs the login (cookies). */}
      <Suspense fallback={<CategoriesSkeleton />}>
        <CategoriesContent />
      </Suspense>
    </PageShell>
  );
}

async function CategoriesContent() {
  const { budget } = await requireAppUser();
  const supabase = await createClient();
  const { data, error } = await supabase.from("categories").select("id, name, kind, budget_group, system_key, icon, color");
  if (error) throw new Error(`Couldn't load categories: ${error.message}`, { cause: error });

  return (
    <div className="w-full max-w-2xl">
      <CategoryList
        categories={data}
        targets={{ needs: budget.needs_pct, wants: budget.wants_pct, savings_debt: budget.savings_debt_pct }}
      />
    </div>
  );
}

function CategoriesSkeleton() {
  return (
    <SkeletonRegion className="flex w-full max-w-2xl flex-col gap-5">
      {/* Needs (7 default rows), Wants (6), Savings & debt payoff (2) */}
      {["h-[448px]", "h-[384px]", "h-32"].map((height) => (
        <div key={height} className="flex flex-col gap-2">
          <Skeleton className="h-3.5 w-40" />
          <Skeleton className={`rounded-2xl ${height}`} />
        </div>
      ))}
    </SkeletonRegion>
  );
}
