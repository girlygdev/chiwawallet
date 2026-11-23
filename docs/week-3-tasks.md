# Week 3 tasks

The Week 3 checklist in `mvp-brief.md` broken into one-session tasks. Tick tasks here as they're done; tick the brief's checkbox when its whole group is done.

**Week 3 is done when:** you log a real expense on your phone in under 10 seconds.

Specs: `docs/designs/activity.md`, `more-and-categories.md` (§4 default categories), `delete-pattern.md` (level 1), `dashboard.md`. Decisions: `docs/plan-review-2026-11-19.md` (3.4–3.6, 3.14 as changed Nov 20, 5.1–5.2, and "Week 3 scope").

## Tasks

- [x] **3a. Migrations: `categories` and `transactions`.** Done Nov 23 (local and live). Likely two sessions, one per table.
  - **`categories`:** done Nov 23 (`20261123105712_categories.sql`, on local and live; types regenerated).
    - Columns: name, kind, budget_group, icon, color, default_budget and `system_key`.
    - Checks: expense needs a group, income has none. Names are unique per user ignoring case, and each `system_key` once per user.
    - System categories can't be renamed or deleted.
  - **Default categories:** done Nov 23 (icons and colours in the migration).
    - Copied per user by `handle_new_user()` at sign-up.
    - Needs: Food, Transport, Bills, Rent, Load & data, Health, Padala.
    - Wants: Personal, Shopping, Dining out, Fun, Gifts, Travel.
    - Plus the system categories Income, Savings pot and Extra debt payment.
    - The migration also adds them for existing accounts.
  - **`transactions`:** done Nov 23 (`20261123141644_transactions.sql`, on local and live; types regenerated).
    - Columns from the brief.
    - `amount > 0`, except `savings`, which can't be 0 (a negative amount is a withdrawal).
    - `deleted_at`, and the period link tied to the user (same pattern as `income_sources`).
    - Category links use `on delete restrict`; income source, pot, debt and plan item links use `set null` (3.6).
    - Pot, debt and plan item links are added with their tables in Weeks 4–5.
  - **RLS:** on both tables, with user A can't read or write user B's rows tests in `tests/db/`.
  - **Live:** applied to live only after a dry run and the owner's go. Types are regenerated.
  - Done when: `npm run test:db` passes and a new sign-up gets the 16 categories.
- [x] **3b. Transaction math, tests first.** Done Nov 23. Pure functions in `src/lib/transactions.ts`:
  - Signed amounts.
  - Period totals: money in, money out (spending plus debt payments), to savings.
  - Day groups with their net.
  - `cashOnHand()` = opening balance + income − spending − net savings − debt payments. Week 6's carry-over refines this.
  - Zod schemas in `src/lib/validation/transaction.ts`.
  - Done when: the Vitest cases pass (including a withdrawal, a deleted row, and an empty period).
- [x] **3c. Add expense sheet.** Done Nov 23 in two parts: 3c-1 (sheet and saving) and 3c-2 (category picker and category colours). The New category tile waits for 3h, and "₱X left" on tiles waits for the Plan (Week 5). The phone timing check is part of 3g.
  - **Fields:**
    - Amount, focused on open.
    - Category grid: your 5 most-used plus **More**, which opens the category picker (search, Recent, one section per group). System categories are hidden from the picker.
    - Date: our "Today, Nov 20" button opens the browser's native date picker. No future dates, and nothing before the first period.
    - Note.
  - **Impact line:** "Money out this period: ₱X → ₱Y" until Plan exists (Week 5).
  - **Saving:** goes in the period that contains the date (`getOrCreatePeriod`).
  - **After saving:** close the sheet and show our own toast "Expense saved · −₱180" with Undo.
  - **The + button:** opens the sheet over any page (it links to Activity today).
  - Done when: amount → category → Save works on a phone in under 10 seconds.
- [ ] **3d. Income tab.**
  - "Where is it from?": source cards fill in the expected amount. One-time income saves its name as the note.
  - "Received" tag on sources already logged this period. The first period also counts `first_pay_received` (3.14 as changed).
  - **Save income**.
  - Income screen leftovers from Week 2: Received and Expected status lines, and Recently received.
  - Done when: logging pay marks the source Received on the Income screen and in the sheet.
- [ ] **3e. Activity list.** Likely split in two: the list, then edit and delete.
  - **Mobile:**
    - Period bar ("Nov 15 – 29").
    - Money in and Money out totals.
    - Filter chips: All, Spending, Income, Savings.
    - Rows grouped by day, newest first, with each day's net.
    - Search within this period.
    - Empty state.
  - **Desktop:** three stat cards, a table, and the add form in a side panel.
  - **Edit:** reuses the sheet ("Edit transaction", **Save changes**, a Delete link).
  - **Delete:** level 1 (`delete-pattern.md` §3) with Edit and Delete buttons on every row, then an Undo toast for 5 seconds.
  - Done when: add, edit, delete and undo all update the list and totals.
- [ ] **3f. Dashboard.** Expected vs actual income, spent, and available (`cashOnHand`) for this period.
  - Done when: it matches the Activity totals.
- [ ] **3g. Live check.** Push, then log a real expense on your phone in under 10 seconds.
- [ ] **3h. Categories (optional, else Week 4).** The category list from More › Categories, New category, Edit category, and a level 2 delete that moves rows first. Also add the picker's last tile, **New category**, which returns to the picker with the new category selected (activity.md §4).

## Decisions

- Categories are per user. The defaults are copied at sign-up and can be edited. Income, Savings pot and Extra debt payment are locked system categories (3.4, option A).
- Pot withdrawals are negative `savings` amounts (3.5).
- Deleting a pot, bill, debt or income source keeps past transactions; deleting a category moves them first (3.6).
- No income transaction is created from onboarding's "pay already arrived" answer; the opening balance already includes it (3.14, changed Nov 20).
- Our own toast; the browser's native date picker on phone and desktop. A themed calendar is in `V1.1.md`.
- Out of Week 3: the Savings tab (Week 4), the "budget left" impact line and "Give this money a job" (Week 5), Export CSV (Week 8), Search all periods, the N shortcut and swipe (`V1.1.md`).
