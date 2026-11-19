import { getCurrentProfile } from "@/lib/current-profile";

// Bottom of the desktop sidebar (app-shell.md §2): an initial circle and the
// display name. The budget name joins it in Week 2, when budgets exist.
export async function ProfileChip() {
  const profile = await getCurrentProfile();
  const name = profile?.display_name ?? "You";
  // First character as the initial; Array.from keeps emoji and accents whole.
  const initial = Array.from(name)[0]?.toUpperCase() ?? "?";

  return (
    <div className="flex items-center gap-2.5 rounded-[12px] bg-bg px-3 py-2.5">
      <span
        aria-hidden
        className="flex size-8 shrink-0 items-center justify-center rounded-full bg-green-700 font-display text-base font-semibold text-white"
      >
        {initial}
      </span>
      <span className="min-w-0 truncate text-sm font-extrabold text-ink">{name}</span>
    </div>
  );
}

// Same size as the chip while the profile loads, so nothing jumps.
export function ProfileChipSkeleton() {
  return <div aria-hidden className="h-[52px] rounded-[12px] bg-track" />;
}
