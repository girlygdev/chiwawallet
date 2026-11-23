"use client";

import { Search, X } from "lucide-react";
import { createContext, useContext, useState } from "react";

type ActivitySearch = {
  /** Mobile only: whether the search field is showing (desktop always shows it). */
  open: boolean;
  setOpen: (open: boolean) => void;
  query: string;
  setQuery: (query: string) => void;
};

const ActivitySearchContext = createContext<ActivitySearch | null>(null);

export const SEARCH_INPUT_ID = "activity-search";

// The search button lives in the page header and the field in the list, so
// they share state here (activity.md §1 "Search"). Wraps the whole page.
export function ActivitySearchProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  return (
    <ActivitySearchContext.Provider value={{ open, setOpen, query, setQuery }}>{children}</ActivitySearchContext.Provider>
  );
}

export function useActivitySearch(): ActivitySearch {
  const context = useContext(ActivitySearchContext);
  if (!context) throw new Error("useActivitySearch must be used inside ActivitySearchProvider.");
  return context;
}

/** The mobile header's 44px search button; closing also clears the search. */
export function ActivitySearchButton() {
  const { open, setOpen, setQuery } = useActivitySearch();
  return (
    <button
      type="button"
      aria-label={open ? "Close search" : "Search this period"}
      aria-expanded={open}
      aria-controls={SEARCH_INPUT_ID}
      onClick={() => {
        if (open) setQuery("");
        setOpen(!open);
      }}
      className="flex size-11 items-center justify-center rounded-full text-ink outline-link hover:bg-surface focus-visible:outline-2"
    >
      {open ? <X aria-hidden size={22} /> : <Search aria-hidden size={22} />}
    </button>
  );
}
