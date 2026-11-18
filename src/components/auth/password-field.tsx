"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { FieldShell, inputClassName } from "./text-field";

type PasswordFieldProps = Omit<React.ComponentProps<"input">, "id" | "type"> & {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  labelAside?: React.ReactNode;
};

// Password input with a show/hide eye button inside the right edge.
// pr-[52px] keeps typed text from running under the 44px button.
export function PasswordField({
  id,
  label,
  hint,
  error,
  labelAside,
  className,
  ...inputProps
}: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);

  return (
    <FieldShell id={id} label={label} hint={hint} error={error} labelAside={labelAside}>
      {(describedBy) => (
        <div className="relative">
          <input
            id={id}
            type={visible ? "text" : "password"}
            aria-describedby={describedBy}
            aria-invalid={error ? true : undefined}
            className={cn(inputClassName, "pr-[52px]", className)}
            {...inputProps}
          />
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            aria-label={visible ? "Hide password" : "Show password"}
            aria-pressed={visible}
            className="absolute top-1/2 right-1 flex size-11 -translate-y-1/2 items-center justify-center rounded-sm text-text-3 outline-link hover:text-ink focus-visible:outline-2"
          >
            {visible ? (
              <EyeOff aria-hidden="true" className="size-[22px]" />
            ) : (
              <Eye aria-hidden="true" className="size-[22px]" />
            )}
          </button>
        </div>
      )}
    </FieldShell>
  );
}
