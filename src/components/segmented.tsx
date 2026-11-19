import { cn } from "@/lib/utils";

type Option<T extends string> = { value: T; label: string };

type SegmentedProps<T extends string> = {
  name: string;
  legend: string;
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
  error?: string;
};

// A segmented control (style-guide.md "Choices": 2–4 options). Built from
// real radio buttons in a fieldset, so arrow keys, Tab and screen readers work
// without extra code. The `track` background, white selected option.
export function Segmented<T extends string>({ name, legend, options, value, onChange, error }: SegmentedProps<T>) {
  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="mb-1.5 text-sm font-bold text-ink">{legend}</legend>
      <div className="flex rounded-[14px] bg-track p-1">
        {options.map((option) => (
          <label
            key={option.value}
            className={cn(
              "flex h-10 min-w-0 flex-1 cursor-pointer items-center justify-center rounded-[10px] px-2 text-center text-[15px] font-bold text-text-2",
              "has-checked:bg-surface has-checked:font-extrabold has-checked:text-ink has-checked:shadow-sm",
              "has-focus-visible:outline-2 has-focus-visible:outline-link",
            )}
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
              className="sr-only"
            />
            {option.label}
          </label>
        ))}
      </div>
      {error && <p className="text-[13px] font-bold text-bad-fg">{error}</p>}
    </fieldset>
  );
}
