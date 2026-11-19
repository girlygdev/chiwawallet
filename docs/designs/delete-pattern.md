# Chiwawallet Delete Pattern Spec

Nov 19, 2026 · Girly Gado

How every delete in Chiwawallet works: match the level of caution to what people lose. Canvas files: `DeleteGuide`, `DeleteTx`, `DeleteTxUndo`, `DeleteTxDesktop` and `DeletePot` (on the **Delete pattern** page), plus `DeleteAccount` (`settings.md`).

## 1. Three levels

| Level | Name | Use for | When | Data |
| --- | --- | --- | --- | --- |
| 1 | Quick undo | Transactions, one-off items, plan items | Nothing else depends on it | Soft delete: set `deleted_at`, purge after 30 days |
| 2 | Delete with a choice | Savings pots, debts, bills, income sources, categories | It holds money, or other records point to it | Hard delete after the user chooses what happens to linked money and records |
| 3 | Permanent | The account, a whole budget | It can't be recovered | Hard delete with cascade |

### Level 1: Quick undo

- A confirmation sheet (mobile) or dialog (desktop) showing the item and its effect in pesos.
- After deleting: a toast with **Undo** for 5 seconds.
- Soft delete: set `deleted_at`, and purge later.

### Level 2: Delete with a choice

- Say what's linked: the balance, planned items, transactions.
- Ask what happens to it: move the balance, or re-categorize.
- Keep past history in Activity; remove only future plans.
- There's no undo, so the choice screen is the safety net.

### Level 3: Permanent

- A full screen, not a sheet.
- Offer **Export my data** first.
- Type DELETE to turn on the button.
- Email a confirmation afterwards.

## 2. Rules for every delete

1. The title is a question that names the thing: "Delete Travel pot?", never "Are you sure?"
2. Show the item itself (name, amount, date), so people know exactly what goes.
3. Spell out the effect in pesos: the budgets, balances and plans that change.
4. The red button repeats the action and the object: "Delete transaction". The safe button says "Keep it".
5. Focus starts on **Keep it**. Nothing destructive is ever the default.
6. Mobile: a bottom sheet, with the buttons stacked and red on top. Desktop: a centered dialog, with red on the right; Esc or clicking outside keeps the item.
7. Red (#B42318) is used only for destructive actions, nowhere else in the app.

**Words:** "Delete" for things you made. "Remove" for taking something out of a plan without deleting it. "Keep it" to cancel. The toast says "[Item] deleted · Undo".

## 3. Level 1 example: delete a transaction

**Opened from:** swipe left → Delete (mobile), the row's Delete button (desktop), or the Delete link in Edit transaction.

**Sheet / dialog:** `role="alertdialog"`, `aria-modal="true"`, `aria-describedby` pointing to the description.
- **Title:** "Delete this transaction?"
- **Description:** "You can undo this for a few seconds after."
- **Item card:** the category tile, "Lunch", "Food · Nov 19 · Office canteen", −₱180.
- **Effect rows:**
  - "Food budget left: ₱2,760 → ₱2,940"
  - "Money out this period: ₱9,450 → ₱9,270"
- **Buttons:** **Delete transaction** (destructive), **Keep it** (secondary).
- **Desktop dialog:** `min(440px, 100% − 32px)` wide, white, 2px ink border, `6px 6px 0` shadow, 22px radius, 24px padding. Hint: "Press Esc or click outside to keep it."

**Toast** (`DeleteTxUndo`): `role="status"`, `aria-live="polite"`.
- Ink background, white text, 16px radius, a soft shadow (`0 8px 24px rgba(0,0,0,0.25)`), placed above the bottom bar.
- An icon, "Lunch deleted", and the second line "₱180 is back in your Food budget".
- A white 40px **Undo** button with Forest text.
- A 3px countdown line along the bottom (`text-2` colour) that empties over 5 seconds.
- The list and totals update right away (the day net −₱340 → −₱160, money out → ₱9,270). Undo puts everything back.
- If another toast replaces it, the first delete stays done.

**Deleting a transaction that paid a plan item** (for example a bill marked paid) also clears that item's `paid_at`, so it shows as due again. Say so in the effects: "Subscriptions goes back to Due Nov 22."

## 4. Level 2 example: delete a savings pot

**Sheet / dialog:** `role="alertdialog"`.
- **Title:** "Delete Travel pot?"
- **Description:** "It still has **₱6,000** and is planned in 3 upcoming paydays."
- **"What should happen to the ₱6,000?"**: radio cards.
  - **Move it to Emergency pot**, "Emergency becomes ₱19,000 of ₱30,000". A pot picker if there's more than one other pot.
  - **Count it as withdrawn**, "Adds ₱6,000 to this period's money".
- **What else happens:**
  - "Upcoming ₱2,000 contributions are removed from 3 plans."
  - "Past deposits stay in Activity for your records."
- **Buttons:** **Delete Travel pot** (destructive), **Keep it**.

### Other level 2 deletes (not designed; follow the pot example)

| Item | Linked things to state | Choice to offer | What happens |
| --- | --- | --- | --- |
| Debt | Amount left, planned payments | "Mark it paid off" or "Delete it (paid outside the app)" | Future debt plan items are removed; past payments stay |
| Bill | Planned in N upcoming paydays | None needed; just state it | Future plan items are removed; paid ones stay |
| Income source | Expected in N upcoming paydays | None needed | Future expected income is removed; received income stays |
| Category | N transactions, plan items, budget | "Move them to [category picker]" (required) | Transactions and plan items are re-categorized, then the category is deleted |
| Locked pot | Balance | Only "Count it as withdrawn" if the user confirms the money really left; otherwise suggest keeping it | — |

The system categories (Savings pot, Extra debt payment) can't be deleted.

## 5. Level 3

See Delete account in [`settings.md`](settings.md).

## 6. For the build

- `transactions` and `plan_items` have `deleted_at`. RLS and every query filter `deleted_at is null`; put this in shared query helpers so it's never forgotten.
- A daily job (Supabase `pg_cron` or a GitHub Actions cron calling a Route Handler) purges rows with `deleted_at` older than 30 days. This also keeps the Data Privacy Act promise that deleted data is really gone.
- Undo sets `deleted_at` back to null.
- Level 2 deletes run in a single server action (a transaction, in the database sense), so a pot is never deleted without its balance being moved.
- The demo account resets on a schedule, so deletes there are allowed but temporary.
