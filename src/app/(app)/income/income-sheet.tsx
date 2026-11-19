"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { ConfirmDelete } from "@/components/confirm-delete";
import { IncomeForm, type IncomeSource } from "@/components/income/income-form";
import { Sheet } from "@/components/sheet";
import { removalImpact, sourceScheduleLine } from "@/lib/income";
import { formatPeso } from "@/lib/money";
import type { PaySchedule } from "@/lib/periods";
import { addIncomeSource, deleteIncomeSource, updateIncomeSource } from "./actions";

// The New / Edit sheet and the Delete dialog. They follow the page address, so
// the header's + button and each source card can be plain links:
//   /income?add=1                  New income source
//   /income?edit=<id>              Edit (…&focus=end lands on "Ends")
//   /income?delete=<id>            Delete income source?
// Closing clears the address.
export function IncomeSheet({
  sources,
  activeIds,
  schedule,
  defaultStart,
}: {
  sources: IncomeSource[];
  /** Sources paying today: impact lines compare against these only. */
  activeIds: string[];
  schedule: PaySchedule;
  /** "Starts" for a new source: the current period's first day (plan review 3.3). */
  defaultStart: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const find = (key: string) => sources.find((s) => s.id === params.get(key));
  const editing = find("edit");
  const deleting = find("delete");
  const adding = params.get("add") != null;
  const sheetOpen = adding || editing != null;
  const close = () => router.replace(pathname, { scroll: false });
  const activeOthers = (except?: IncomeSource) =>
    sources.filter((s) => s.id !== except?.id && activeIds.includes(s.id));

  return (
    <>
      <Sheet
        open={sheetOpen}
        onOpenChange={(next) => !next && close()}
        title={editing ? "Edit income source" : "New income source"}
        description="Money you expect regularly, like a job, side gig or allowance."
      >
        {sheetOpen && (
          <IncomeForm
            // A fresh form per source, so its fields start from that source.
            key={editing?.id ?? "add"}
            layout="sheet"
            schedule={schedule}
            source={editing}
            otherSources={activeOthers(editing)}
            withDates={{ defaultStart, focusEnd: params.get("focus") === "end" }}
            onSave={(input) => (editing ? updateIncomeSource(editing.id, input) : addIncomeSource(input))}
            onDeleteRequest={
              editing ? () => router.replace(`${pathname}?delete=${editing.id}`, { scroll: false }) : undefined
            }
            onDone={close}
          />
        )}
      </Sheet>

      {deleting && (
        <DeleteIncomeDialog
          key={deleting.id}
          source={deleting}
          isActive={activeIds.includes(deleting.id)}
          others={activeOthers(deleting)}
          schedule={schedule}
          onClose={close}
        />
      )}
    </>
  );
}

// "Delete Main job?" (delete-pattern.md §2): the item, its effect in pesos,
// Keep it focused first. No history to keep yet (Week 3), so the only
// alternative offered is ending the source, which keeps it on the list.
function DeleteIncomeDialog({
  source,
  isActive,
  others,
  schedule,
  onClose,
}: {
  source: IncomeSource;
  isActive: boolean;
  others: IncomeSource[];
  schedule: PaySchedule;
  onClose: () => void;
}) {
  const router = useRouter();
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const effects = isActive ? removalImpact(others, source, schedule) : [];

  const confirm = () => {
    setError(undefined);
    startTransition(async () => {
      const result = await deleteIncomeSource(source.id);
      if (result.formError) return setError(result.formError);
      router.refresh();
      onClose();
    });
  };

  return (
    <ConfirmDelete
      open
      onOpenChange={(next) => !next && !pending && onClose()}
      title={`Delete ${source.name}?`}
      description="It disappears from your income list and from every period's expected income."
      confirmLabel="Delete income source"
      onConfirm={confirm}
      pending={pending}
      error={error}
    >
      {/* The item itself (delete-pattern.md §2.2). */}
      <div className="flex items-center justify-between gap-3 rounded-[14px] bg-bg px-4 py-3">
        <div className="min-w-0">
          <p className="font-extrabold">{source.name}</p>
          <p className="text-[13px] text-text-3">{sourceScheduleLine(source, schedule)}</p>
        </div>
        <p className="shrink-0 font-display text-lg font-semibold">{formatPeso(source.amount)}</p>
      </div>

      {/* The effect in pesos (§2.3). */}
      {effects.length > 0 ? (
        <ul className="flex flex-col gap-1 text-sm">
          {effects.map((line) => (
            <li key={line.label}>
              <span className="font-bold">{line.label}:</span> {formatPeso(line.before)} →{" "}
              <span className="font-extrabold">{formatPeso(line.after)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-text-2">It isn&apos;t paying right now, so expected income doesn&apos;t change.</p>
      )}

      <p className="text-sm text-text-2">
        Stopped getting this?{" "}
        <Link
          href={`/income?edit=${source.id}&focus=end`}
          scroll={false}
          replace
          className="font-extrabold text-link outline-link hover:text-link-hover focus-visible:outline-2"
        >
          End it instead
        </Link>{" "}
        to keep it on your list.
      </p>
    </ConfirmDelete>
  );
}
