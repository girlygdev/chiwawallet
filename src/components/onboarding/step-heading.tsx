"use client";

import { useEffect, useRef } from "react";

// The step's <h1>. It takes focus when the step opens, so screen reader and
// keyboard users start at the new step's title (onboarding.md §8).
// tabIndex={-1} lets a heading take focus without joining the Tab order.
export function StepHeading({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    ref.current?.focus();
  }, []);
  return (
    <h1
      ref={ref}
      tabIndex={-1}
      className="font-display text-[26px] leading-[1.1] font-semibold text-ink outline-none lg:text-4xl"
    >
      {children}
    </h1>
  );
}
