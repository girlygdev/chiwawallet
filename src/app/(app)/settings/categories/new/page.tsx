import type { Metadata } from "next";
import { Suspense } from "react";
import { CategoryPageForm } from "@/components/categories/category-form";
import { CategoryFormSkeleton } from "@/components/categories/category-form-skeleton";
import { BackToCategories } from "@/components/categories/category-list";
import { PageHeader } from "@/components/shell/page-header";
import { PageShell } from "@/components/shell/page-shell";
import { CATEGORIES_HREF } from "@/lib/categories";
import { requireAppUser } from "@/lib/require-app-user";
import { createCategory } from "../actions";

export const metadata: Metadata = { title: "New category · Chiwawallet" };

// New category (more-and-categories.md §2), opened from the category list.
// The add sheet's picker opens the same form in 3h-3.
export default function NewCategoryPage() {
  return (
    <PageShell>
      <PageHeader
        title="New category"
        mobile={{ backHref: CATEGORIES_HREF, backLabel: "Back to Categories" }}
        eyebrow="Settings › Categories"
        desktopAction={<BackToCategories />}
      />
      {/* Cache Components: the group targets come from the budget (cookies). */}
      <Suspense fallback={<CategoryFormSkeleton />}>
        <NewCategoryForm />
      </Suspense>
    </PageShell>
  );
}

async function NewCategoryForm() {
  const { budget } = await requireAppUser();
  return (
    <div className="w-full max-w-xl">
      <CategoryPageForm
        targets={{ needs: budget.needs_pct, wants: budget.wants_pct, savings_debt: budget.savings_debt_pct }}
        onSave={createCategory}
      />
    </div>
  );
}
