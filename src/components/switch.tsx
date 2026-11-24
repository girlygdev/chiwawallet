import { cn } from "@/lib/utils";

// An on/off switch (style-guide.md "Choices"): a real <button> with
// role="switch" and aria-checked, so screen readers say "on" or "off". The
// visible label names it; the hint is tied to it with aria-describedby
// (bills.md §6, savings.md §6). The whole row is the 44px+ tap target.
export function Switch({
  id,
  label,
  hint,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  const labelId = `${id}-label`;
  const hintId = hint ? `${id}-hint` : undefined;
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex min-w-0 flex-col gap-0.5">
        <span id={labelId} className="text-sm font-bold text-ink">
          {label}
        </span>
        {hint && (
          <span id={hintId} className="text-[13px] text-text-3">
            {hint}
          </span>
        )}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={labelId}
        aria-describedby={hintId}
        onClick={() => onChange(!checked)}
        // 52 × 32 track inside a 44px-tall button.
        className="flex h-11 shrink-0 items-center rounded-full outline-link focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        <span
          aria-hidden
          className={cn(
            "flex h-8 w-[52px] items-center rounded-full p-1 transition-colors",
            checked ? "bg-green-600" : "bg-track",
          )}
        >
          <span
            className={cn(
              "size-6 rounded-full bg-white shadow-sm transition-transform motion-reduce:transition-none",
              checked && "translate-x-5",
            )}
          />
        </span>
      </button>
    </div>
  );
}
