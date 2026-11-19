"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { IncomeForm, type IncomeSource } from "@/components/income/income-form";
import { Sheet } from "@/components/sheet";
import type { PaySchedule } from "@/lib/periods";
import { addIncomeSource, updateIncomeSource } from "./actions";

// The New / Edit income source sheet. It follows the page address, so the
// header's + button and each source card can be plain links:
// /income?add=1 opens New, /income?edit=<id> opens Edit. Closing clears it.
export function IncomeSheet({
  sources,
  activeIds,
  schedule,
  defaultStart,
}: {
  sources: IncomeSource[];
  /** Sources paying today: the impact box compares against these only. */
  activeIds: string[];
  schedule: PaySchedule;
  /** "Starts" for a new source: the current period's first day (plan review 3.3). */
  defaultStart: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const editing = sources.find((s) => s.id === params.get("edit"));
  const adding = params.get("add") != null;
  const open = adding || editing != null;
  const close = () => router.replace(pathname, { scroll: false });

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => !next && close()}
      title={editing ? "Edit income source" : "New income source"}
      description="Money you expect regularly, like a job, side gig or allowance."
    >
      {open && (
        <IncomeForm
          // A fresh form per source, so its fields start from that source.
          key={editing?.id ?? "add"}
          layout="sheet"
          schedule={schedule}
          source={editing}
          otherSources={sources.filter((s) => s.id !== editing?.id && activeIds.includes(s.id))}
          withDates={{ defaultStart }}
          onSave={(input) => (editing ? updateIncomeSource(editing.id, input) : addIncomeSource(input))}
          onDone={close}
        />
      )}
    </Sheet>
  );
}
