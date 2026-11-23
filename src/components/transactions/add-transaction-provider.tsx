"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useRef, useState } from "react";
import {
  type AddExpenseData,
  getAddExpenseData,
  saveExpense,
  undoTransaction,
} from "@/app/(app)/activity/actions";
import { Sheet } from "@/components/sheet";
import { Toast, type ToastMessage } from "@/components/toast";
import { formatPeso } from "@/lib/money";
import { ExpenseForm } from "./expense-form";

type AddTransaction = { openAddExpense: () => void };

const AddTransactionContext = createContext<AddTransaction | null>(null);

// Lets the + button (mobile) and "+ Add transaction" (desktop) open the Add
// expense sheet over any app page (week-3-tasks.md 3c). Also owns the toast
// shown after saving, so it stays up after the sheet closes.
export function AddTransactionProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  // A new key per opening gives a fresh, empty form each time.
  const [openCount, setOpenCount] = useState(0);
  const [data, setData] = useState<AddExpenseData | null>(null);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const amountRef = useRef<HTMLInputElement>(null);

  const openAddExpense = useCallback(() => {
    setData(null);
    setOpenCount((n) => n + 1);
    setOpen(true);
    // Loads while the user types the amount; fresh each time, so totals and
    // "most used" include what was just saved.
    getAddExpenseData()
      .then(setData)
      .catch((error) => console.error("activity: couldn't load the add sheet", error));
  }, []);

  const dismissToast = useCallback(() => setToast(null), []);

  const onSaved = (saved: { id: string; amount: number }) => {
    setOpen(false);
    // Re-reads the page's server data so lists and totals update.
    router.refresh();
    setToast({
      id: Date.now(),
      text: `Expense saved · ${formatPeso(-saved.amount)}`,
      action: {
        label: "Undo",
        onClick: async () => {
          setToast(null);
          const result = await undoTransaction(saved.id);
          router.refresh();
          setToast({ id: Date.now(), text: result.ok ? "Expense removed" : (result.formError ?? "Couldn't undo.") });
        },
      },
    });
  };

  return (
    <AddTransactionContext.Provider value={{ openAddExpense }}>
      {children}
      <Sheet open={open} onOpenChange={setOpen} title="Add expense" initialFocus={amountRef}>
        <ExpenseForm key={openCount} data={data} amountRef={amountRef} onSave={saveExpense} onSaved={onSaved} />
      </Sheet>
      <Toast toast={toast} onDismiss={dismissToast} />
    </AddTransactionContext.Provider>
  );
}

function useAddTransaction() {
  const context = useContext(AddTransactionContext);
  if (!context) throw new Error("useAddTransaction must be used inside AddTransactionProvider.");
  return context;
}

/**
 * The buttons that open the sheet:
 * - "fab": the mobile bar's raised + (its one sticker element)
 * - "header": the desktop header's "+ Add transaction" sticker button
 */
export function AddTransactionButton({ variant }: { variant: "fab" | "header" }) {
  const { openAddExpense } = useAddTransaction();

  if (variant === "fab") {
    return (
      <button
        type="button"
        onClick={openAddExpense}
        aria-label="Add transaction"
        className="-mt-[31px] flex size-[62px] items-center justify-center rounded-full border-[3px] border-sticker bg-green-500 text-white shadow-sticker-sm outline-link focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        <Plus aria-hidden size={26} strokeWidth={2.5} />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={openAddExpense}
      className="flex h-[50px] items-center gap-2 rounded-[14px] border-2 border-sticker bg-green-500 px-5 text-[15px] font-extrabold text-white shadow-sticker-sm outline-link focus-visible:outline-2 focus-visible:outline-offset-2"
    >
      <Plus aria-hidden size={20} strokeWidth={2.5} />
      Add transaction
    </button>
  );
}
