"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Sheet } from "@/components/sheet";
import { type EditablePot, PotForm } from "@/components/savings/pot-form";
import type { PaySchedule } from "@/lib/periods";
import { addPot, updatePot } from "./actions";

// New / Edit pot, following the page address like Bills and Income, so the
// + button can be a plain link:
//   /savings?add=1        New savings pot
//   /savings?edit=<id>    Edit pot (the details page links here, 4d-3)
// Closing clears the address. Delete pot comes in 4d-3.
export function PotSheet({ pots, schedule, today }: { pots: EditablePot[]; schedule: PaySchedule; today: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const editing = pots.find((p) => p.id === params.get("edit"));
  const sheetOpen = params.get("add") != null || editing != null;
  const close = () => router.replace(pathname, { scroll: false });

  return (
    <Sheet
      open={sheetOpen}
      onOpenChange={(next) => !next && close()}
      title={editing ? "Edit pot" : "New savings pot"}
      description="A goal you put money toward each payday."
    >
      {sheetOpen && (
        <PotForm
          // A fresh form per pot, so its fields start from that pot.
          key={editing?.id ?? "add"}
          schedule={schedule}
          today={today}
          pot={editing}
          onSave={(input) => (editing ? updatePot(editing.id, input) : addPot(input))}
          onDone={close}
        />
      )}
    </Sheet>
  );
}
