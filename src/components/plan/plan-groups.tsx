import { Plus } from "lucide-react";
import Link from "next/link";
import { OpenAddSheetButton } from "@/components/transactions/add-transaction-provider";
import { formatPeso } from "@/lib/money";
import type { PlanSummary } from "@/lib/plan";
import type { PlanRow } from "@/lib/plan-periods";
import { cn } from "@/lib/utils";

type Section = Exclude<PlanRow["section"], "income">;

/** The groups after MONEY IN, in the Plan's order (shared with the desktop table). */
export const PLAN_SECTIONS: { key: Section; title: string }[] = [
  { key: "bills", title: "Bills" },
  { key: "debts", title: "Debt payments" },
  { key: "savings", title: "Savings" },
  { key: "spending", title: "Spending budgets" },
  { key: "one_off", title: "One-off items" },
];

/** Edit item's address (5e): rows are plain links that open the sheet. */
export const editHref = (start: string, id: string) => `/plan?start=${start}&edit=${id}`;

/** Add one-off item's address (5f). */
export const addOneOffHref = (start: string) => `/plan?start=${start}&add=1`;

/** The row under the income: "Carried in" or, on the first period, "Starting balance". */
export type CarryLabel = { name: string; detail: string };

// The Plan's group sections (plan.md §3): MONEY IN, then bills, debt
// payments, savings, spending budgets and one-off items. Headings show the
// group's total; "₱1,700 of ₱2,700 paid" comes with ticking items (Week 6).
// Empty groups are hidden, except One-off items, which explains itself.
// `moneyInOnly` is for the empty plan (§5), which shows only MONEY IN.
// Tapping a row opens Edit item (5e), except in an ended period (read-only).
export function PlanGroups({
  items,
  income,
  carriedIn,
  carryLabel,
  summary,
  future,
  editStart,
  moneyInOnly = false,
}: {
  items: PlanRow[];
  income: number;
  carriedIn: number | null;
  carryLabel: CarryLabel;
  summary: PlanSummary;
  /** Future periods can't be paid yet, so they get no "I got paid" pill. */
  future: boolean;
  /** The period's start while its plan can change; empty once it has ended. */
  editStart: string | null;
  moneyInOnly?: boolean;
}) {
  const incomeRows = items.filter((i) => i.section === "income");

  return (
    <div className="flex flex-col gap-5">
      <Group id="money-in" title="Money in" total={income + (carriedIn ?? 0)}>
        <ul className={LIST}>
          {incomeRows.map((i) => (
            <li key={i.id} className={ROW}>
              {/* The name is the edit link: the I got paid pill can't sit inside a link. */}
              <EditLink href={editStart && editHref(editStart, i.id)}>
                <span className="truncate font-extrabold text-ink">{i.name}</span>
                {/* "Received" or "Expected Nov 30": words, with colour only as a hint. */}
                <span className={cn("text-[13px] font-bold", i.received ? "text-link-hover" : "text-text-3")}>{i.detail}</span>
              </EditLink>
              <span className="flex shrink-0 items-center gap-2">
                {!i.received && !future && i.income_source_id && (
                  // Opens the add sheet with this pay filled in, like the Dashboard's prompt.
                  <OpenAddSheetButton
                    options={{ tab: "income", incomeSource: i.income_source_id, amount: i.planned_amount }}
                    className="flex min-h-11 items-center rounded-full bg-mint px-3 text-sm font-extrabold text-green-800 outline-link focus-visible:outline-2 focus-visible:outline-offset-2"
                  >
                    I got paid
                  </OpenAddSheetButton>
                )}
                <span className="font-extrabold text-ink">{formatPeso(i.planned_amount)}</span>
              </span>
            </li>
          ))}
          <li className={ROW}>
            <div className="flex min-w-0 flex-col">
              <span className="font-extrabold text-ink">{carryLabel.name}</span>
              <span className="text-[13px] text-text-3">{carryLabel.detail}</span>
            </div>
            <span className="shrink-0 font-extrabold text-ink">
              {carriedIn == null ? (
                <>
                  <span aria-hidden>—</span>
                  <span className="sr-only">Not known yet</span>
                </>
              ) : (
                formatPeso(carriedIn)
              )}
            </span>
          </li>
        </ul>
      </Group>

      {!moneyInOnly &&
        PLAN_SECTIONS.map(({ key, title }) => {
          const rows = items.filter((i) => i.section === key);
          if (rows.length === 0 && key !== "one_off") return null;
          return (
            <Group key={key} id={`plan-${key}`} title={title} total={summary.sections[key]}>
              {rows.length === 0 ? (
                <p className="rounded-2xl border-[1.5px] border-dashed border-line-dash px-4 py-3 text-sm text-text-3">
                  Gifts, events, fees or anything that only happens once. Plan them here so they don&apos;t surprise you.
                </p>
              ) : (
                <ul className={LIST}>
                  {rows.map((i) => {
                    const href = editStart && editHref(editStart, i.id);
                    return key === "spending" ? (
                      <SpendingRow key={i.id} item={i} href={href} />
                    ) : (
                      <TickRow key={i.id} item={i} href={href} />
                    );
                  })}
                </ul>
              )}
              {key === "one_off" && editStart && (
                // The Dashed button: "add something new" (style-guide.md "Buttons").
                <Link
                  href={addOneOffHref(editStart)}
                  scroll={false}
                  className="flex min-h-11 items-center justify-center gap-1.5 rounded-2xl border-[1.5px] border-dashed border-line-dash bg-surface px-4 text-[15px] font-extrabold text-link outline-link focus-visible:outline-2 focus-visible:outline-offset-2"
                >
                  <Plus aria-hidden size={18} strokeWidth={2.5} />
                  Add one-off item
                </Link>
              )}
            </Group>
          );
        })}
    </div>
  );
}

const LIST = "flex flex-col divide-y divide-line-soft rounded-2xl border-[1.5px] border-line bg-surface";
const ROW = "flex min-h-14 items-center justify-between gap-3 px-4 py-3";
const FOCUS = "outline-link focus-visible:outline-2 focus-visible:-outline-offset-2";

/** A row's content: a link to Edit item, or plain once the period has ended. */
function RowLink({ href, children }: { href: string | null; children: React.ReactNode }) {
  if (!href) return <div className={ROW}>{children}</div>;
  return (
    <Link href={href} scroll={false} className={cn(ROW, FOCUS, "hover:bg-bg")}>
      {children}
    </Link>
  );
}

/** An income row's name and status as the link (the pill beside it is its own button). */
function EditLink({ href, children }: { href: string | null; children: React.ReactNode }) {
  const className = "flex min-h-11 min-w-0 flex-1 flex-col justify-center";
  if (!href) return <div className={className}>{children}</div>;
  return (
    <Link href={href} scroll={false} className={cn(className, FOCUS, "rounded-md")}>
      {children}
    </Link>
  );
}

function Group({ id, title, total, children }: { id: string; title: string; total: number; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-2">
      <h2 id={id} className="flex justify-between gap-3 text-[13px] font-extrabold tracking-wide text-text-3 uppercase">
        <span>{title}</span>
        <span>{formatPeso(total)}</span>
      </h2>
      {children}
    </section>
  );
}

// A bill, debt payment, savings or one-off row (plan.md §3 "Tick row"). The
// circle is drawn but hidden from screen readers: it becomes the Mark paid
// button in Week 6, and a button that does nothing is worse than none.
function TickRow({ item, href }: { item: PlanRow; href: string | null }) {
  return (
    <li>
      <RowLink href={href}>
        <div className="flex min-w-0 items-center gap-3">
          <span aria-hidden className="size-7 shrink-0 rounded-full border-2 border-line-dash bg-surface" />
          <div className="flex min-w-0 flex-col">
            <span className="truncate font-extrabold text-ink">{item.name}</span>
            <span className="text-[13px] text-text-3">{item.detail}</span>
          </div>
        </div>
        <span className="shrink-0 font-extrabold text-ink">{formatPeso(item.planned_amount)}</span>
      </RowLink>
    </li>
  );
}

// A spending budget: the name, its group and the planned amount. What's
// spent and left, with the bar, comes with planned vs actual (Week 6).
function SpendingRow({ item, href }: { item: PlanRow; href: string | null }) {
  return (
    <li>
      <RowLink href={href}>
        <span className="min-w-0 truncate">
          <span className="font-extrabold text-ink">{item.name}</span>
          <span className="text-text-3"> · {item.detail}</span>
        </span>
        <span className="shrink-0 font-extrabold text-ink">{formatPeso(item.planned_amount)}</span>
      </RowLink>
    </li>
  );
}
