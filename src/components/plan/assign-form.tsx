"use client";

import { CreditCard, Minus, PiggyBank, Plus, Wallet } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { assignLeftover, undoAssign } from "@/app/(app)/plan/actions";
import { FormError } from "@/components/auth/form-error";
import { useAppToast } from "@/components/transactions/add-transaction-provider";
import { formatPeso, formatPesoInput, parsePesoInput } from "@/lib/money";
import { type AssignPreset, assignEffect, assignPreset, assignState, fitAssign, stepAssign } from "@/lib/plan";
import type { AssignDestination } from "@/lib/plan-periods";
import { cn } from "@/lib/utils";

const BUFFER = "buffer";

/** The stacked bar's colours, in row order; the buffer is always the last. */
const SEGMENTS = ["bg-green-600", "bg-gold", "bg-info-fg", "bg-cat-purple-fg", "bg-cat-orange-fg"];

const PRESETS: { value: AssignPreset; label: string }[] = [
  { value: "save_all", label: "Save it all" },
  { value: "debt_first", label: "Debt first, then save" },
  { value: "keep_all", label: "Keep it all" },
  { value: "start_over", label: "Start over" },
];

// Give leftover a job (plan.md §7, task 6f): the Remaining card, the
// presets, one row per pot and debt plus Keep as buffer, the totals and the
// button. Amounts are centavos; every sum and limit comes from lib/plan.ts.
// Saving adds one `assigned` plan item per pot and debt; the buffer saves
// nothing. Then back to the Plan, with Undo in the toast.
export function AssignForm({
  total,
  periodStart,
  destinations,
  potKey,
  debtKey,
  next,
  initialPreset,
  backHref,
}: {
  /** Not assigned yet. */
  total: number;
  periodStart: string;
  destinations: AssignDestination[];
  /** The preset's pot and debt (first pot not full, earliest debt). */
  potKey: string | null;
  debtKey: string | null;
  /** The next period's dates: "Carries over to Nov 30 – Dec 14". */
  next: string;
  /** From the Plan's shortcuts. */
  initialPreset: AssignPreset | null;
  backHref: string;
}) {
  const router = useRouter();
  const showToast = useAppToast();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();
  const [amounts, setAmounts] = useState<Record<string, number>>(() =>
    initialPreset ? assignPreset(initialPreset, total, destinations, potKey, debtKey) : {},
  );
  // The row whose amount is being typed (the "keypad"), and its text.
  const [typing, setTyping] = useState<{ key: string; text: string } | null>(null);

  const amountOf = (key: string) => amounts[key] ?? 0;
  const toDestinations = destinations.reduce((sum, d) => sum + amountOf(d.key), 0);
  const buffer = amountOf(BUFFER);
  const state = assignState(total, toDestinations, buffer);
  const set = (key: string, amount: number) => setAmounts((all) => ({ ...all, [key]: amount }));

  const finishTyping = (key: string, cap: number | null) => {
    if (!typing) return;
    const centavos = parsePesoInput(typing.text);
    if (centavos != null) set(key, fitAssign(centavos, cap));
    setTyping(null);
  };

  const save = () => {
    setError(undefined);
    const allocations = destinations
      .filter((d) => amountOf(d.key) > 0)
      .map((d) => ({ kind: d.kind, id: d.id, amount: amountOf(d.key) }));
    startTransition(async () => {
      const result = await assignLeftover({ periodStart, allocations });
      if (!result.ok || !result.ids) return setError(result.formError ?? "Couldn't assign it.");
      const ids = result.ids;
      router.push(backHref);
      router.refresh();
      showToast({
        id: Date.now(),
        text: `${formatPeso(result.total ?? 0)} assigned`,
        action: {
          label: "Undo",
          onClick: async () => {
            showToast(null);
            const undone = await undoAssign(ids);
            router.refresh();
            showToast({ id: Date.now(), text: undone.ok ? "Assigning undone" : (undone.formError ?? "Couldn't undo.") });
          },
        },
      });
    });
  };

  const rows: { key: string; cap: number | null; name: string; detail: string; group: string; effect: string; Icon: typeof Wallet }[] = [
    ...destinations.map((d) => ({
      key: d.key,
      cap: d.cap,
      name: d.name,
      detail:
        d.kind === "pot"
          ? d.target != null
            ? `${formatPeso(d.balance)} of ${formatPeso(d.target)}`
            : `${formatPeso(d.balance)} saved`
          : `${formatPeso(d.left)} owed`,
      group: "Savings & debt payoff",
      effect:
        d.kind === "pot"
          ? assignEffect({ kind: "pot", name: d.name, balance: d.balance, target: d.target }, amountOf(d.key))
          : assignEffect({ kind: "debt", name: d.name, left: d.left }, amountOf(d.key)),
      Icon: d.kind === "pot" ? PiggyBank : CreditCard,
    })),
    {
      key: BUFFER,
      cap: null,
      name: "Keep as buffer",
      detail: `Carries over to ${next}`,
      group: "Stays unassigned",
      effect: assignEffect({ kind: "buffer", next }, buffer),
      Icon: Wallet,
    },
  ];

  const card = {
    some: { box: "bg-warn-bg text-warn-fg", label: "Left to assign", hint: "Tap + to give the rest a job, or keep it as a buffer." },
    all: { box: "bg-green-700 text-white", label: "All assigned", hint: "Every peso has a job." },
    too_much: { box: "bg-bad-bg text-bad-fg", label: "Too much assigned", hint: "Lower one of the amounts below." },
  }[state.state];

  return (
    <div className="flex flex-col gap-5 lg:grid lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)] lg:items-start">
      <div className="flex flex-col gap-5 lg:sticky lg:top-6">
        {/* The Remaining card (plan.md §7): the area's one sticker. */}
        <section
          aria-live="polite"
          aria-label="Left to assign"
          className={cn("flex flex-col gap-2 rounded-[22px] border-2 border-sticker p-5 shadow-sticker", card.box)}
        >
          <p className="text-xs font-extrabold tracking-wide uppercase">{card.label}</p>
          <p className="font-display text-[34px] leading-none font-semibold">{formatPeso(state.remaining)}</p>
          <p className="text-sm font-bold">{card.hint}</p>
          {/* Each destination's share; the rows below say the same in words. */}
          <span aria-hidden className="mt-1 flex h-3 overflow-hidden rounded-full bg-white/60">
            {rows.map((r, i) =>
              amountOf(r.key) > 0 ? (
                <span
                  key={r.key}
                  className={cn("h-full", r.key === BUFFER ? "bg-line-dash" : SEGMENTS[i % SEGMENTS.length])}
                  style={{ width: `${Math.min(100, (amountOf(r.key) / Math.max(total, toDestinations + buffer)) * 100)}%` }}
                />
              ) : null,
            )}
          </span>
        </section>

        <div className="flex flex-wrap gap-2" role="group" aria-label="Presets">
          {PRESETS.map((p) => (
            <button
              key={p.value}
              type="button"
              onClick={() => setAmounts(assignPreset(p.value, total, destinations, potKey, debtKey))}
              className={cn(
                "flex min-h-11 items-center rounded-full px-4 text-sm font-extrabold outline-link focus-visible:outline-2 focus-visible:outline-offset-2",
                p.value === "start_over"
                  ? "border-[1.5px] border-dashed border-line-dash bg-surface text-text-2"
                  : "bg-mint text-green-800",
              )}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* The totals box. */}
        <div className="hidden flex-col gap-1 rounded-[14px] bg-surface px-4 py-3 text-sm lg:flex">
          <Totals toDestinations={toDestinations} keep={state.keep} next={next} />
        </div>
        <div className="hidden flex-col gap-2 lg:flex">
          <SaveButton label={state.label} disabled={state.disabled || pending} pending={pending} onClick={save} />
          <FormError message={error} />
          <p className="text-center text-[13px] text-text-3">
            Assigned amounts become plan items you can tick off, just like your bills and savings.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-5">
        <ul className="flex flex-col gap-2">
          {rows.map(({ key, cap, name, detail, group, effect, Icon }) => {
            const amount = amountOf(key);
            const atCap = cap != null && amount >= cap;
            return (
              <li
                key={key}
                className={cn(
                  "flex flex-col gap-2 rounded-2xl bg-surface p-4",
                  amount > 0 ? "border-2 border-green-600" : "border-[1.5px] border-line",
                )}
              >
                <div className="flex items-center gap-3">
                  <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-mint text-green-800">
                    <Icon size={22} />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate font-extrabold text-ink">{name}</span>
                    <span className="truncate text-[13px] text-text-3">{detail}</span>
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    aria-label={`₱500 less for ${name}`}
                    disabled={amount <= 0}
                    onClick={() => set(key, stepAssign(amount, -1, cap))}
                    className="flex size-11 items-center justify-center rounded-full border-[1.5px] border-line text-ink outline-link focus-visible:outline-2 disabled:opacity-40"
                  >
                    <Minus aria-hidden size={20} />
                  </button>
                  {typing?.key === key ? (
                    <input
                      // The user just tapped the amount to type it.
                      autoFocus
                      inputMode="decimal"
                      aria-label={`Amount for ${name}`}
                      value={typing.text}
                      onChange={(e) => setTyping({ key, text: e.target.value })}
                      onBlur={() => finishTyping(key, cap)}
                      onKeyDown={(e) => e.key === "Enter" && finishTyping(key, cap)}
                      className="h-11 w-36 rounded-md border-[1.5px] border-green-600 bg-surface text-center font-display text-2xl font-semibold text-ink outline-none"
                    />
                  ) : (
                    <button
                      type="button"
                      aria-label={`${name}: ${formatPeso(amount)}. Type an amount`}
                      onClick={() => setTyping({ key, text: amount > 0 ? formatPesoInput(amount) : "" })}
                      className="h-11 min-w-36 rounded-md px-2 font-display text-2xl font-semibold text-ink outline-link focus-visible:outline-2"
                    >
                      {formatPeso(amount)}
                    </button>
                  )}
                  <button
                    type="button"
                    aria-label={`₱500 more for ${name}`}
                    disabled={atCap}
                    onClick={() => set(key, stepAssign(amount, 1, cap))}
                    className="flex size-11 items-center justify-center rounded-full border-[1.5px] border-line text-ink outline-link focus-visible:outline-2 disabled:opacity-40"
                  >
                    <Plus aria-hidden size={20} />
                  </button>
                </div>
                <p aria-live="polite" className="flex justify-between gap-3 text-[13px]">
                  <span className="font-bold text-link-hover">{effect}</span>
                  <span className="shrink-0 text-text-3">{atCap && cap != null ? `${formatPeso(cap)} max` : group}</span>
                </p>
              </li>
            );
          })}
        </ul>

        {/* Phones: the totals and the button after the rows. */}
        <div className="flex flex-col gap-3 lg:hidden">
          <div className="flex flex-col gap-1 rounded-[14px] bg-surface px-4 py-3 text-sm">
            <Totals toDestinations={toDestinations} keep={state.keep} next={next} />
          </div>
          <SaveButton label={state.label} disabled={state.disabled || pending} pending={pending} onClick={save} />
          <FormError message={error} />
        </div>
      </div>
    </div>
  );
}

function Totals({ toDestinations, keep, next }: { toDestinations: number; keep: number; next: string }) {
  return (
    <>
      <p>
        <span className="font-bold">Savings &amp; debt payoff this period:</span> {formatPeso(toDestinations)}
      </p>
      <p>
        <span className="font-bold">Carries over to {next}:</span> {formatPeso(keep)}
      </p>
    </>
  );
}

// The hero button: "Assign ₱8,800", "Assign ₱7,000, keep ₱1,800", or, too
// much assigned, a disabled "Remove ₱500 to continue".
function SaveButton({ label, disabled, pending, onClick }: { label: string; disabled: boolean; pending: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-busy={pending || undefined}
      className="flex h-14 items-center justify-center rounded-md border-2 border-sticker bg-green-500 px-5 text-base font-extrabold text-white shadow-sticker-sm outline-link focus-visible:outline-2 focus-visible:outline-offset-2 disabled:border-transparent disabled:bg-track disabled:text-text-3 disabled:shadow-none"
    >
      {pending ? "Assigning…" : label}
    </button>
  );
}
