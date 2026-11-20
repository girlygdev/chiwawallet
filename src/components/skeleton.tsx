import { cn } from "@/lib/utils";

// Loading placeholders (app-shell.md §5 "Loading"): grey `track` blocks the
// size of the real content, never a full-page spinner.

/** One grey block. Size and shape come from `className` (e.g. "h-7 w-40"). */
export function Skeleton({ className }: { className?: string }) {
  return <span className={cn("block rounded bg-track", className)} />;
}

/**
 * Wraps a whole skeleton. Screen readers hear "Loading…" once instead of a
 * pile of empty blocks. The blocks pulse gently, except when the device asks
 * for reduced motion (`motion-safe:`).
 */
export function SkeletonRegion({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div role="status" className={cn("motion-safe:animate-pulse", className)}>
      <span className="sr-only">Loading…</span>
      <div aria-hidden className="contents">
        {children}
      </div>
    </div>
  );
}
