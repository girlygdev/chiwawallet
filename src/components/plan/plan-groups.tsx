import { Plus } from "lucide-react";
import Link from "next/link";
import { TickButton, type TickItem } from "@/components/plan/tick-button";
import { OpenAddSheetButton } from "@/components/transactions/add-transaction-provider";
import { formatPeso } from "@/lib/money";
import { groupProgressLine, type PlanSummary } from "@/lib/plan";
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
/** Set a budget's address (5g-1). */
export const setBudgetHref = (start: string) => `/plan?start=${start}&add=budget`;

/**
 * The "add" link under a group while the plan can change (shared with the
 * desktop table): Plan a debt payment (only with a debt to pay), Set a
 * budget, Add one-off item. Null for other groups and in an ended period.
 */
export function groupAddLink(key: Section, editStart: string | null, hasDebts: boolean): { label: string; href: string } | null {
  if (!editStart) return null;
  if (key === "debts" && hasDebts) return { label: "Plan a debt payment", href: `/plan?start=${editStart}&add=debt` };
  if (key === "spending") return { label: "Set a budget", href: setBudgetHref(editStart) };
  if (key === "one_off") return { label: "Add one-off item", href: addOneOffHref(editStart) };
  return null;
}

/** Whether a group shows: when it has rows or an add link, and always for One-off items (its empty card). */
export const showGroup = (key: Section, rows: number, add: unknown) => rows > 0 || key === "one_off" || add != null;

/** A row as its tick button needs it (6b-1). */
export const tickItem = (i: PlanRow): TickItem => ({
  id: i.id,
  name: i.name,
  planned_amount: i.planned_amount,
  paid: i.paid_at != null,
  pot: i.pot_id != null,
  varies: i.varies,
});

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
  hasDebts,
  canTick,
  progress = null,
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
  /** Any debt not paid off: DEBT PAYMENTS shows with "+ Plan a debt payment". */
  hasDebts: boolean;
  /** The period can be paid now (started, not closed): tick circles are buttons (6b-1). */
  canTick: boolean;
  /** Each group's actual of planned (6e); empty in future periods. */
  progress?: Partial<Record<Section, { actual: number; planned: number }>> | null;
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
          const add = groupAddLink(key, editStart, hasDebts);
          if (!showGroup(key, rows.length, add)) return null;
          return (
            <Group
              key={key}
              id={`plan-${key}`}
              title={title}
              total={summary.sections[key]}
              progress={progress?.[key]}
              verb={key === "spending" ? "spent" : "paid"}
            >
              {rows.length === 0 && key !== "one_off" ? null : rows.length === 0 ? (
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
                      <TickRow key={i.id} item={i} href={href} canTick={canTick} />
                    );
                  })}
                </ul>
              )}
              {add && (
                // The Dashed button: "add something new" (style-guide.md "Buttons").
                <Link
                  href={add.href}
                  scroll={false}
                  className="flex min-h-11 items-center justify-center gap-1.5 rounded-2xl border-[1.5px] border-dashed border-line-dash bg-surface px-4 text-[15px] font-extrabold text-link outline-link focus-visible:outline-2 focus-visible:outline-offset-2"
                >
                  <Plus aria-hidden size={18} strokeWidth={2.5} />
                  {add.label}
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
function RowLink({ href, className, children }: { href: string | null; className?: string; children: React.ReactNode }) {
  if (!href) return <div className={cn(ROW, className)}>{children}</div>;
  return (
    <Link href={href} scroll={false} className={cn(ROW, FOCUS, "hover:bg-bg", className)}>
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

// A group's heading: the title and, on the right, its total, or once the
// period has started "₱1,700 of ₱2,700 paid" (spent, for budgets; 6e).
function Group({
  id,
  title,
  total,
  progress,
  verb = "paid",
  children,
}: {
  id: string;
  title: string;
  total: number;
  progress?: { actual: number; planned: number };
  verb?: "paid" | "spent";
  children: React.ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-2">
      <h2 id={id} className="flex justify-between gap-3 text-[13px] font-extrabold tracking-wide text-text-3 uppercase">
        <span>{title}</span>
        <span className="normal-case">
          {progress && progress.planned > 0
            ? groupProgressLine(progress.actual, progress.planned, verb)
            : formatPeso(total)}
        </span>
      </h2>
      {children}
    </section>
  );
}

// A bill, debt payment, savings or one-off row (plan.md §3 "Tick row").
// The circle is its own button (Mark paid, 6b-1), beside the edit link, since
// a button can't sit inside a link.
function TickRow({ item, href, canTick }: { item: PlanRow; href: string | null; canTick: boolean }) {
  return (
    <li className="flex items-center pl-4">
      <TickButton item={tickItem(item)} canTick={canTick && item.tickable} />
      <RowLink href={href} className="min-w-0 flex-1 pl-3">
        <div className="flex min-w-0 flex-col">
          <span className="truncate font-extrabold text-ink">{item.name}</span>
          <span className={cn("text-[13px]", item.paid_at ? "font-bold text-link-hover" : "text-text-3")}>{item.detail}</span>
        </div>
        <span className="shrink-0 font-extrabold text-ink">{formatPeso(item.planned_amount)}</span>
      </RowLink>
    </li>
  );
}

// With planned vs actual (6e, plan.md §3 "Spending budget bar"): "₱3,240 /
// ₱6,000", an 8px bar (green, gold from 90%, red over) and "₱2,760 left" or
// "₱340 over". Future periods show the planned amount only.
function SpendingRow({ item, href }: { item: PlanRow; href: string | null }) {
  const bar = item.bar;
  return (
    <li>
      <RowLink href={href} className={cn(bar && "flex-col items-stretch gap-1.5")}>
        <span className="flex items-baseline justify-between gap-3">
          <span className="min-w-0 truncate">
            <span className="font-extrabold text-ink">{item.name}</span>
            <span className="text-text-3"> · {item.detail}</span>
          </span>
          <span className="shrink-0 font-extrabold text-ink">
            {bar ? `${formatPeso(item.actual ?? 0)} / ${formatPeso(item.planned_amount)}` : formatPeso(item.planned_amount)}
          </span>
        </span>
        {bar && (
          <>
            {/* The text below says the same, so the bar is decorative. */}
            <span aria-hidden className="block h-2 overflow-hidden rounded-full bg-track">
              <span
                className={cn(
                  "block h-full rounded-full",
                  bar.tone === "over" ? "bg-danger" : bar.tone === "near" ? "bg-gold" : "bg-green-500",
                )}
                style={{ width: `${bar.share * 100}%` }}
              />
            </span>
            <span className={cn("text-[13px] font-bold", bar.tone === "over" ? "text-bad-fg" : "text-text-3")}>{bar.text}</span>
          </>
        )}
      </RowLink>
    </li>
  );
}
