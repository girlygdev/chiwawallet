import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";
import { CategoryPageForm } from "@/components/categories/category-form";
import { BackToCategories } from "@/components/categories/category-list";
import { PageHeader } from "@/components/shell/page-header";
import { PageShell } from "@/components/shell/page-shell";
import { CATEGORIES_HREF } from "@/lib/categories";
import { requireAppUser } from "@/lib/require-app-user";
import { createClient } from "@/lib/supabase/server";
import { updateCategory } from "../actions";

export const metadata: Metadata = { title: "Edit category · Chiwawallet" };

// Edit category (more-and-categories.md §3): New category's form, filled in.
// The Delete category link (level 2) comes in 3h-2. The id is a query string
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
      <Suspense>
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
  const { data: category, error } = await supabase
    .from("categories")
    .select("id, name, kind, budget_group, system_key, icon, color")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`Couldn't load the category: ${error.message}`, { cause: error });
  // Missing, someone else's (RLS hides it), or a locked system or income
  // category, which the list never links to.
  if (!category || category.system_key != null || category.kind !== "expense" || category.budget_group == null) {
    notFound();
  }

  return (
    <div className="w-full max-w-xl">
      <CategoryPageForm
        targets={{ needs: budget.needs_pct, wants: budget.wants_pct, savings_debt: budget.savings_debt_pct }}
        category={{ ...category, budget_group: category.budget_group }}
        // Binds the id on the server, so the client only sends the fields.
        onSave={updateCategory.bind(null, category.id)}
      />
    </div>
  );
}
