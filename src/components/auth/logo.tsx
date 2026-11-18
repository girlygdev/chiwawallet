import { cn } from "@/lib/utils";

// The Chiwawallet mascot. In dark mode it sits on a light mint circle so its
// black outlines stay visible (style guide §2 "Dark mode").
// `decorative` = the screen already names the brand in text, so screen readers skip it.
export function Logo({
  size,
  decorative = false,
  className,
}: {
  size: number;
  decorative?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full dark:bg-logo-backdrop",
        className,
      )}
      style={{ width: size, height: size }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- static SVG, no optimisation needed */}
      <img
        src="/logo-mark.svg"
        alt={decorative ? "" : "Chiwawallet"}
        width={size}
        height={size}
        className="dark:size-[85%]"
      />
    </span>
  );
}

// "Chiwa" in ink + "wallet" in link green, Fredoka 600.
export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("font-display font-semibold text-ink", className)}>
      Chiwa<span className="text-link">wallet</span>
    </span>
  );
}
