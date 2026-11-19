"use client";

import { Pencil, Plus } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Sheet } from "@/components/sheet";
import { expectedIncome } from "@/lib/income";
import { formatPeso } from "@/lib/money";
import { ONBOARDING_PATHS } from "@/lib/onboarding";
import { type PaySchedule, paydayLabel } from "@/lib/periods";
import { cn } from "@/lib/utils";
import { IncomeForm, type IncomeSource } from "@/components/income/income-form";
import { addIncome, removeIncome, updateIncome } from "../actions";

type SheetState = { mode: "add" } | { mode: "edit"; source: IncomeSource } | null;

// Step 2 "Income" (onboarding.md §4): the sources so far, the expected totals,
// and adding or editing sources. Each change saves right away.
export function IncomeStep({ sources, schedule }: { sources: IncomeSource[]; schedule: PaySchedule }) {
  const [sheet, setSheet] = useState<SheetState>(null);
  const semiMonthly = schedule.frequency === "semi_monthly";
  const hasIncome = sources.length > 0;

  const tagFor = (slot: string) =>
    slot === "every" ? "Every payday" : `${paydayLabel(schedule, slot === "payday_2" ? "payday_2" : "payday_1")} only`;

  const others = (except?: IncomeSource) => sources.filter((s) => s.id !== except?.id);

  return (
    <div className="flex flex-1 flex-col gap-[18px] lg:gap-8">
      <div className="flex flex-wrap items-start gap-8">
        <div className="flex max-w-[680px] min-w-0 flex-[999_1_420px] flex-col gap-4">
          {/* Mobile: one card per source. */}
          {hasIncome && (
            <ul className="flex flex-col gap-3 lg:hidden">
              {sources.map((s) => (
                <li key={s.id} className="flex flex-col gap-2 rounded-2xl border-[1.5px] border-line bg-surface p-3.5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-base font-extrabold text-ink">{s.name}</p>
                    <EditButton name={s.name} onClick={() => setSheet({ mode: "edit", source: s })} />
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-display text-2xl font-semibold text-ink">{formatPeso(s.amount)}</p>
                    {semiMonthly && <LandsOnTag slot={s.pay_slot} text={tagFor(s.pay_slot)} />}
                  </div>
                </li>
              ))}
            </ul>
          )}

          {/* Desktop: a table. */}
          {hasIncome && (
            <div className="hidden overflow-x-auto rounded-[18px] border-[1.5px] border-line bg-surface lg:block">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-xs font-extrabold tracking-wide text-text-3 uppercase">
                    <th scope="col" className="px-4 py-3">Income</th>
                    <th scope="col" className="px-4 py-3 text-right">Amount</th>
                    {semiMonthly && <th scope="col" className="px-4 py-3">Lands on</th>}
                    <th scope="col" className="w-14 px-2 py-3">
                      <span className="sr-only">Edit</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sources.map((s) => (
                    <tr key={s.id} className="border-t border-line-soft">
                      <td className="px-4 py-2 font-extrabold text-ink">{s.name}</td>
                      <td className="px-4 py-2 text-right font-bold text-ink">{formatPeso(s.amount)}</td>
                      {semiMonthly && (
                        <td className="px-4 py-2">
                          <LandsOnTag slot={s.pay_slot} text={tagFor(s.pay_slot)} />
                        </td>
                      )}
                      <td className="px-2 py-1">
                        <EditButton name={s.name} onClick={() => setSheet({ mode: "edit", source: s })} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Mobile: opens the New income sheet. */}
          <button
            type="button"
            onClick={() => setSheet({ mode: "add" })}
            className="flex h-[52px] items-center justify-center gap-2 rounded-2xl border-[1.5px] border-dashed border-line-dash bg-surface text-[15px] font-extrabold text-link outline-link focus-visible:outline-2 lg:hidden"
          >
            <Plus aria-hidden size={20} />
            {hasIncome ? "Add another income" : "Add your income"}
          </button>

          {/* Desktop: the inline add form in a dashed box. */}
          <section
            aria-labelledby="add-income-title"
            className="hidden flex-col gap-3 rounded-[18px] border-[1.5px] border-dashed border-line-dash p-5 lg:flex"
          >
            <h2 id="add-income-title" className="text-base font-extrabold text-ink">
              {hasIncome ? "Add another income" : "Add your income"}
            </h2>
            <IncomeForm layout="inline" schedule={schedule} otherSources={sources} onSave={addIncome} />
          </section>
        </div>

        <ExpectedPreview sources={sources} schedule={schedule} />
      </div>

      <div className="mt-auto flex flex-col gap-3 lg:mt-0 lg:flex-row lg:items-center lg:justify-between">
        <Link
          href={ONBOARDING_PATHS.budget}
          className="hidden h-[54px] items-center justify-center rounded-md border-[1.5px] border-line bg-surface px-6 text-[17px] font-extrabold text-ink outline-link focus-visible:outline-2 lg:flex"
        >
          Back
        </Link>
        <div className="flex flex-col gap-2 lg:items-end">
          {!hasIncome && (
            <p id="continue-hint" className="text-center text-[13px] text-text-3 lg:text-right">
              Add at least one income to continue.
            </p>
          )}
          {hasIncome ? (
            <Link
              href={ONBOARDING_PATHS.start}
              className="flex h-[54px] w-full items-center justify-center rounded-md bg-primary px-6 text-[17px] font-extrabold text-primary-foreground outline-link hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 lg:w-auto lg:min-w-64"
            >
              <span className="lg:hidden">Continue</span>
              <span className="hidden lg:inline">Continue to starting point</span>
            </Link>
          ) : (
            <button
              type="button"
              disabled
              aria-describedby="continue-hint"
              className="flex h-[54px] w-full items-center justify-center rounded-md bg-track px-6 text-[17px] font-extrabold text-text-3 lg:w-auto lg:min-w-64"
            >
              Continue
            </button>
          )}
        </div>
      </div>

      <Sheet
        open={sheet != null}
        onOpenChange={(open) => !open && setSheet(null)}
        title={sheet?.mode === "edit" ? "Edit income source" : "New income source"}
        description="Money you expect regularly, like a job, side gig or allowance."
      >
        {sheet && (
          <IncomeForm
            // A new form for each source, so its fields start from that source.
            key={sheet.mode === "edit" ? sheet.source.id : "add"}
            layout="sheet"
            schedule={schedule}
            source={sheet.mode === "edit" ? sheet.source : undefined}
            otherSources={others(sheet.mode === "edit" ? sheet.source : undefined)}
            onSave={(input) => (sheet.mode === "edit" ? updateIncome(sheet.source.id, input) : addIncome(input))}
            onRemove={sheet.mode === "edit" ? () => removeIncome(sheet.source.id) : undefined}
            onDone={() => setSheet(null)}
          />
        )}
      </Sheet>
    </div>
  );
}

function EditButton({ name, onClick }: { name: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Edit ${name}`}
      className="flex size-11 shrink-0 items-center justify-center rounded-full text-text-2 outline-link hover:bg-bg focus-visible:outline-2"
    >
      <Pencil aria-hidden size={18} />
    </button>
  );
}

// "Every payday" is positive (mint); one payday only is a heads-up (yellow).
function LandsOnTag({ slot, text }: { slot: string; text: string }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2.5 py-1 text-xs font-extrabold whitespace-nowrap",
        slot === "every" ? "bg-mint text-link-hover" : "bg-warn-bg text-warn-fg",
      )}
    >
      {text}
    </span>
  );
}

// "EXPECTED PER PAYDAY" (onboarding.md §4): two numbers on mobile; bars and a
// month total on desktop. Totals come from expectedIncome().
function ExpectedPreview({ sources, schedule }: { sources: IncomeSource[]; schedule: PaySchedule }) {
  const expected = expectedIncome(sources, schedule);
  const biggest = Math.max(1, ...expected.paydays.map((p) => p.total));

  return (
    <section
      aria-labelledby="expected-title"
      className="order-first w-full rounded-[20px] border-2 border-sticker bg-surface p-4 shadow-sticker lg:order-none lg:max-w-[380px] lg:min-w-[280px] lg:flex-[1_1_280px] lg:p-5 lg:shadow-sticker-lg"
    >
      <h2 id="expected-title" className="text-xs font-extrabold tracking-wide text-text-3 uppercase">
        Expected per payday
      </h2>
      <div aria-live="polite" className="mt-3 flex flex-col gap-3">
        <div className="flex gap-6 lg:flex-col lg:gap-4">
          {expected.paydays.map((p) => (
            <div key={p.slot} className="flex flex-col gap-1.5">
              <p className="text-[13px] font-bold text-text-3">{p.slot === "every" ? `Each payday (${p.label})` : p.label}</p>
              <p className="font-display text-[22px] leading-none font-semibold text-ink lg:text-2xl">
                {formatPeso(p.total)}
              </p>
              <div aria-hidden className="hidden h-2.5 overflow-hidden rounded-full bg-track lg:block">
                <div className="h-full rounded-full bg-green-500" style={{ width: `${(p.total / biggest) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
        <div className="hidden border-t border-line-soft pt-3 lg:block">
          <p className="flex items-baseline justify-between font-extrabold text-link">
            <span>{expected.perMonthIsEstimate ? "About each month" : "Per month"}</span>
            <span className="font-display text-xl">{formatPeso(expected.perMonth)}</span>
          </p>
        </div>
      </div>
    </section>
  );
}
