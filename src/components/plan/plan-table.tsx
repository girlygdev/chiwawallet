import Link from "next/link";
import { formatPeso } from "@/lib/money";
import { formatPeriodRange, formatShortDate } from "@/lib/periods";
import { cn } from "@/lib/utils";
import type { PlanSummary } from "@/lib/plan";
import type { OpenedPlan, PlanRow } from "@/lib/plan-periods";
import { editHref, groupAddLink, PLAN_SECTIONS, showGroup, tickItem } from "@/components/plan/plan-groups";
import { TickButton } from "@/components/plan/tick-button";

// The desktop plan table (plan.md §4): ITEM, DETAILS, PLANNED, ACTUAL and
// STATUS (6e), each group a header row with its planned and actual totals.
// ACTUAL is what was paid (ticked items) or spent (budgets), "—" until
// then; STATUS is a tag. Future periods show "—" in both. An item's name links to Edit item
// (5e) while the period's plan can change.
export function PlanTable({
  period,
  items,
  income,
  carriedIn,
  carryLabel,
  summary,
  editStart,
  hasDebts,
  canTick,
  progress = null,
}: {
  period: { start: string; end: string };
  items: PlanRow[];
  income: number;
  carriedIn: number | null;
  /** "Carried in" or "Starting balance". */
  carryLabel: { name: string; detail: string };
  summary: PlanSummary;
  /** The period's start while its plan can change; empty once it has ended. */
  editStart: string | null;
  hasDebts: boolean;
  /** The period can be paid now: tick circles are buttons (6b-1). */
  canTick: boolean;
  /** Each group's actual (6e); empty in future periods. */
  progress?: OpenedPlan["progress"];
}) {
  const incomeRows = items.filter((i) => i.section === "income");

  return (
    <div className="overflow-hidden rounded-2xl border-[1.5px] border-line bg-surface">
      <table className="w-full text-left text-sm">
        <caption className="sr-only">Plan for {formatPeriodRange(period.start, period.end)}</caption>
        <thead>
          <tr className="border-b border-line text-xs font-extrabold tracking-wide text-text-3 uppercase">
            <th scope="col" className="px-4 py-3">
              Item
            </th>
            <th scope="col" className="px-4 py-3">
              Details
            </th>
            <th scope="col" className="px-4 py-3 text-right">
              Planned
            </th>
            <th scope="col" className="px-4 py-3 text-right">
              Actual
            </th>
            <th scope="col" className="px-4 py-3">
              Status
            </th>
          </tr>
        </thead>

        <tbody>
          <GroupRow title="Money in" total={income + (carriedIn ?? 0)} />
          {incomeRows.map((i) => (
            <ItemRow
              key={i.id}
              name={i.name}
              detail={i.detail}
              amount={formatPeso(i.planned_amount)}
              href={editStart && editHref(editStart, i.id)}
              status={<Tag tone={i.received ? "good" : "neutral"}>{i.received ? "Received" : "Expected"}</Tag>}
            />
          ))}
          <ItemRow
            name={carryLabel.name}
            detail={carryLabel.detail}
            amount={carriedIn == null ? "—" : formatPeso(carriedIn)}
          />
        </tbody>

        {PLAN_SECTIONS.map(({ key, title }) => {
          const rows = items.filter((i) => i.section === key);
          const add = groupAddLink(key, editStart, hasDebts);
          if (!showGroup(key, rows.length, add)) return null;
          return (
            <tbody key={key}>
              <GroupRow title={title} total={summary.sections[key]} actual={progress?.[key]?.actual ?? null} />
              {rows.length === 0 && key !== "one_off" ? null : rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-3 text-text-3">
                    Nothing that only happens once yet.
                  </td>
                </tr>
              ) : (
                rows.map((i) => (
                  <ItemRow
                    key={i.id}
                    name={i.name}
                    detail={i.detail}
                    amount={formatPeso(i.planned_amount)}
                    href={editStart && editHref(editStart, i.id)}
                    tick={i.tickable ? <TickButton item={tickItem(i)} canTick={canTick} /> : undefined}
                    actual={i.actual != null && (i.actual > 0 || i.bar) ? formatPeso(i.actual) : "—"}
                    status={<RowStatus row={i} />}
                  />
                ))
              )}
              {add && (
                <tr>
                  <td colSpan={5} className="px-4 py-1">
                    <Link
                      href={add.href}
                      scroll={false}
                      className="inline-flex min-h-11 items-center rounded-sm font-extrabold text-link outline-link hover:underline focus-visible:outline-2"
                    >
                      + {add.label}
                    </Link>
                  </td>
                </tr>
              )}
            </tbody>
          );
        })}
      </table>
    </div>
  );
}

function GroupRow({ title, total, actual = null }: { title: string; total: number; actual?: number | null }) {
  return (
    <tr className="border-t border-line bg-bg">
      <th scope="rowgroup" colSpan={2} className="px-4 py-2 text-xs font-extrabold tracking-wide text-text-3 uppercase">
        {title}
      </th>
      <td className="px-4 py-2 text-right text-xs font-extrabold text-text-3">{formatPeso(total)}</td>
      <td className="px-4 py-2 text-right text-xs font-extrabold text-text-3">{actual == null ? "" : formatPeso(actual)}</td>
      <td />
    </tr>
  );
}

const TAG_TONES = {
  good: "bg-mint text-green-800",
  bad: "bg-bad-bg text-bad-fg",
  warn: "bg-warn-bg text-warn-fg",
  neutral: "bg-track text-text-2",
} as const;

/** A status in words, with colour only as a hint (plan.md §8). */
function Tag({ tone, children }: { tone: keyof typeof TAG_TONES; children: React.ReactNode }) {
  return <span className={cn("rounded-full px-2 py-0.5 text-xs font-bold whitespace-nowrap", TAG_TONES[tone])}>{children}</span>;
}

/** STATUS: Paid, Late, Due or Planned for ticked items; "₱2,760 left" or "₱340 over" for budgets. */
function RowStatus({ row }: { row: PlanRow }) {
  if (row.bar) return <Tag tone={row.bar.tone === "over" ? "bad" : row.bar.tone === "near" ? "warn" : "neutral"}>{row.bar.text}</Tag>;
  const status = row.status;
  if (!status || row.actual == null) return <span className="text-text-3">—</span>;
  switch (status.kind) {
    case "paid":
      return <Tag tone="good">{status.date ? `Paid ${formatShortDate(status.date)}` : "Paid"}</Tag>;
    case "late":
      return <Tag tone="bad">{`Late · ${status.days} ${status.days === 1 ? "day" : "days"}`}</Tag>;
    case "due":
      return <Tag tone="warn">{`Due ${formatShortDate(status.date)}`}</Tag>;
    case "planned":
      return <Tag tone="neutral">Planned</Tag>;
  }
}

function ItemRow({
  name,
  detail,
  amount,
  href,
  tick,
  actual = "",
  status = null,
}: {
  name: string;
  detail: string;
  amount: string;
  href?: string | null;
  /** Bills, debts, savings and one-offs: the Mark paid circle before the name. */
  tick?: React.ReactNode;
  /** ACTUAL (6e): paid or spent, or "—". */
  actual?: string;
  /** STATUS (6e): a tag. */
  status?: React.ReactNode;
}) {
  return (
    <tr className="border-t border-line-soft">
      <th scope="row" className="px-4 py-3 font-extrabold text-ink">
        <span className="flex items-center gap-3">
          {tick}
          {href ? (
            <Link
              href={href}
              scroll={false}
              // A 44px tap area without making the row taller.
              className="-mx-1 -my-2.5 inline-block rounded-sm px-1 py-2.5 outline-link hover:text-link hover:underline focus-visible:outline-2"
            >
              {name}
            </Link>
          ) : (
            name
          )}
        </span>
      </th>
      <td className="px-4 py-3 text-text-3">{detail}</td>
      <td className="px-4 py-3 text-right font-extrabold text-ink">{amount}</td>
      <td className="px-4 py-3 text-right font-extrabold text-ink">{actual}</td>
      <td className="px-4 py-3">{status}</td>
    </tr>
  );
}
