// Two thin rules with "or" (Log in) or "or use email" (Sign up) between them.
export function OrDivider({ label = "or" }: { label?: "or" | "or use email" }) {
  return (
    <div className="flex items-center gap-3 text-[13px] font-semibold text-text-3">
      <span aria-hidden="true" className="h-px flex-1 bg-line" />
      {label}
      <span aria-hidden="true" className="h-px flex-1 bg-line" />
    </div>
  );
}
