import Link from "next/link";
import { cn } from "@/lib/utils";
import { formatPeso } from "@/lib/money";
import { formatPeriodRange } from "@/lib/periods";
import type { PaydayTotals } from "@/lib/plan";
import type { OverviewRow } from "@/lib/plan-periods";

// The Paydays overview (week-7-tasks.md 7g-1): every payday's planned totals,
// to compare with a spreadsheet. Below 1280px a card per payday; wider, a table
// with a Total row. Read only: rows the Plan can open link there.

const COLUMNS: { key: keyof PaydayTotals; label: string }[] = [
  { key: "moneyIn", label: "Money in" },
  { key: "bills", label: "Bills" },
  { key: "debts", label: "Debts" },
  { key: "savings", label: "Savings" },
  { key: "spending", label: "Spending" },
  { key: "oneOff", label: "One-offs" },
  { key: "planned", label: "Planned" },
  { key: "notAssigned", label: "Not assigned" },
];

const STATUS = {
  closed: { text: "Closed", className: "bg-track text-text-2" },
  open: { text: "Open", className: "bg-mint text-green-800" },
  preview: { text: "Preview", className: "border border-dashed border-line-dash text-text-2" },
} as const;

function StatusTag({ status }: { status: OverviewRow["status"] }) {
  const s = STATUS[status];
  return <span className={cn("rounded-full px-2 py-0.5 text-xs font-bold whitespace-nowrap", s.className)}>{s.text}</span>;
}

// The dates, a link to the Plan when it can open that period.
function PaydayName({ row }: { row: OverviewRow }) {
  const range = formatPeriodRange(row.period.start, row.period.end);
  return row.plannable ? (
    <Link
      href={`/plan?start=${row.period.start}`}
      className="font-extrabold text-link underline-offset-2 outline-link hover:underline focus-visible:outline-2 focus-visible:outline-offset-2"
    >
      {range}
    </Link>
  ) : (
    <span className="font-extrabold text-ink">{range}</span>
  );
}

// Below ₱0 means more is planned than comes in that payday: a heads-up, not an error.
const notAssignedTone = (n: number) => (n < 0 ? "text-warn-fg" : "text-ink");

// A phone card's numbers: the six sections in two columns, then the two
// results across the card.
function CardNumbers({ totals }: { totals: PaydayTotals }) {
  const cell = (key: keyof PaydayTotals, label: string, strong = false) => (
    <div key={key} className="flex justify-between gap-2">
      <dt className={strong ? "font-bold text-ink" : "text-text-2"}>{label}</dt>
      <dd className={cn("font-extrabold", key === "notAssigned" ? notAssignedTone(totals[key]) : "text-ink")}>{formatPeso(totals[key])}</dd>
    </div>
  );
  return (
    <div className="flex flex-col gap-1.5 text-sm">
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5">{COLUMNS.slice(0, 6).map(({ key, label }) => cell(key, label))}</dl>
      {/* Two lists, since a <dl> can only hold name and value groups. */}
      <dl className="grid grid-cols-2 gap-x-4 border-t border-line-soft pt-1.5">
        {cell("planned", "Planned", true)}
        {cell("notAssigned", "Not assigned", true)}
      </dl>
    </div>
  );
}

export function PaydaysOverview({ rows, total }: { rows: OverviewRow[]; total: PaydayTotals }) {
  return (
    <div className="flex flex-col gap-4">
      {/* Below 1280px: a card per payday, two across from tablets. */}
      <ol className="grid gap-3 md:grid-cols-2 xl:hidden">
        {rows.map((row) => (
          <li key={row.period.start} className="flex flex-col gap-3 rounded-2xl border-[1.5px] border-line bg-surface p-4">
            <div className="flex items-center justify-between gap-3">
              <PaydayName row={row} />
              <StatusTag status={row.status} />
            </div>
            <CardNumbers totals={row.totals} />
          </li>
        ))}
      </ol>

      {/* 1280px and up: the table (it needs the width). */}
      <div className="hidden overflow-x-auto rounded-2xl border-[1.5px] border-line bg-surface xl:block">
        <table className="w-full text-sm">
          <caption className="sr-only">Planned totals for each payday</caption>
          <thead>
            <tr className="border-b border-line text-xs font-extrabold tracking-wide text-text-3 uppercase">
              <th scope="col" className="px-3 py-3 text-left">
                Payday
              </th>
              {COLUMNS.map(({ key, label }) => (
                <th key={key} scope="col" className="px-2.5 py-3 text-right whitespace-nowrap">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.period.start} className="border-b border-line-soft">
                <th scope="row" className="px-3 py-2.5 text-left font-normal whitespace-nowrap">
                  <span className="flex flex-col items-start gap-1">
                    <PaydayName row={row} />
                    <StatusTag status={row.status} />
                  </span>
                </th>
                {COLUMNS.map(({ key }) => (
                  <td
                    key={key}
                    className={cn(
                      "px-2.5 py-2.5 text-right whitespace-nowrap",
                      key === "planned" || key === "notAssigned" ? "font-extrabold" : "text-text-2",
                      key === "notAssigned" && notAssignedTone(row.totals[key]),
                    )}
                  >
                    {formatPeso(row.totals[key])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-bg font-extrabold">
              <th scope="row" className="px-3 py-3 text-left text-ink">
                Total
              </th>
              {COLUMNS.map(({ key }) => (
                <td key={key} className={cn("px-2.5 py-3 text-right whitespace-nowrap", key === "notAssigned" ? notAssignedTone(total[key]) : "text-ink")}>
                  {formatPeso(total[key])}
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Phones: the Total as its own card. */}
      <section aria-labelledby="overview-total" className="flex flex-col gap-3 rounded-2xl border-[1.5px] border-line bg-bg p-4 xl:hidden">
        <h2 id="overview-total" className="font-extrabold text-ink">
          Total, {rows.length} paydays
        </h2>
        <CardNumbers totals={total} />
      </section>

      <p className="text-[13px] text-text-3">
        Not assigned here is each payday&apos;s money in minus what&apos;s planned, before any leftover carried in. Preview paydays aren&apos;t
        opened yet: they show what the Plan would start them with today. You can edit up to 3 months ahead on the Plan.
      </p>
    </div>
  );
}
