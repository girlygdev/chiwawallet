import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";
import { CategoryPageForm } from "@/components/categories/category-form";
import { CategoryFormSkeleton } from "@/components/categories/category-form-skeleton";
import { BackToCategories } from "@/components/categories/category-list";
import { PageHeader } from "@/components/shell/page-header";
import { PageShell } from "@/components/shell/page-shell";
import { DeleteCategory } from "@/components/categories/delete-category-dialog";
import { CATEGORIES_HREF, categoryUsage } from "@/lib/categories";
import type { BudgetGroup } from "@/lib/transactions";
import { requireAppUser } from "@/lib/require-app-user";
import { createClient } from "@/lib/supabase/server";
import { updateCategory } from "../actions";

export const metadata: Metadata = { title: "Edit category · Chiwawallet" };

// Edit category (more-and-categories.md §3): New category's form, filled in.
// Below it, Delete category (level 2, 3h-2). The id is a query string
// (/settings/categories/edit?id=…), not a [id] segment: the app shell reads
// the path, which a dynamic segment would stop the build from prerendering.
export default function EditCategoryPage({ searchParams }: { searchParams: Promise<{ id?: string | string[] }> }) {
  return (
    <PageShell>
      <PageHeader
        title="Edit category"
        mobile={{ backHref: CATEGORIES_HREF, backLabel: "Back to Categories" }}
        eyebrow="Settings › Categories"
        desktopAction={<BackToCategories />}
      />
      {/* Cache Components: the query string and the login are both request data. */}
      <Suspense fallback={<CategoryFormSkeleton withDelete />}>
        <EditCategoryForm searchParams={searchParams} />
      </Suspense>
    </PageShell>
  );
}

async function EditCategoryForm({ searchParams }: { searchParams: Promise<{ id?: string | string[] }> }) {
  const { id } = await searchParams;
  if (typeof id !== "string" || !z.uuid().safeParse(id).success) notFound();
  const { budget } = await requireAppUser();
  const supabase = await createClient();
  // All the user's categories (the delete dialog's "Move them to" choices)
  // and every transaction using this one, deleted ones included (3h-2).
  const [categories, rows, bills, planItems] = await Promise.all([
    supabase.from("categories").select("id, name, kind, budget_group, system_key, icon, color, default_budget"),
    supabase.from("transactions").select("amount, deleted_at").eq("category_id", id),
    // Bills and plan items move with the transactions (4a-1, 5a); only the
    // counts are needed. Plan items include deleted ones, which move too.
    supabase.from("recurring_bills").select("id", { count: "exact", head: true }).eq("category_id", id),
    supabase.from("plan_items").select("id", { count: "exact", head: true }).eq("category_id", id),
  ]);
  for (const result of [categories, rows, bills, planItems]) {
    if (result.error) throw new Error(`Couldn't load the category: ${result.error.message}`, { cause: result.error });
  }
  const category = categories.data!.find((c) => c.id === id);
  // Missing, someone else's (RLS hides it), or a locked system or income
  // category, which the list never links to.
  if (!category || category.system_key != null || category.kind !== "expense" || category.budget_group == null) {
    notFound();
  }

  const targets = { needs: budget.needs_pct, wants: budget.wants_pct, savings_debt: budget.savings_debt_pct };
  const group = category.budget_group as BudgetGroup;
  // The same rules as delete_category(): same kind, not system, not itself.
  const destinations = categories.data!.filter(
    (c) => c.id !== category.id && c.system_key == null && c.kind === category.kind,
  );

  return (
    <div className="flex w-full max-w-xl flex-col gap-3">
      <CategoryPageForm
        targets={targets}
        category={{ ...category, budget_group: group }}
        // Binds the id on the server, so the client only sends the fields.
        onSave={updateCategory.bind(null, category.id)}
      />
      <DeleteCategory
        category={{
          id: category.id,
          name: category.name,
          icon: category.icon,
          color: category.color,
          group,
          groupLine: `${GROUP_NAMES[group]} · ${targets[group]}% target`,
        }}
        usage={categoryUsage(rows.data!, bills.count ?? 0, planItems.count ?? 0)}
        destinations={destinations}
      />
    </div>
  );
}

const GROUP_NAMES: Record<BudgetGroup, string> = { needs: "Needs", wants: "Wants", savings_debt: "Savings & debt payoff" };
