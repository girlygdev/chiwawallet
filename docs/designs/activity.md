# Chiwawallet Activity & Add Transaction Spec

Nov 19, 2026 · Girly Gado

The list of every peso in and out this period, and the sheet for logging one. Mobile calls the page **Activity**; desktop calls it **Transactions**. They're the same route and data. Canvas files (on the **Transactions & More** and **Payday & empty states** pages):

| Screen | Mobile | Desktop |
| --- | --- | --- |
| Transaction list | `Transactions` | `TransactionsDesktop` |
| Empty list | `ActivityEmpty` | `TransactionsEmptyDesktop` |
| Add expense | `TransactionAdd` | Side panel in `TransactionsDesktop` |
| Add income | `TransactionAddIncome` | Side panel, Income type |
| Add to or withdraw from a pot | `TransactionAddSavings` | Side panel, Savings type |
| Choose a category | `CategoryPicker` | (see `more-and-categories.md`) |

Deleting is in [`delete-pattern.md`](delete-pattern.md), categories in [`more-and-categories.md`](more-and-categories.md), and the frame in [`app-shell.md`](app-shell.md).

Routes: `/activity` (or `/transactions`) and `/activity/[periodId]`. The add sheet opens over any page from the + button.

## 1. Mobile list

1. **Header:** the h1 "Activity" (Fredoka 28px) and a 44px search button.
2. **Period bar:** a white card (16px radius, 4px padding) with previous and next arrows around the dates.
3. **Totals:** two cards side by side.
   - Money in: ₱25,000 in Fredoka 22px, `green-600`.
   - Money out: ₱9,450 in Fredoka 22px, ink.
4. **Filter chips:** All, Spending, Income, Savings, Bills. They're 38px pills; the selected one is Deep Green with a 2px ink border and white text, and each has `aria-pressed`.
5. **Hint:** "Swipe a row left to edit or delete it." (13px `text-3`). Show it until the user has swiped once.
6. **Day groups,** newest first. Each has an h3 ("Today, Nov 20", "Nov 19"; 13px weight 800 `text-3`), the day's net on the right ("−₱1,300", "+₱20,300"), and a list card of rows.

### Transaction row

A 40px category tile, the name (weight 800), a 13px detail line "Category · note", and the amount on the right.

| Type | Amount | Detail example |
| --- | --- | --- |
| Expense | −₱1,240, ink | Food · Weekly restock |
| Income | +₱25,000, `green-600` | Income · 15th payday |
| Bill paid from the plan | −₱1,700, ink | Bills · Planned bill · paid |
| Transfer to a pot | →₱3,000, ink | Savings · Planned savings |
| Withdrawal from a pot | ←₱1,000, ink | Savings · From Travel |
| Debt payment | −₱4,000, ink | Debt · SPayLater |

- **Name:** the note if there is one, otherwise the category name (for example "Jeep fare").
- **Swipe left** shows two 64px actions: **Edit** (`track` fill) and **Delete** (#B42318, white text). On devices without touch, show the same two actions as icon buttons on hover or focus.
- Tapping a row opens it in the add sheet in edit mode, with the title "Edit transaction".
- Load 50 rows at a time, and more on scroll.

### Search

The search button opens a search field over the header. It searches names and notes in the selected period, with a "Search all periods" option.

## 2. Desktop list

- **Header:** "14 transactions this period" (`text-3`), the h1 "Transactions", the period switcher, and an **Export CSV** secondary button that exports the selected period.
- **Totals:** three stat cards.
  - Money in: ₱25,000.
  - Spending: ₱6,450, "incl. ₱1,700 bills".
  - To savings: ₱3,000.
- **Filters:** a search input ("Search notes or names", with a visible or hidden label), a type group (All, Spending, Income, Savings) with `aria-pressed`, and a category select ("All categories").
- **Table:** NAME, NOTE, CATEGORY, TYPE, AMOUNT, plus Actions (hidden header).
  - Day rows are full-width `<th scope="rowgroup">` lines with the date and the day's net.
  - Notes show "—" when empty.
  - Each row has 44px Edit and Delete icon buttons named for the row ("Edit Groceries", "Delete Groceries").
- **Side panel,** always visible on wide screens: the add form (section 3) inline, with a footer tip: "Tip: press N anywhere to add a transaction."

## 3. Add transaction sheet

A bottom sheet on mobile: white, 28px top corners, a grab handle and a close button, `role="dialog"`, `aria-modal="true"`. On desktop the same form sits in the side panel.

**Type tabs:** a `track` segmented control with Expense, Income and Savings, 40px options. The sheet title changes with the tab, and the tab remembers the last type used.

### Expense (default)

| Part | Spec |
| --- | --- |
| Amount | Label "Amount", ₱ in Fredoka 36px `text-3`, the number in Fredoka 56px, `inputmode="decimal"`, focused on open |
| Category | A 3-column grid of the 5 most-used categories plus **More** (dashed, opens the category picker). Each tile has a 36px icon and a 12px weight 800 name; selected has a 2px `green-600` border and `mint` fill |
| Date | 46px button, "Today, Nov 20", opens a date picker. It can't be in the future, and it must be within an open period |
| Note (optional) | 46px text input, e.g. "Lunch" |
| Impact line | `mint` note: "Food budget: ₱2,580 left after this." If it goes over: yellow, "₱120 over your Food budget." If the category has no budget: "No Food budget yet. Set one in Plan to see what's left." |
| Save | Hero sticker button **Save expense** (56px) |

- **Goal:** log an expense in 10 seconds or less: amount → category → Save. Date and note are optional.
- **After saving:** close the sheet and show a toast, "Expense saved · −₱180", with Undo.
- **Period:** the transaction goes in the period that contains its date (Asia/Manila).

### Income

- **Amount**, as above (for example 12,500).
- **"Where is it from?"**: radio cards for each income source, plus **One-time income**.
  - Source cards show "₱25,000 expected · Nov 15", plus a "Received" tag if it's already logged this period. Freelance shows "₱8,000 expected · next on Nov 30".
  - Picking a source fills in its expected amount.
  - One-time income, with the hint "Bonus, 13th month, gift, refund, side sale", shows a **Name** field (for example "13th month pay").
- **Date received.**
- **Impact line:** "Safe to spend goes from ₱13,550 to ₱26,050."
- **Checkbox** (checked by default): "Help me give this money a job after saving". When checked, saving opens Give leftover a job (`plan.md`).
- **Button:** **Save income**.
- **Saves:** a `transactions` row with type `income` and `income_source_id` (empty for one-time income).

### Savings

- **Segmented control:** Add to pot or Withdraw.
- **Amount.**
- **"Which pot?"**: radio cards per pot, plus a "+ New pot" link.
  - Each card shows the balance and target ("₱6,000 of ₱20,000"), plus a "Planned ₱2,000" tag if this period has a plan item for it.
  - Locked pots show "₱48,500 · locked, deposits only" and are disabled when Withdraw is selected.
- **Impact lines:** "Travel will be at ₱8,000 of ₱20,000 (40%)." and, when it matches a plan item, "This also ticks off the ₱2,000 planned for this period."
- **Button:** says exactly what happens, "Add ₱2,000 to Travel" or "Withdraw ₱1,000 from Travel".
- **Saves:** a `transactions` row with type `savings` and `pot_id`. A withdrawal is saved as a negative savings amount (or add a `direction` field; decide before writing the migration). Matching a plan item sets `plan_item_id` and the item's `paid_at`.

## 4. Choose a category

A full-height sheet with a back arrow, titled "Choose a category".

- **Search field:** "Search categories", with a visible or hidden label.
- **RECENT:** a row of the 4 most recent categories.
- **One section per group,** each with a caps h3 and its target: NEEDS · 50% target, WANTS · 30% target, SAVINGS & DEBT PAYOFF · 20% target. Tiles are 92px minimum height, in a 3-column grid.
- **Tiles** with a budget this period show what's left ("₱2,760 left"). The current choice has `aria-current="true"` and the selected border.
- **Last tile:** **New category** opens New category (`more-and-categories.md`), then returns here with the new category selected.

## 5. Empty state

Shown when the period has no transactions (`ActivityEmpty`, `TransactionsEmptyDesktop`).

- **Totals:** both ₱0. Filter chips are disabled.
- **Empty card:** the mascot, the h2 "No transactions yet", then "Sit, stay, log. Everything you spend or receive this period shows up here, grouped by day."
  - Two buttons: **Log an expense** and, when pay is due, **I got paid ₱25,000** (opens Add income pre-filled).
- **Note under it:** "Your ₱5,000 starting balance is already counted in this period."
- **"Good habits from day one":** a numbered list.
  1. Log as you go, right after you pay. It takes about 10 seconds.
  2. Pick a category so your budgets and 50/30/20 split stay accurate.
  3. Made a mistake? Swipe a transaction left to edit or delete it. (Desktop: "Use the edit and delete buttons on any row…")
- **Desktop:** the add panel stays visible on the right.

## 6. Accessibility

- [ ] Swipe actions also have a keyboard and screen-reader path: each row has an Actions menu button, or the Edit and Delete buttons are reachable by Tab.
- [ ] Filter chips use `aria-pressed`; the type tabs use `role="tablist"` with `role="tab"` and `aria-selected`.
- [ ] The amount input has a visible "Amount" label; the ₱ sign is `aria-hidden`.
- [ ] Category tiles are buttons with `aria-pressed`, and their names are readable without the icon.
- [ ] Impact lines sit in `aria-live="polite"`.
- [ ] Day headings are real `<h3>`s; the day net is in the same heading or tied to it with `aria-describedby`.
- [ ] The "N" shortcut doesn't fire while typing in an input.

## 7. Fix before building

1. **Date format:** the period bar says "Nov 15 – Nov 29". Use **Nov 15 – 29**.
2. **Bills filter:** mobile has a Bills chip, desktop doesn't. Keep the four desktop types (All, Spending, Income, Savings) and let the category select handle Bills, or add Bills to both. Pick one.
3. **Desktop amount and date format:** the desktop form shows "180.00" and a text date input ("Nov 20, 2026"). Use the same amount input and date button as mobile.
4. **Savings categories:** the category picker lists "Savings pot" and "Extra debt payment" under Savings & debt payoff, but transfers to pots use the Savings tab, not a category. Keep these two as system categories assigned automatically, and hide them from the expense picker, so the same money can't be logged two ways.
5. **Withdrawals and debt payments** aren't shown in the list mock. Use the formats in section 1.
6. **Edit mode** isn't designed. Reuse the add sheet with the title "Edit transaction", a Delete link at the bottom, and the button **Save changes**.
