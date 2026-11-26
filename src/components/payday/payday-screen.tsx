"use client";

import { Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { closeWithChoice } from "@/app/(app)/plan/actions";
import { Logo } from "@/components/auth/logo";
import { FormError } from "@/components/auth/form-error";
import { formatPeso } from "@/lib/money";
import { formatPeriodRange } from "@/lib/periods";
import { coverFromPot, type LeftoverChoice, leftoverChoices, paydayPreview } from "@/lib/plan";
import type { PaydayData } from "@/lib/plan-periods";
import { cn } from "@/lib/utils";

// The payday screen (payday-rollover.md, task 6h-2): how the last period
// went, what to do with its leftover, and the new period. Every number comes
// from lib/plan.ts. Both buttons confirm the choice shown (Carry unless
// changed), which closes the old period on the server.
export function PaydayScreen({ data }: { data: PaydayData }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();
  const [choice, setChoice] = useState<LeftoverChoice["value"]>("carry");
  const [coverPotId, setCoverPotId] = useState(data.coverPots[0]?.id ?? "");
  const heading = useRef<HTMLHeadingElement>(null);

  // Focus starts on the h1, so screen readers hear "It's payday" first (§5).
  useEffect(() => heading.current?.focus(), []);

  const { leftover, money, used } = data.review;
  const overspent = leftover < 0;
  const oldRange = formatPeriodRange(data.old.start, data.old.end);
  const newRange = formatPeriodRange(data.current.start, data.current.end);
  const choices = leftoverChoices({ leftover, expected: data.expected, pot: data.pot, debt: data.debt });
  const coverPot = data.coverPots.find((p) => p.id === coverPotId);
  const cover = overspent && choice === "pot" && coverPot ? coverFromPot(-leftover, coverPot.balance) : null;
  // What the choice takes out of the leftover; a cover brings money back in.
  const moved = cover ? -cover.covered : (choices.find((c) => c.value === choice)?.moved ?? 0);
  const preview = paydayPreview(data.expected, leftover, moved, data.planned);
  const usedShare = money > 0 ? Math.min(1, used / money) : 1;

  const confirm = (then: "plan" | "dashboard") => {
    setError(undefined);
    startTransition(async () => {
      const result = await closeWithChoice({ start: data.old.start, choice, potId: choice === "pot" && overspent ? coverPotId : undefined });
      if (!result.ok) return setError(result.formError ?? "Couldn't save that.");
      const start = result.currentStart ?? data.current.start;
      // Split it myself: Give leftover a job on the new period (owner, Nov 26).
      router.push(then === "dashboard" ? "/" : choice === "split" ? `/plan/assign?start=${start}` : `/plan?start=${start}`);
      router.refresh();
    });
  };

  return (
    <div className="flex flex-col gap-4 pt-4 md:mx-auto md:max-w-[1080px]">
      <header className="flex flex-col items-center gap-2 text-center">
        <span aria-hidden className="flex size-28 items-center justify-center rounded-full bg-mint">
          <Logo size={72} decorative />
        </span>
        <p className="text-[13px] font-extrabold tracking-wider text-green-600 uppercase">It&apos;s payday</p>
        <h1 ref={heading} tabIndex={-1} className="font-display text-[30px] leading-tight font-semibold text-ink outline-none">
          {newRange} has started
        </h1>
      </header>

      <div className="flex flex-col gap-4 md:flex-row md:items-start">
        <div className="flex flex-col gap-4 md:flex-[1_1_420px]">
          {/* How it went (§3.2). */}
          <section aria-labelledby="went-title" className="flex flex-col gap-3 rounded-[20px] border-[1.5px] border-line bg-surface p-5">
            <div className="flex items-center justify-between gap-2">
              <h2 id="went-title" className="font-extrabold text-ink">
                How {oldRange} went
              </h2>
              <span className="rounded-full bg-track px-2 py-0.5 text-xs font-extrabold text-text-2">Closed</span>
            </div>
            <p className="font-display text-2xl font-semibold text-ink">
              {overspent ? `${formatPeso(-leftover)} over` : `Left over: ${formatPeso(leftover)}`}
            </p>
            <div className="flex flex-col gap-1">
              <span aria-hidden className="block h-2.5 overflow-hidden rounded-full bg-track">
                <span className={cn("block h-full rounded-full", overspent ? "bg-gold" : "bg-green-500")} style={{ width: `${usedShare * 100}%` }} />
              </span>
              <span className="text-[13px] text-text-3">
                {formatPeso(used)} used of {formatPeso(money)}
              </span>
            </div>
            {data.wins.length > 0 && (
              <ul className="flex flex-col gap-2">
                {data.wins.map((w) => (
                  <li key={w.title} className="flex items-center gap-3">
                    <span aria-hidden className="flex size-8 shrink-0 items-center justify-center rounded-[10px] bg-mint text-green-800">
                      <Check size={18} strokeWidth={3} />
                    </span>
                    <span className="text-sm">
                      <span className="font-extrabold text-ink">{w.title}</span> <span className="text-text-2">· {w.detail}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* What should happen to the leftover (§3.3): the area's one sticker. */}
          {choices.length > 0 && (
            <section
              aria-labelledby="choice-title"
              className="flex flex-col gap-3 rounded-[22px] border-2 border-sticker bg-surface p-5 shadow-sticker"
            >
              <div className="flex flex-col gap-1">
                <h2 id="choice-title" className="font-display text-xl font-semibold text-ink">
                  {overspent ? `${formatPeso(-leftover)} over` : `What should happen to the ${formatPeso(leftover)}?`}
                </h2>
                {overspent && <p className="text-sm text-text-2">That&apos;s okay. It&apos;ll come out of this payday.</p>}
              </div>
              <div role="radiogroup" aria-labelledby="choice-title" className="flex flex-col gap-2">
                {choices.map((c) => {
                  const checked = choice === c.value;
                  const effect =
                    c.value === "pot" && overspent
                      ? cover
                        ? cover.stillOver > 0
                          ? `Covers ${formatPeso(cover.covered)}; ${formatPeso(cover.stillOver)} still comes out of this payday`
                          : `Covers all ${formatPeso(cover.covered)} from ${coverPot!.name}`
                        : "Pick a pot below"
                      : c.effect;
                  return (
                    <label
                      key={c.value}
                      className={cn(
                        "flex cursor-pointer flex-col gap-0.5 rounded-[14px] px-4 py-3 has-focus-visible:outline-2 has-focus-visible:outline-link",
                        checked ? "border-2 border-green-600 bg-mint" : "border-[1.5px] border-line bg-surface",
                      )}
                    >
                      <input
                        type="radio"
                        name="leftover-choice"
                        value={c.value}
                        checked={checked}
                        onChange={() => setChoice(c.value)}
                        aria-describedby={`choice-${c.value}-effect`}
                        className="sr-only"
                      />
                      <span className="font-extrabold text-ink">{c.label}</span>
                      <span id={`choice-${c.value}-effect`} className="text-[13px] text-text-2">
                        {effect}
                      </span>
                    </label>
                  );
                })}
              </div>
              {overspent && choice === "pot" && data.coverPots.length > 0 && (
                <fieldset className="flex flex-col gap-2">
                  <legend className="mb-1 text-sm font-bold text-ink">Which pot?</legend>
                  {data.coverPots.map((p) => (
                    <label
                      key={p.id}
                      className={cn(
                        "flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-[12px] px-3 py-2 has-focus-visible:outline-2 has-focus-visible:outline-link",
                        coverPotId === p.id ? "border-2 border-green-600 bg-mint" : "border-[1.5px] border-line",
                      )}
                    >
                      <input type="radio" name="cover-pot" checked={coverPotId === p.id} onChange={() => setCoverPotId(p.id)} className="sr-only" />
                      <span className="font-bold text-ink">{p.name}</span>
                      <span className="text-sm text-text-3">{formatPeso(p.balance)}</span>
                    </label>
                  ))}
                </fieldset>
              )}
            </section>
          )}
        </div>

        <div className="flex flex-col gap-4 md:flex-[1_1_420px]">
          {/* Your new period is ready (§3.4): updates with the choice. */}
          <section aria-labelledby="ready-title" className="flex flex-col gap-3 rounded-[20px] border-[1.5px] border-line bg-surface p-5">
            <h2 id="ready-title" className="font-extrabold text-ink">
              Your new period is ready
            </h2>
            <ul aria-live="polite" className="flex flex-col gap-1.5 text-sm">
              {data.incomeRows.map((r) => (
                <li key={r.name} className="flex justify-between gap-3">
                  <span className="text-text-2">
                    {r.name} · {r.detail}
                  </span>
                  <span className="font-bold text-ink">{formatPeso(r.amount)}</span>
                </li>
              ))}
              <li className="flex justify-between gap-3">
                <span className="text-text-2">Carried in</span>
                <span className="font-bold text-ink">{formatPeso(preview.carriedIn)}</span>
              </li>
              <li className="flex justify-between gap-3 border-t border-line-soft pt-1.5">
                <span className="font-extrabold text-ink">Money for this period</span>
                <span className="font-extrabold text-ink">{formatPeso(preview.money)}</span>
              </li>
            </ul>
            {data.plannedRows.length > 0 && (
              <div className="flex flex-col gap-1.5">
                <h3 className="text-xs font-extrabold tracking-wide text-text-3 uppercase">Already planned from your repeats</h3>
                <ul className="flex flex-col gap-1 text-sm">
                  {data.plannedRows.map((r, i) => (
                    <li key={`${r.name}-${i}`} className="flex justify-between gap-3">
                      <span className="min-w-0 truncate text-text-2">
                        {r.name} · {r.detail}
                      </span>
                      <span className="shrink-0 font-bold text-ink">{formatPeso(r.amount)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <p aria-live="polite" className="flex justify-between gap-3 rounded-[12px] bg-warn-bg px-3 py-2 text-sm font-extrabold text-warn-fg">
              <span>Not assigned yet</span>
              <span>{formatPeso(preview.notAssigned)}</span>
            </p>
          </section>

          <FormError message={error} />
          <div className="flex flex-col gap-2 md:flex-row">
            <button
              type="button"
              onClick={() => confirm("plan")}
              disabled={pending}
              aria-busy={pending || undefined}
              className="flex h-14 items-center justify-center rounded-md border-2 border-sticker bg-green-500 px-5 text-base font-extrabold text-white shadow-sticker-sm outline-link focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-70 md:flex-1"
            >
              {pending ? "Saving…" : choice === "split" ? "Give it a job" : "Review my plan"}
            </button>
            <button
              type="button"
              onClick={() => confirm("dashboard")}
              disabled={pending}
              className="flex h-14 items-center justify-center rounded-md px-5 text-base font-extrabold text-link outline-link focus-visible:outline-2 disabled:opacity-70 md:flex-1 md:border-[1.5px] md:border-line md:bg-surface md:text-ink"
            >
              Go to dashboard
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
