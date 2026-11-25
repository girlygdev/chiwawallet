import { formatPeso } from "@/lib/money";
import { formatPeriodRange, type Period } from "@/lib/periods";
import type { PlanSummary } from "@/lib/plan";
import type { PlanRow } from "@/lib/plan-periods";
import { cn } from "@/lib/utils";

type Section = Exclude<PlanRow["section"], "income">;

const SECTIONS: { key: Section; title: string }[] = [
  { key: "bills", title: "Bills" },
  { key: "debts", title: "Debt payments" },
  { key: "savings", title: "Savings" },
  { key: "spending", title: "Spending budgets" },
  { key: "one_off", title: "One-off items" },
];

// The Plan's group sections (plan.md §3): MONEY IN, then bills, debt
// payments, savings, spending budgets and one-off items. Headings show the
// group's total; "₱1,700 of ₱2,700 paid" comes with ticking items (Week 6).
// Empty groups are hidden, except One-off items, which explains itself.
export function PlanGroups({
  items,
  income,
  carriedIn,
  previous,
  summary,
}: {
  items: PlanRow[];
  income: number;
  carriedIn: number | null;
  previous: Period;
  summary: PlanSummary;
}) {
  const incomeRows = items.filter((i) => i.section === "income");

  return (
    <div className="flex flex-col gap-5">
      <Group id="money-in" title="Money in" total={income + (carriedIn ?? 0)}>
        <ul className={LIST}>
          {incomeRows.map((i) => (
            <li key={i.id} className={ROW}>
              <div className="flex min-w-0 flex-col">
                <span className="truncate font-extrabold text-ink">{i.name}</span>
                {/* "Received" or "Expected Nov 30": words, with colour only as a hint. */}
                <span className={cn("text-[13px] font-bold", i.received ? "text-link-hover" : "text-text-3")}>{i.detail}</span>
              </div>
              <span className="shrink-0 font-extrabold text-ink">{formatPeso(i.planned_amount)}</span>
            </li>
          ))}
          <li className={ROW}>
            <div className="flex min-w-0 flex-col">
              <span className="font-extrabold text-ink">Carried in</span>
              <span className="text-[13px] text-text-3">Left over from {formatPeriodRange(previous.start, previous.end)}</span>
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

      {SECTIONS.map(({ key, title }) => {
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
                {rows.map((i) => (key === "spending" ? <SpendingRow key={i.id} item={i} /> : <TickRow key={i.id} item={i} />))}
              </ul>
            )}
          </Group>
        );
      })}
    </div>
  );
}

const LIST = "flex flex-col divide-y divide-line-soft rounded-2xl border-[1.5px] border-line bg-surface";
const ROW = "flex min-h-14 items-center justify-between gap-3 px-4 py-3";

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
function TickRow({ item }: { item: PlanRow }) {
  return (
    <li className={ROW}>
      <div className="flex min-w-0 items-center gap-3">
        <span aria-hidden className="size-7 shrink-0 rounded-full border-2 border-line-dash bg-surface" />
        <div className="flex min-w-0 flex-col">
          <span className="truncate font-extrabold text-ink">{item.name}</span>
          <span className="text-[13px] text-text-3">{item.detail}</span>
        </div>
      </div>
      <span className="shrink-0 font-extrabold text-ink">{formatPeso(item.planned_amount)}</span>
    </li>
  );
}

// A spending budget: the name, its group and the planned amount. What's
// spent and left, with the bar, comes with planned vs actual (Week 6).
function SpendingRow({ item }: { item: PlanRow }) {
  return (
    <li className={ROW}>
      <span className="min-w-0 truncate">
        <span className="font-extrabold text-ink">{item.name}</span>
        <span className="text-text-3"> · {item.detail}</span>
      </span>
      <span className="shrink-0 font-extrabold text-ink">{formatPeso(item.planned_amount)}</span>
    </li>
  );
}
