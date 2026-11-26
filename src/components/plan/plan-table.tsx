import Link from "next/link";
import { formatPeso } from "@/lib/money";
import { formatPeriodRange } from "@/lib/periods";
import type { PlanSummary } from "@/lib/plan";
import type { PlanRow } from "@/lib/plan-periods";
import { editHref, groupAddLink, PLAN_SECTIONS, showGroup } from "@/components/plan/plan-groups";

// The desktop plan table (plan.md §4): one table, each group a header row
// with its total. ACTUAL and STATUS come with ticking items paid (Week 6);
// until then every row would say "—". An item's name links to Edit item
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
              <GroupRow title={title} total={summary.sections[key]} />
              {rows.length === 0 && key !== "one_off" ? null : rows.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-4 py-3 text-text-3">
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
                  />
                ))
              )}
              {add && (
                <tr>
                  <td colSpan={3} className="px-4 py-1">
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

function GroupRow({ title, total }: { title: string; total: number }) {
  return (
    <tr className="border-t border-line bg-bg">
      <th scope="rowgroup" colSpan={2} className="px-4 py-2 text-xs font-extrabold tracking-wide text-text-3 uppercase">
        {title}
      </th>
      <td className="px-4 py-2 text-right text-xs font-extrabold text-text-3">{formatPeso(total)}</td>
    </tr>
  );
}

function ItemRow({ name, detail, amount, href }: { name: string; detail: string; amount: string; href?: string | null }) {
  return (
    <tr className="border-t border-line-soft">
      <th scope="row" className="px-4 py-3 font-extrabold text-ink">
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
      </th>
      <td className="px-4 py-3 text-text-3">{detail}</td>
      <td className="px-4 py-3 text-right font-extrabold text-ink">{amount}</td>
    </tr>
  );
}
