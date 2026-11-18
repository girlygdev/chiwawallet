import Link from "next/link";

// The DPA consent checkbox: unticked by default, shared by Sign up and the
// one-time consent step for Google sign-ups.
export function ConsentCheckbox({
  error,
  ...inputProps
}: React.ComponentProps<"input"> & { error?: string }) {
  const linkClass = "font-bold text-link outline-link hover:text-link-hover focus-visible:outline-2";
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-start gap-2.5">
        <input
          id="consent"
          type="checkbox"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "consent-error" : undefined}
          className="mt-px size-[22px] shrink-0 accent-green-600 outline-link focus-visible:outline-2 focus-visible:outline-offset-2"
          {...inputProps}
        />
        <label htmlFor="consent" className="text-sm leading-[1.45] text-text-2">
          I agree to the{" "}
          {/* New tab, so following the link doesn't throw away what was typed */}
          <Link href="/privacy" target="_blank" className={linkClass}>
            Privacy Notice
          </Link>{" "}
          and{" "}
          <Link href="/terms" target="_blank" className={linkClass}>
            Terms
          </Link>
          . My budget data is used only to run Chiwawallet and is never sold.
        </label>
      </div>
      {error && (
        <p id="consent-error" className="text-[13px] font-bold text-bad-fg">
          {error}
        </p>
      )}
    </div>
  );
}
