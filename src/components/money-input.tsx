import { FieldShell, inputClassName } from "@/components/auth/text-field";
import { cn } from "@/lib/utils";

type MoneyInputProps = Omit<React.ComponentProps<"input">, "id" | "type" | "inputMode"> & {
  id: string;
  label: string;
  hint?: string;
  error?: string;
};

// A peso amount field (style-guide.md "Money inputs"): ₱ inside the field and
// the number keyboard on phones. The value stays as typed text; the form's
// schema turns it into centavos with parsePesoInput(), and the form shows the
// result in pesos (impact box) before saving.
export function MoneyInput({ id, label, hint, error, className, ...inputProps }: MoneyInputProps) {
  return (
    <FieldShell id={id} label={label} hint={hint} error={error}>
      {(describedBy) => (
        <div className="relative">
          <span
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-base font-bold text-text-3"
          >
            ₱
          </span>
          <input
            id={id}
            type="text"
            inputMode="decimal"
            autoComplete="off"
            aria-describedby={describedBy}
            aria-invalid={error ? true : undefined}
            className={cn(inputClassName, "h-12 pl-9", className)}
            {...inputProps}
          />
        </div>
      )}
    </FieldShell>
  );
}
