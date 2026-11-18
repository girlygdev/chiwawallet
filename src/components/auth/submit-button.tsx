import { LoaderCircle } from "lucide-react";

// Flat primary button for auth forms (not the sticker hero button).
// While `pending`, the width stays the same, a spinner shows, the label changes
// (e.g. "Logging in…") and the button is disabled to block double taps.
export function SubmitButton({
  children,
  pending = false,
  pendingLabel,
  disabled = false,
}: {
  children: React.ReactNode;
  pending?: boolean;
  pendingLabel: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="submit"
      disabled={pending || disabled}
      aria-busy={pending || undefined}
      className="flex h-[54px] w-full items-center justify-center gap-2 rounded-md bg-primary text-[17px] font-extrabold text-primary-foreground outline-link hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 disabled:bg-track disabled:text-text-3 aria-busy:bg-primary aria-busy:text-primary-foreground"
    >
      {pending && <LoaderCircle aria-hidden="true" className="size-5 animate-spin" />}
      {pending ? pendingLabel : children}
    </button>
  );
}
