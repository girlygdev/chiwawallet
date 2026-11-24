import { CircleAlert } from "lucide-react";
import { cn } from "@/lib/utils";

// Shared input styling for auth fields (auth-screens.md §3 "Fields").
// 16px text stops iPhones zooming in. Focus and error show a 2px border:
// the 1.5px border plus a 0.5px inset shadow, so the text doesn't shift.
export const inputClassName =
  "h-[52px] w-full rounded-md border-[1.5px] border-line bg-surface px-4 text-base font-semibold text-ink outline-none placeholder:font-medium placeholder:text-placeholder focus:border-link focus:shadow-[inset_0_0_0_0.5px_var(--color-link)] aria-invalid:border-bad-fg aria-invalid:shadow-[inset_0_0_0_0.5px_var(--color-bad-fg)]";

type FieldShellProps = {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  // Extra content on the label row, e.g. the "Forgot password?" link.
  labelAside?: React.ReactNode;
  children: (describedBy: string | undefined) => React.ReactNode;
};

// Label above, input, then hint or error below. Hint and error are tied to the
// input with aria-describedby so screen readers read them with the field.
export function FieldShell({ id, label, hint, error, labelAside, children }: FieldShellProps) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [errorId, hintId].filter(Boolean).join(" ") || undefined;

  return (
    // min-w-0: inside a grid row, a field may shrink to its column instead of
    // growing to its input's own width (native date inputs on iPhones).
    <div className="flex min-w-0 flex-col gap-1.5">
      <div className="flex items-center justify-between gap-3">
        <label htmlFor={id} className="text-sm font-bold text-ink">
          {label}
        </label>
        {labelAside}
      </div>
      {children(describedBy)}
      {error && (
        <p id={errorId} className="flex items-center gap-1.5 text-[13px] font-bold text-bad-fg">
          <CircleAlert aria-hidden="true" className="size-4 shrink-0" />
          {error}
        </p>
      )}
      {hint && (
        <p id={hintId} className="text-[13px] text-text-3">
          {hint}
        </p>
      )}
    </div>
  );
}

type TextFieldProps = Omit<React.ComponentProps<"input">, "id"> & {
  id: string;
  label: string;
  hint?: string;
  error?: string;
};

// iPhone Safari gives native date inputs their own minimum width and centres
// the value, so in a two-column row the date field came out wider than its
// neighbour. Drop the native look and the minimum width, and left-align the
// value like every other field.
const DATE_INPUT = "min-w-0 appearance-none text-left [&::-webkit-date-and-time-value]:text-left";

export function TextField({ id, label, hint, error, className, ...inputProps }: TextFieldProps) {
  return (
    <FieldShell id={id} label={label} hint={hint} error={error}>
      {(describedBy) => (
        <input
          id={id}
          aria-describedby={describedBy}
          aria-invalid={error ? true : undefined}
          className={cn(inputClassName, inputProps.type === "date" && DATE_INPUT, className)}
          {...inputProps}
        />
      )}
    </FieldShell>
  );
}
