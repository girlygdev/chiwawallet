"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useRef, useState } from "react";
import {
  type AddSheetData,
  type EditingTransaction,
  getAddSheetData,
  getEditTransaction,
  restoreTransaction,
  type SaveSavingsResult,
  saveExpense,
  saveIncome,
  saveSavings,
  undoTransaction,
  undoTransfer,
  updateExpense,
  updateIncome,
  updateSavings,
} from "@/app/(app)/activity/actions";
import { Sheet } from "@/components/sheet";
import { Skeleton, SkeletonRegion } from "@/components/skeleton";
import { Toast, type ToastMessage } from "@/components/toast";
import { formatPeso, formatPesoInput } from "@/lib/money";
import { ONE_TIME } from "@/lib/validation/transaction";
import { type DeleteTarget, DeleteTransactionDialog } from "./delete-transaction-dialog";
import { ExpenseForm, type ExpenseView } from "./expense-form";
import { IncomeForm } from "./income-form";
import { SavingsForm } from "./savings-form";
import { type SheetTab, TAB_PANEL_ID, tabId, TypeTabs } from "./type-tabs";

/** Where the sheet opens. Default: Expense (owner, Nov 23). */
type OpenOptions = {
  tab?: SheetTab;
  /** The Income tab's starting choice: a source id or ONE_TIME. */
  incomeSource?: string;
  /** A starting amount in centavos, e.g. the source's expected pay ("I got paid"). */
  amount?: number;
  /** The Transfer tab's starting pot and direction, e.g. a pot's Add money or Withdraw (4e). */
  potId?: string;
  direction?: "add" | "withdraw" | "move" | "debt";
  /** To a debt's starting debt: Pay extra on Debts (6d-2). */
  debtId?: string;
};

type AddTransaction = {
  openAddSheet: (options?: OpenOptions) => void;
  /** Edit transaction for row `id`; `deleteTarget` is what its Delete link confirms. */
  openEditSheet: (id: string, deleteTarget: DeleteTarget) => void;
  /** Delete transaction's confirmation (delete-pattern.md §3). */
  openDelete: (target: DeleteTarget) => void;
  /** The app's one toast (6b-2): Plan, Bills and Debts use it too, so it shows in one place. */
  showToast: (toast: ToastMessage | null) => void;
};

const AddTransactionContext = createContext<AddTransaction | null>(null);

/**
 * A toast, optionally with one action. Outside the component: the time-based
 * id is read when the toast is made, never while rendering.
 */
function toastWithAction(text: string, label?: string, onClick?: () => void): ToastMessage {
  return { id: Date.now(), text, ...(label && onClick ? { action: { label, onClick } } : {}) };
}

const TITLES: Record<SheetTab, string> ={ expense: "Add expense", income: "Add income", savings: "Transfer" };

// Lets the + button (mobile) and "+ Add transaction" (desktop) open the add
// sheet over any app page (week-3-tasks.md 3c, 3d). It always opens on
// Expense, so logging spending stays fast after a payday (owner, Nov 23).
// Also owns the toast shown after saving, so it stays up after the sheet closes.
//
// The same sheet edits a row (Edit transaction, activity.md fix #6, task 3e)
// and the delete confirmation lives here too, so a row's Delete button and the
// Delete link inside Edit share one flow and one Undo toast.
export function AddTransactionProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  // A new key per opening gives a fresh, empty form each time.
  const [openCount, setOpenCount] = useState(0);
  const [tab, setTab] = useState<SheetTab>("expense");
  const [incomeSource, setIncomeSource] = useState<string>("");
  const [potId, setPotId] = useState<string>("");
  const [direction, setDirection] = useState<"add" | "withdraw" | "move" | "debt">("add");
  const [debtId, setDebtId] = useState<string>("");
  const [data, setData] = useState<AddSheetData | null>(null);
  // Edit mode: the row once it has loaded, and what its Delete link confirms.
  const [mode, setMode] = useState<"add" | "edit">("add");
  const [editing, setEditing] = useState<EditingTransaction | null>(null);
  const [editDelete, setEditDelete] = useState<DeleteTarget | null>(null);
  const [deleting, setDeleting] = useState<DeleteTarget | null>(null);
  // The expense form, or the category picker or New category in its place.
  const [view, setView] = useState<ExpenseView>("form");
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
    setMode("add");
    setEditing(null);
    setData(null);
    setTab(options.tab ?? "expense");
    setIncomeSource(options.incomeSource ?? "");
    setPotId(options.potId ?? "");
    setDirection(options.direction ?? "add");
    setDebtId(options.debtId ?? "");
    setView("form");
    const startAmount = options.amount != null ? formatPesoInput(options.amount) : "";
    amountText.current = startAmount;
    setCarriedAmount(startAmount);
    setOpenCount((n) => n + 1);
    setOpen(true);
    // Loads while the user types the amount; fresh each time, so totals,
    // "most used" and Received include what was just saved.
    getAddSheetData()
      .then(setData)
      .catch((error) => console.error("activity: couldn't load the add sheet", error));
  }, []);

  const openEditSheet = useCallback((id: string, deleteTarget: DeleteTarget) => {
    setMode("edit");
    setEditing(null);
    setEditDelete(deleteTarget);
    setData(null);
    setView("form");
    setOpenCount((n) => n + 1);
    setOpen(true);
    Promise.all([getAddSheetData(), getEditTransaction(id)])
      .then(([sheetData, row]) => {
        if (!row) {
          // Deleted in another tab, or a type this sheet can't edit yet.
          setOpen(false);
          setToast({ id: Date.now(), text: "This transaction can't be edited." });
          return;
        }
        setTab(row.type);
        setData(sheetData);
        setEditing(row);
      })
      .catch((error) => console.error("activity: couldn't load the transaction", error));
  }, []);

  const openDelete = useCallback((target: DeleteTarget) => setDeleting(target), []);

  // After New category saves (3h-3): fresh categories, so the grid has its tile.
  const reloadData = useCallback(async () => setData(await getAddSheetData()), []);

  // After Delete transaction: the list and totals update, then "Lunch deleted"
  // with Undo for 5 seconds, which clears deleted_at again.
  const onDeleted = (target: DeleteTarget) => {
    setDeleting(null);
    router.refresh();
    setToast({
      id: Date.now(),
      text: `${target.name} deleted`,
      action: {
        label: "Undo",
        onClick: async () => {
          setToast(null);
          const result = await restoreTransaction(target.id);
          router.refresh();
          setToast({ id: Date.now(), text: result.ok ? `${target.name} is back` : (result.formError ?? "Couldn't undo.") });
        },
      },
    });
  };

  // Edit's Delete link: the sheet closes and the confirmation opens, like
  // Delete income source. Keep it leaves the row as it was.
  const deleteFromEdit = () => {
    if (!editDelete) return;
    setOpen(false);
    setDeleting(editDelete);
  };

  const onEdited = () => {
    setOpen(false);
    router.refresh();
    setToast({ id: Date.now(), text: "Changes saved" });
  };

  const dismissToast = useCallback(() => setToast(null), []);

  // After saving: close, refresh, and a toast with Undo. `text` is the toast
  // ("Expense saved · −₱180"); `removed` is what Undo says ("Expense removed").
  // A pot-to-pot move (6d-1) has two rows (`ids`), and Undo removes both.
  const showSaved = (saved: { id: string; ids?: string[] }, text: string, removed: string) => {
    setOpen(false);
    // Re-reads the page's server data so lists and totals update.
    router.refresh();
    setToast(
      toastWithAction(text, "Undo", async () => {
        setToast(null);
        const result = saved.ids ? await undoTransfer(saved.ids) : await undoTransaction(saved.id);
        router.refresh();
        setToast(toastWithAction(result.ok ? removed : (result.formError ?? "Couldn't undo.")));
      }),
    );
  };
  // "Expense saved · −₱180" or "Income saved · +₱25,000".
  const savedToast = (kind: "Expense" | "Income", signed: number) => (saved: { id: string; amount: number }) =>
    showSaved(saved, `${kind} saved · ${formatPeso(signed * saved.amount, { signed: true })}`, `${kind} removed`);
  // "Added ₱2,000 to Travel" or "Withdrew ₱1,000 from Travel" (the amount is signed).
  // A move: "Moved ₱2,000 from Travel to Emergency" (6d-1); a debt payment:
  // "Paid ₱6,000 to SPayLater" (6d-2), whose Undo removes all its rows.
  const savingsToast = (saved: NonNullable<SaveSavingsResult["saved"]>, potName: string) =>
    showSaved(
      saved,
      saved.debtName
        ? `Paid ${formatPeso(saved.amount)} to ${saved.debtName}`
        : saved.toPotName
          ? `Moved ${formatPeso(saved.amount)} from ${potName} to ${saved.toPotName}`
          : saved.amount < 0
            ? `Withdrew ${formatPeso(-saved.amount)} from ${potName}`
            : `Added ${formatPeso(saved.amount)} to ${potName}`,
      saved.debtName ? "Payment removed" : saved.toPotName ? "Move removed" : "Savings entry removed",
    );

  // The Savings tab's "+ New pot": New pot lives on the Savings page.
  const goToNewPot = () => {
    setOpen(false);
    router.push("/savings?add=1");
  };

  const formProps = { data, amountRef, defaultAmount: carriedAmount, onAmountChange };
  const editMode = mode === "edit";
  // Edit mode waits for the row before showing a form, so it starts filled in.
  const loadingEdit = editMode && editing == null;
  const title =
    view === "picker"
      ? "Choose a category"
      : view === "new-category"
        ? "New category"
        : editMode
          ? "Edit transaction"
          : TITLES[tab];
  // The back arrow and Esc go one step back: New category → picker → form.
  const back =
    view === "new-category"
      ? { label: "Back to Choose a category", onClick: () => setView("picker") }
      : view === "picker"
        ? { label: editMode ? "Back to Edit transaction" : "Back to Add expense", onClick: () => setView("form") }
        : undefined;

  const forms =
    tab === "expense" ? (
      <ExpenseForm
        // A fresh form per opening and per tab switch.
        key={`${openCount}-expense`}
        {...formProps}
        onSave={editing ? (input) => updateExpense(editing.id, input) : saveExpense}
        onSaved={editing ? onEdited : savedToast("Expense", -1)}
        view={view}
        onViewChange={setView}
        onCategoriesChanged={reloadData}
        editing={editing}
        onDelete={deleteFromEdit}
      />
    ) : tab === "income" ? (
      <IncomeForm
        key={`${openCount}-income`}
        {...formProps}
        defaultSource={incomeSource}
        onSave={editing ? (input) => updateIncome(editing.id, input) : saveIncome}
        onSaved={editing ? onEdited : savedToast("Income", 1)}
        editing={editing}
        onDelete={deleteFromEdit}
      />
    ) : (
      <SavingsForm
        key={`${openCount}-savings`}
        {...formProps}
        defaultPotId={potId}
        defaultDirection={direction}
        defaultDebtId={debtId}
        onSave={editing ? (input) => updateSavings(editing.id, input) : saveSavings}
        onSaved={editing ? onEdited : savingsToast}
        onNewPot={goToNewPot}
        editing={editing}
        onDelete={deleteFromEdit}
      />
    );

  return (
    <AddTransactionContext.Provider value={{ openAddSheet, openEditSheet, openDelete, showToast: setToast }}>
      {children}
      <Sheet
        open={open}
        onOpenChange={(next, details) => {
          // Esc in the picker or New category goes back one step instead of
          // closing everything.
          if (!next && back && details.reason === "escape-key") {
            details.cancel();
            back.onClick();
            return;
          }
          setOpen(next);
        }}
        title={title}
        back={back}
        // Adding: straight to the amount. Editing: the sheet itself (Base UI's
        // default), so the phone keyboard doesn't cover the filled-in form.
        initialFocus={editMode ? undefined : amountRef}
      >
        {loadingEdit ? (
          <SkeletonRegion className="flex flex-col gap-5">
            <Skeleton className="h-16 w-48" />
            <Skeleton className="h-40 rounded-[14px]" />
            <Skeleton className="h-[46px] rounded-md" />
            <Skeleton className="h-14 rounded-md" />
          </SkeletonRegion>
        ) : editMode ? (
          // The type can't change while editing, so no tabs.
          forms
        ) : (
          <div className="flex flex-col gap-5">
            {view === "form" && <TypeTabs value={tab} onChange={switchTab} />}
            <div id={TAB_PANEL_ID} role="tabpanel" aria-labelledby={tabId(tab)}>
              {forms}
            </div>
          </div>
        )}
      </Sheet>
      {deleting && (
        <DeleteTransactionDialog
          key={deleting.id}
          target={deleting}
          onClose={() => setDeleting(null)}
          onDeleted={onDeleted}
        />
      )}
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

/**
 * A button that opens the add sheet a certain way, for pages that are server
 * components (e.g. Activity's empty state: "Log an expense", "I got paid").
 */
export function OpenAddSheetButton({
  options,
  className,
  children,
}: {
  options?: OpenOptions;
  className?: string;
  children: React.ReactNode;
}) {
  const { openAddSheet } = useAddTransaction();
  return (
    <button type="button" onClick={() => openAddSheet(options)} className={className}>
      {children}
    </button>
  );
}

/** The add sheet's controls, for components that open it (Activity rows). */
export function useTransactionSheet(): AddTransaction {
  return useAddTransaction();
}

/** Shows a toast in the app's one toast spot, above the bottom bar (6b-2). */
export function useAppToast(): (toast: ToastMessage | null) => void {
  return useAddTransaction().showToast;
}
