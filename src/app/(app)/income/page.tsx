import { Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { HeaderStickerLink, PageHeader } from "@/components/shell/page-header";
import { PageShell } from "@/components/shell/page-shell";
import { Skeleton, SkeletonRegion } from "@/components/skeleton";
import { LogOneTimeIncomeButton } from "@/components/transactions/add-transaction-provider";
import { getOrCreatePeriod, loadEarlyStarts } from "@/lib/budget-periods";
import {
  expectedIncome,
  incomeResult,
  isActiveOn,
  receivedOn,
  sourceScheduleLine,
  sourceStatusLines,
  type StatusLine,
  type UpcomingPayday,
  upcomingPaydays,
} from "@/lib/income";
import { formatPeso } from "@/lib/money";
import {
  describeSchedule,
  formatShortDate,
  getPeriod,
  type PaySchedule,
  type PaySlot,
  scheduleFromBudget,
  todayInManila,
} from "@/lib/periods";
import { requireAppUser } from "@/lib/require-app-user";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { IncomeSheet } from "./income-sheet";

export const metadata: Metadata = { title: "Income · Chiwawallet" };

const ADD_HREF = "/income?add=1";
/** Recently received shows the last four (income.md §2). */
const RECENT_ROWS = 4;

// The Income screen (income.md): expected amounts per payday and per month,
// each source's Received or Expected status this period, Recently received,
// and Log one-time income (week-3-tasks.md 3d).
export default function IncomePage() {
  return (
    <PageShell>
      {/* Cache Components: the header shows the budget's pay schedule, which
          needs the login (cookies), so header and body stream in together. */}
      <Suspense fallback={<IncomeSkeleton />}>
        <IncomeContent />
      </Suspense>
    </PageShell>
  );
}

type Source = {
  id: string;
  name: string;
  amount: number;
  amount_varies: boolean;
  pay_slot: string;
  start_date: string;
  end_date: string | null;
};

async function IncomeContent() {
  const { budget } = await requireAppUser();
  const supabase = await createClient();
  const { data: sources, error } = await supabase
    .from("income_sources")
    .select("id, name, amount, amount_varies, pay_slot, start_date, end_date")
    .eq("budget_id", budget.id)
    .order("created_at", { ascending: true });
  if (error) throw new Error(`Couldn't load income sources: ${error.message}`, { cause: error });

  const schedule = scheduleFromBudget(budget);
  const today = todayInManila(new Date());
  // Paying now, starting later, or ended (plan review 3.2).
  const active = sources.filter((s) => isActiveOn(s, today));
  const upcoming = sources.filter((s) => s.start_date > today);
  const ended = sources.filter((s) => s.end_date != null && s.end_date < today);
  const totals = expectedIncome(active, schedule);

  // This period's income (for Received) and the latest pay from sources.
  // The Dashboard creates the period the same way when it's missing.
  const period = await getOrCreatePeriod(supabase, budget, today);
  // A period that started early is the current one from its first day (Task D2).
  const early = await loadEarlyStarts(supabase, budget.id);
  const [periodIncome, recent] = await Promise.all([
    supabase
      .from("transactions")
      .select("type, income_source_id, date, deleted_at")
      .eq("period_id", period.id)
      .eq("type", "income")
      .is("deleted_at", null),
    supabase
      .from("transactions")
      .select("id, amount, date, note, income_source_id")
      .eq("type", "income")
      .is("deleted_at", null)
      .order("date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(RECENT_ROWS),
  ]);
  for (const result of [periodIncome, recent]) {
    if (result.error) throw new Error(`Couldn't load income: ${result.error.message}`, { cause: result.error });
  }
  const received = receivedOn(
    periodIncome.data!,
    // The column's check constraint allows only the three pay slots.
    { start: period.start_date, paySlot: period.pay_slot as PaySlot, first_pay_received: period.first_pay_received },
    sources,
    schedule,
  );
  const statusFor = (s: Source) => sourceStatusLines(s, schedule, today, received.get(s.id) ?? null, early);
  const byId = new Map(sources.map((s) => [s.id, s]));
  const recentRows: RecentRow[] = recent.data!.map((row) => ({
    id: row.id,
    amount: row.amount,
    date: row.date,
    // One-time income has no source; its name is the note. A deleted source
    // also leaves the link empty (plan review 3.6), with no note: "Income".
    source: row.income_source_id ? (byId.get(row.income_source_id) ?? null) : null,
    name: row.note ?? "Income",
  }));

  return (
    <>
      <PageHeader
        title="Income"
        desktopTitle="Income sources"
        eyebrow={describeSchedule(schedule)}
        mobile={{ backHref: "/more", backLabel: "Back to More" }}
        mobileAction={
          <Link
            href={ADD_HREF}
            scroll={false}
            aria-label="Add income source"
            className="flex size-11 items-center justify-center rounded-[14px] border-2 border-sticker bg-green-500 text-white shadow-sticker-sm outline-link focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            <Plus aria-hidden size={22} strokeWidth={2.5} />
          </Link>
        }
        desktopAction={<HeaderStickerLink href={ADD_HREF}>Add income source</HeaderStickerLink>}
      />

      {sources.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          <Summary totals={totals} active={active} />
          <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
            <div className="flex flex-col gap-6">
              <SourceList title="Sources" sources={active} schedule={schedule} statusFor={statusFor} />
              {upcoming.length > 0 && (
                <SourceList title="Starting later" sources={upcoming} schedule={schedule} statusFor={statusFor} />
              )}
              {ended.length > 0 && <SourceList title="Ended" sources={ended} schedule={schedule} />}
            </div>
            <div className="flex flex-col gap-6">
              <UpcomingPaydays
                paydays={upcomingPaydays(today, schedule, sources, 4, new Set(received.keys()), early)}
                schedule={schedule}
              />
              <RecentlyReceived rows={recentRows} />
            </div>
          </div>
        </>
      )}

      <LogOneTimeIncomeButton />

      <IncomeSheet
        sources={sources}
        activeIds={active.map((s) => s.id)}
        schedule={schedule}
        defaultStart={getPeriod(today, schedule).start}
      />
    </>
  );
}

// "Expected each month" hero plus the per-payday stats (income.md §2–3).
function Summary({ totals, active }: { totals: ReturnType<typeof expectedIncome>; active: Source[] }) {
  return (
    <section aria-label="Expected income" className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4">
      {/* The page's one hero: Deep Green, white text, sticker border. */}
      <div className="col-span-2 flex flex-col gap-1 rounded-xl border-2 border-sticker bg-green-700 p-5 text-white shadow-sticker md:col-span-1">
        <p className="text-sm font-bold opacity-90">
          {totals.perMonthIsEstimate ? "About each month" : "Expected each month"}
        </p>
        <p className="font-display text-[34px] leading-none font-semibold">{formatPeso(totals.perMonth)}</p>
        <p className="text-sm opacity-90">
          {active.length === 1 ? "1 source" : `${active.length} sources`}
          <span className="hidden md:inline">{active.length > 0 && ` · ${active.map((s) => s.name).join(" + ")}`}</span>
        </p>
      </div>
      {totals.paydays.map((p) => (
        <div key={p.slot} className="flex flex-col gap-1 rounded-xl border-[1.5px] border-line bg-surface p-4">
          <p className="text-[13px] font-bold text-text-3">
            {p.slot === "every" ? `Each payday (${p.label})` : `${p.label} payday`}
          </p>
          <p className="font-display text-[22px] leading-none font-semibold text-ink">{formatPeso(p.total)}</p>
        </div>
      ))}
    </section>
  );
}

function SourceList({
  title,
  sources,
  schedule,
  statusFor,
}: {
  title: string;
  sources: Source[];
  schedule: PaySchedule;
  /** Status lines per source; ended sources have none. */
  statusFor?: (source: Source) => StatusLine[];
}) {
  if (sources.length === 0) return null;
  const headingId = `sources-${title.toLowerCase().replace(/\s+/g, "-")}`;
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-3">
      <h2 id={headingId} className="text-xs font-extrabold tracking-wide text-text-3 uppercase">
        {title}
      </h2>
      <ul className="flex flex-col gap-3">
        {sources.map((s) => (
          <li key={s.id}>
            {/* The whole card is the Edit link (income.md §5: named with the
                source and amount, which are its text). */}
            <Link
              href={`/income?edit=${s.id}`}
              scroll={false}
              className="flex items-start justify-between gap-3 rounded-2xl border-[1.5px] border-line bg-surface p-4 outline-link hover:border-line-dash focus-visible:outline-2"
            >
              <span className="flex min-w-0 flex-col gap-1">
                <span className="text-base font-extrabold text-ink">{s.name}</span>
                <span className="text-[13px] text-text-3">{sourceScheduleLine(s, schedule)}</span>
                <SourceTags source={s} />
                {statusFor?.(s).map((line) => (
                  // "Received" and "Expected" are words, not only colours (income.md §5).
                  <span
                    key={line.text}
                    className={cn(
                      "text-[13px] font-bold",
                      line.tone === "positive" ? "text-link-hover" : "text-text-2",
                    )}
                  >
                    {line.text}
                  </span>
                ))}
              </span>
              <span className="shrink-0 text-right">
                <span className="block font-display text-xl font-semibold text-ink">{formatPeso(s.amount)}</span>
                <span className="block text-xs text-text-3">each payday</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function SourceTags({ source }: { source: Source }) {
  const tags: { text: string; tone: "info" | "neutral" }[] = [];
  if (source.amount_varies) tags.push({ text: "Varies", tone: "neutral" });
  if (source.end_date) tags.push({ text: `Ends ${formatShortDate(source.end_date)}`, tone: "info" });
  if (tags.length === 0) return null;
  return (
    <span className="flex flex-wrap gap-1.5 pt-1">
      {tags.map((t) => (
        <span
          key={t.text}
          className={cn(
            "rounded-full px-2 py-0.5 text-xs font-bold",
            t.tone === "info" ? "bg-info-bg text-info-fg" : "bg-track text-text-2",
          )}
        >
          {t.text}
        </span>
      ))}
    </span>
  );
}

// Desktop right column (income.md §3). The current payday says "Received"
// once every source paying on it is logged; the rest say "Expected".
function UpcomingPaydays({ paydays, schedule }: { paydays: UpcomingPayday[]; schedule: PaySchedule }) {
  const span =
    schedule.frequency === "weekly"
      ? "Next 4 weeks"
      : schedule.frequency === "monthly"
        ? "Next 4 months"
        : "Next 2 months";
  return (
    <section
      aria-labelledby="upcoming-title"
      className="hidden flex-col gap-3 rounded-xl border-[1.5px] border-line bg-surface p-5 lg:flex"
    >
      <div>
        <h2 id="upcoming-title" className="font-display text-lg font-semibold text-ink">
          Upcoming paydays
        </h2>
        <p className="text-[13px] text-text-3">{span}</p>
      </div>
      <ul className="flex flex-col gap-2">
        {paydays.map((p) => (
          <li key={p.date} className="flex items-center gap-3 rounded-[12px] bg-bg px-3 py-2.5">
            <span className="w-14 text-xs font-extrabold text-text-2 uppercase">{formatShortDate(p.date)}</span>
            <span className="flex-1 font-bold text-ink">{formatPeso(p.total)}</span>
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-xs font-bold",
                p.received ? "bg-mint text-link-hover" : "bg-track text-text-2",
              )}
            >
              {p.received ? "Received" : "Expected"}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

type RecentRow = {
  id: string;
  amount: number;
  date: string;
  /** Null for one-time income. */
  source: Source | null;
  /** One-time income's name (its note). */
  name: string;
};

// RECENTLY RECEIVED (income.md §2–3): the last four income entries. Pay from
// a source shows how it compared to the source's expected amount; one-time
// income has nothing to compare with, so it gets a "One-time" pill (owner,
// Nov 23: the spec listed sources only, which left it nowhere to be seen).
function RecentlyReceived({ rows }: { rows: RecentRow[] }) {
  if (rows.length === 0) return null;
  return (
    <section aria-labelledby="recent-income-title" className="flex flex-col gap-3">
      <h2 id="recent-income-title" className="text-xs font-extrabold tracking-wide text-text-3 uppercase">
        Recently received
      </h2>
      <ul className="flex flex-col divide-y divide-line-soft rounded-2xl border-[1.5px] border-line bg-surface">
        {rows.map((row) => {
          // A status pill (style-guide.md): Warning or Positive for pay from a
          // source, Info (the neutral tag) for one-time income. All are fixed
          // pairs that read the same in light and dark.
          const result = row.source
            ? incomeResult(row.amount, row.source.amount)
            : { text: "One-time", tone: "info" as const };
          return (
            <li key={row.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <span className="flex min-w-0 flex-col items-start gap-1">
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-xs font-extrabold",
                    result.tone === "warn" && "bg-warn-bg text-warn-fg",
                    result.tone === "positive" && "bg-mint text-link-hover",
                    result.tone === "info" && "bg-info-bg text-info-fg",
                  )}
                >
                  {result.text}
                </span>
                <span className="max-w-full truncate text-[13px] text-text-3">
                  {formatShortDate(row.date)} · {row.source?.name ?? row.name}
                </span>
              </span>
              <span className="shrink-0 font-display text-lg font-semibold text-link">
                {formatPeso(row.amount, { signed: true })}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

// Shown while the sources load: the same layout as the real page (header,
// hero, payday stats, source cards, desktop Upcoming paydays), all in grey.
function IncomeSkeleton() {
  return (
    <SkeletonRegion className="flex flex-col gap-4 md:gap-6">
      {/* Header: mobile back + title + add button; desktop eyebrow + title + button */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-col gap-1.5">
          <Skeleton className="hidden h-4 w-40 md:block" />
          <Skeleton className="h-8 w-44" />
        </div>
        <Skeleton className="size-11 rounded-[14px] md:h-12 md:w-48" />
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4">
        <Skeleton className="col-span-2 h-[124px] rounded-xl md:col-span-1" />
        <Skeleton className="h-[78px] rounded-xl" />
        <Skeleton className="h-[78px] rounded-xl" />
      </div>

      <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
        <div className="flex flex-col gap-3">
          <Skeleton className="h-3.5 w-20" />
          <Skeleton className="h-[84px] rounded-2xl" />
          <Skeleton className="h-[84px] rounded-2xl" />
        </div>
        <Skeleton className="hidden h-[280px] rounded-xl lg:block" />
      </div>
    </SkeletonRegion>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-4 py-12 text-center">
      {/* eslint-disable-next-line @next/next/no-img-element -- static SVG, no optimisation needed */}
      <img src="/logo-mark.svg" alt="" width={88} height={88} />
      <p className="text-[15px] text-text-3">No income sources yet.</p>
      <Link
        href={ADD_HREF}
        scroll={false}
        className="flex h-12 items-center rounded-md bg-primary px-6 font-extrabold text-primary-foreground outline-link focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        Add your first income source
      </Link>
    </div>
  );
}
