"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useRef, useState } from "react";
import {
  type AddSheetData,
  getAddSheetData,
  saveExpense,
  saveIncome,
  undoTransaction,
} from "@/app/(app)/activity/actions";
import { Sheet } from "@/components/sheet";
import { Toast, type ToastMessage } from "@/components/toast";
import { formatPeso } from "@/lib/money";
import { ONE_TIME } from "@/lib/validation/transaction";
import { ExpenseForm } from "./expense-form";
import { IncomeForm } from "./income-form";
import { type SheetTab, TAB_PANEL_ID, tabId, TypeTabs } from "./type-tabs";

/** Where the sheet opens. Default: Expense (owner, Nov 23). */
type OpenOptions = {
  tab?: SheetTab;
  /** The Income tab's starting choice: a source id or ONE_TIME. */
  incomeSource?: string;
};

type AddTransaction = { openAddSheet: (options?: OpenOptions) => void };

const AddTransactionContext = createContext<AddTransaction | null>(null);

const TITLES: Record<SheetTab, string> = { expense: "Add expense", income: "Add income" };

// Lets the + button (mobile) and "+ Add transaction" (desktop) open the add
// sheet over any app page (week-3-tasks.md 3c, 3d). It always opens on
// Expense, so logging spending stays fast after a payday (owner, Nov 23).
// Also owns the toast shown after saving, so it stays up after the sheet closes.
export function AddTransactionProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  // A new key per opening gives a fresh, empty form each time.
  const [openCount, setOpenCount] = useState(0);
  const [tab, setTab] = useState<SheetTab>("expense");
  const [incomeSource, setIncomeSource] = useState<string>("");
  const [data, setData] = useState<AddSheetData | null>(null);
  // True while the category picker shows in place of the expense form.
  const [picking, setPicking] = useState(false);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const amountRef = useRef<HTMLInputElement>(null);
  // The amount as typed, so switching tabs keeps it. A ref, not state: the
  // forms report every keystroke and nothing here needs to re-render for it.
  const amountText = useRef("");
  const onAmountChange = useCallback((text: string) => {
    amountText.current = text;
  }, []);
  // Read from the ref when the tab changes; the new tab's form starts with it.
  const [carriedAmount, setCarriedAmount] = useState("");
  const switchTab = (next: SheetTab) => {
    setCarriedAmount(amountText.current);
    setTab(next);
  };

  const openAddSheet = useCallback((options: OpenOptions = {}) => {
    setData(null);
    setTab(options.tab ?? "expense");
    setIncomeSource(options.incomeSource ?? "");
    setPicking(false);
    amountText.current = "";
    setCarriedAmount("");
    setOpenCount((n) => n + 1);
    setOpen(true);
    // Loads while the user types the amount; fresh each time, so totals,
    // "most used" and Received include what was just saved.
    getAddSheetData()
      .then(setData)
      .catch((error) => console.error("activity: couldn't load the add sheet", error));
  }, []);

  const dismissToast = useCallback(() => setToast(null), []);

  // "Expense saved · −₱180" or "Income saved · +₱25,000", with Undo.
  const savedToast = (kind: "Expense" | "Income", signed: number) => (saved: { id: string; amount: number }) => {
    setOpen(false);
    // Re-reads the page's server data so lists and totals update.
    router.refresh();
    setToast({
      id: Date.now(),
      text: `${kind} saved · ${formatPeso(signed * saved.amount, { signed: true })}`,
      action: {
        label: "Undo",
        onClick: async () => {
          setToast(null);
          const result = await undoTransaction(saved.id);
          router.refresh();
          setToast({ id: Date.now(), text: result.ok ? `${kind} removed` : (result.formError ?? "Couldn't undo.") });
        },
      },
    });
  };

  const formProps = { data, amountRef, defaultAmount: carriedAmount, onAmountChange };

  return (
    <AddTransactionContext.Provider value={{ openAddSheet }}>
      {children}
      <Sheet
        open={open}
        onOpenChange={(next, details) => {
          // Esc in the picker goes back to the form instead of closing everything.
          if (!next && picking && details.reason === "escape-key") {
            details.cancel();
            setPicking(false);
            return;
          }
          setOpen(next);
        }}
        title={picking ? "Choose a category" : TITLES[tab]}
        back={picking ? { label: "Back to Add expense", onClick: () => setPicking(false) } : undefined}
        initialFocus={amountRef}
      >
        <div className="flex flex-col gap-5">
          {!picking && <TypeTabs value={tab} onChange={switchTab} />}
          <div id={TAB_PANEL_ID} role="tabpanel" aria-labelledby={tabId(tab)}>
            {tab === "expense" ? (
              <ExpenseForm
                // A fresh form per opening and per tab switch.
                key={`${openCount}-expense`}
                {...formProps}
                onSave={saveExpense}
                onSaved={savedToast("Expense", -1)}
                picking={picking}
                onPickingChange={setPicking}
              />
            ) : (
              <IncomeForm
                key={`${openCount}-income`}
                {...formProps}
                defaultSource={incomeSource}
                onSave={saveIncome}
                onSaved={savedToast("Income", 1)}
              />
            )}
          </div>
        </div>
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
  const { openAddSheet } = useAddTransaction();
  const openAddExpense = () => openAddSheet();

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

/**
 * The Income screen's **Log one-time income** (income.md §2, secondary): opens
 * the add sheet on Income with One-time income already chosen.
 */
export function LogOneTimeIncomeButton() {
  const { openAddSheet } = useAddTransaction();
  return (
    <button
      type="button"
      onClick={() => openAddSheet({ tab: "income", incomeSource: ONE_TIME })}
      className="flex h-12 w-full items-center justify-center rounded-md border-[1.5px] border-line bg-surface px-6 text-[15px] font-extrabold text-ink outline-link hover:border-line-dash focus-visible:outline-2 focus-visible:outline-offset-2 md:w-auto md:self-start"
    >
      Log one-time income
    </button>
  );
}
