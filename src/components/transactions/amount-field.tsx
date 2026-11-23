"use client";

import type { UseFormRegisterReturn } from "react-hook-form";

// The add sheet's big amount (activity.md §3): label "Amount", ₱ in Fredoka
// 36px, the number in Fredoka 56px, a decimal keypad on phones. Shared by the
// Expense and Income tabs; `amountRef` lets the sheet focus it on open.
export function AmountField({
  id,
  field,
  amountRef,
  error,
}: {
  id: string;
  field: UseFormRegisterReturn<"amount">;
  amountRef: React.RefObject<HTMLInputElement | null>;
  error?: string;
}) {
  const errorId = `${id}-error`;
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-bold text-ink">
        Amount
      </label>
      <div className="flex items-baseline gap-1.5">
        <span aria-hidden className="font-display text-4xl font-semibold text-text-3">
          ₱
        </span>
        <input
          {...field}
          ref={(el) => {
            field.ref(el);
            amountRef.current = el;
          }}
          id={id}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          placeholder="0"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className="w-full min-w-0 bg-transparent font-display text-[56px] leading-[1.1] font-semibold text-ink outline-none placeholder:text-placeholder"
        />
      </div>
      {error && (
        <p id={errorId} className="text-[13px] font-bold text-bad-fg">
          {error}
        </p>
      )}
    </div>
  );
}
