import { ArrowLeft, ChevronRight, Lock, Plus } from "lucide-react";
import Link from "next/link";
import { CategoryIconTile } from "@/components/transactions/category-grid";
import { CATEGORIES_HREF, categoryListSections, type ListCategory } from "@/lib/categories";
import type { BudgetGroup } from "@/lib/transactions";

export type CategoryRow = ListCategory & { icon: string; color: string };

const SECTION_NAMES: Record<BudgetGroup | "income", string> = {
  needs: "Needs",
  wants: "Wants",
  savings_debt: "Savings & debt payoff",
  income: "Income categories",
};

// What each locked system category is for, as its detail line.
const SYSTEM_DETAIL: Record<string, string> = {
  income: "Used for pay and other money in",
  savings_pot: "Used when you move money to a pot",
  extra_debt: "Used for extra debt payments",
  debt_payment: "Used for planned debt payments",
};

const HEADING = "text-[13px] font-extrabold tracking-wide text-text-3 uppercase";
const ROW = "flex min-h-14 items-center gap-3 px-3.5 py-3";

/**
 * The category list (more-and-categories.md §3, not on the canvas): the
 * picker's group sections as rows. The user's own rows open Edit category;
 * system rows are locked and read-only (owner, Nov 24). "Budget per payday"
 * joins the rows with the Plan (Week 5).
 */
export function CategoryList({
  categories,
  targets,
}: {
  categories: CategoryRow[];
  targets: Record<BudgetGroup, number>;
}) {
  const sections = categoryListSections(categories);

  return (
    <div className="flex flex-col gap-5">
      {sections.map(({ key, categories: rows }) => (
        <section key={key} aria-labelledby={`categories-${key}`} className="flex flex-col gap-2">
          <h2 id={`categories-${key}`} className={HEADING}>
            {SECTION_NAMES[key]}
            {key !== "income" && ` · ${targets[key]}% target`}
          </h2>
          <ul className="overflow-hidden rounded-2xl border-[1.5px] border-line bg-surface">
            {rows.map((category) => (
              <li key={category.id} className="border-t border-line-soft first:border-t-0">
                {category.system_key ? (
                  <div className={ROW}>
                    <CategoryIconTile icon={category.icon} color={category.color} size="md" />
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="font-extrabold text-ink">{category.name}</span>
                      <span className="text-[13px] text-text-3">{SYSTEM_DETAIL[category.system_key]}</span>
                    </span>
                    <Lock aria-hidden size={18} className="shrink-0 text-text-3" />
                    <span className="sr-only">Locked: can&apos;t be changed or deleted.</span>
                  </div>
                ) : (
                  <Link
                    href={`${CATEGORIES_HREF}/edit?id=${category.id}`}
                    className={`${ROW} outline-link hover:bg-bg focus-visible:outline-2 focus-visible:-outline-offset-2`}
                  >
                    <CategoryIconTile icon={category.icon} color={category.color} size="md" />
                    <span className="min-w-0 flex-1 truncate font-extrabold text-ink">{category.name}</span>
                    <ChevronRight aria-hidden size={20} className="shrink-0 text-text-3" />
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}

      <Link
        href={`${CATEGORIES_HREF}/new`}
        className="flex h-[52px] items-center justify-center gap-2 rounded-[14px] border-2 border-dashed border-line font-extrabold text-link-hover outline-link hover:bg-mint focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        <Plus aria-hidden size={20} strokeWidth={2.5} />
        New category
      </Link>
    </div>
  );
}

/** Desktop's way back from New and Edit category (mobile has the header arrow). */
export function BackToCategories() {
  return (
    <Link
      href={CATEGORIES_HREF}
      className="-ml-2 hidden h-11 w-fit items-center gap-1.5 rounded-md px-2 text-[15px] font-extrabold text-link-hover outline-link focus-visible:outline-2 md:flex"
    >
      <ArrowLeft aria-hidden size={18} />
      All categories
    </Link>
  );
}
