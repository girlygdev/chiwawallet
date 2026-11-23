"use client";

import { useRef } from "react";
import { cn } from "@/lib/utils";

export type SheetTab = "expense" | "income";

const TABS: { value: SheetTab; label: string }[] = [
  { value: "expense", label: "Expense" },
  { value: "income", label: "Income" },
];

export const TAB_PANEL_ID = "add-sheet-panel";
export const tabId = (tab: SheetTab) => `add-sheet-tab-${tab}`;

// The add sheet's type tabs (activity.md §3): a `track` segmented control with
// 40px options. Savings joins in Week 4. Follows the WAI-ARIA tabs pattern:
// only the selected tab is in the Tab order; Left and Right arrows move
// between tabs and switch at once.
export function TypeTabs({ value, onChange }: { value: SheetTab; onChange: (tab: SheetTab) => void }) {
  const refs = useRef<Partial<Record<SheetTab, HTMLButtonElement | null>>>({});

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const i = TABS.findIndex((t) => t.value === value);
    const next = TABS[(i + (event.key === "ArrowRight" ? 1 : TABS.length - 1)) % TABS.length].value;
    onChange(next);
    refs.current[next]?.focus();
  };

  return (
    <div role="tablist" aria-label="Type" className="grid grid-cols-2 gap-1 rounded-[14px] bg-track p-1">
      {TABS.map((tab) => {
        const selected = tab.value === value;
        return (
          <button
            key={tab.value}
            ref={(el) => {
              refs.current[tab.value] = el;
            }}
            type="button"
            role="tab"
            id={tabId(tab.value)}
            aria-selected={selected}
            aria-controls={TAB_PANEL_ID}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(tab.value)}
            onKeyDown={onKeyDown}
            className={cn(
              "h-10 rounded-[10px] text-sm font-extrabold outline-link focus-visible:outline-2",
              selected ? "bg-surface text-ink shadow-sm" : "text-text-2",
            )}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
