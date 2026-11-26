# Week 5 tasks

The Week 5 checklist in `mvp-brief.md` broken into one-session tasks. Tick tasks here as they're done; tick the brief's checkbox when its whole group is done.

**Week 5 is done when:** tests pass for generated 15th and 30th plans, and you can open and edit a period three months ahead.

Specs: `docs/designs/plan.md` (read its "Decided Nov 25" note first), `dashboard.md` (shared formulas), `delete-pattern.md` (level 1), `more-and-categories.md` (Budget per payday), `bills.md`, `savings.md`, `debts.md` (where they say "Week 5"). Decisions: `docs/plan-review-2026-11-19.md` (3.9, 3.10, 5.3) and "Decisions" below.

## Tasks

- [x] **5a. Migration: `plan_items`.** Done Nov 25 (`20261125100000_plan_items.sql`, local and live; types regenerated). Also `edited` and the "Debt payment" system category (owner, Nov 25). One unique key per source per period (debt installments are monthly, so one per period); a recurring item whose source is deleted, or whose spending budget's category is moved, becomes a one-off.
  - Columns from the brief, plus `budget_group` (3.9): nullable, required when `category_id` is empty, empty otherwise. Only `starter` items may have no category.
  - `origin` check: `recurring`, `one_off`, `starter`, `assigned`. `planned_amount > 0`. `deleted_at` for soft delete.
  - Same-owner links like `transactions` (`(id, user_id)` keys). Period link `on delete cascade`; category `on delete no action` (moved by `delete_category()`); income source, bill, pot and debt `on delete set null` (3.6).
  - A unique key so generation can't add the same recurring item twice (for example period + bill + half, period + pot, period + debt payment number, period + income source, period + category for spending budgets).
  - `transactions.plan_item_id` foreign key (`on delete set null`).
  - `delete_category()` also moves plan items and counts them in the dialog.
  - Deleting a bill, pot, debt or income source removes its **unpaid items in current and future periods**; paid and past items keep their history (brief: "only future plan items are removed").
  - **RLS** with user A can't read or write user B's rows tests in `tests/db/`.
  - **Live:** dry run, then the owner's go. Regenerate types.
  - Done when: `npm run test:db` passes.
- [x] **5b. `generatePlan()` and plan math, tests first.** Done Nov 25: `generatePlan()`, `payingPeriodStart()`, `starterPlan()`, `planSection()`, `planSummary()` and `validation/plan-item.ts`. Pure functions in `src/lib/plan.ts`:
  - `generatePlan(period, schedule, sources)` returns the items for one period:
    - Income sources for that pay slot, active in the period (start and end dates).
    - Bills: the period pays a due date when it's the latest period of the bill's payday starting on or before it (owner, Nov 25: due Dec 10, paid from the 15th → Nov 15). Split bills are two halves (`splitHalves()`, odd centavo on payday 2). Quarterly and yearly bills only when due.
    - Pot contributions for that slot (`every` pots each payday); none when the contribution is ₱0.
    - Installment and one-time debt payments whose due date's payday is this period (`paydayFor()`). Never "When I can" debts or paid-off debts.
    - Spending budgets from `categories.default_budget`, origin `recurring` (3.10).
  - `starterPlan(income, budget)`: three items ("Needs", "Wants", "Savings & debt") with the budget's `needs_pct`, `wants_pct`, `savings_debt_pct` of this payday's **income** (not carry-in). Needs and Wants round down to whole pesos; Savings & debt gets the rest (owner, Nov 25).
  - `planSummary()`: Money for this period, Planned (income items excluded), Not assigned yet, each group's total, and the planned split vs the budget's targets (debt payments count as Needs).
  - Zod schemas in `src/lib/validation/plan-item.ts`.
  - Done when: Vitest cases pass for a 15th period, a 30th period, a split bill, a pot that only contributes on the 30th, a quarterly bill, an income source that ends, a debt installment, weekly and monthly budgets, and the starter plan rounding.
- [x] **5c. Opening a period.** Done Nov 25: `add_plan_items()` (`20261125110000_add_plan_items.sql`), `plannablePeriods()` and `resolvePlanStart()` in `lib/plan.ts`, `openPlanPeriod()` in `lib/plan-periods.ts`, and a temporary `/plan` list that 5d replaces. Generates on every open of a period that hasn't ended, so new bills show up; past periods never generate.
  - Open any period by its start date (`/plan?start=…`): create the `budget_periods` row if needed (like `getOrCreatePeriod()`), then insert its generated items once.
  - Safe from two tabs at once: the unique keys from 5a plus SQL's bare `on conflict do nothing`. The API's `upsert({ ignoreDuplicates })` only targets the primary key and fails on the partial keys (found in 5a), so this needs a small SQL function (a migration), for example `add_plan_items(period, items)`.
  - Only periods from one before the current one to 3 months ahead can be opened; anything else falls back to the current period.
  - Done when: opening a period three months ahead creates it with the right items, and opening it again adds nothing.
- [x] **5d. Plan screen** (ticked Nov 26 after the live check, 5i) (`plan.md` §1–5). Likely two sessions:
  - [x] **5d-1. Picker, summary and groups.** Done Nov 25: `periodIncome()`, `incomeStatus()` and `planItemDetail()` in `lib/plan.ts`; `components/plan/`. Spending budgets show the planned amount only and headings show group totals until planned vs actual (Week 6); the "I got paid" pill came in 5d-2. Period picker (one past, now, future up to 3 months; chips are links, the current one has `aria-current`), summary card, MONEY IN, BILLS, DEBT PAYMENTS, SAVINGS, SPENDING BUDGETS and ONE-OFF ITEMS. Tick circles are display only (Week 6). Past periods read-only with a "Closed" tag once closed (Week 6).
  - [x] **5d-2. Desktop table and empty state.** Done Nov 25: `isEmptyPlan()` (nothing but income), `planCounts()` and `planDone()`. The table has ITEM, DETAILS and PLANNED until Week 6. The starter card's button is 5e. Also the I got paid pill and "Starting balance · From setup". Stat cards, the plan table, the Planned split of income card. Empty plan with the starter plan card and the "Or build it yourself" rows. No Copy last period's plan, no Give leftover a job side card (Week 6).
  - Done when: your real current and next periods show the right items and totals.
- [x] **5e. Edit and delete items; starter plan.** Done Nov 26 (checked in a browser on local Supabase). `editImpact()`, `removeImpact()` and `missingStarterItems()` in `lib/plan.ts`; `plan/actions.ts`, `plan/plan-item-sheet.tsx`, `components/plan/plan-item-form.tsx`.
  - Tapping a row edits its name and amount (and "Needed by" for one-off items). Items linked to a bill, pot or debt keep the link; only this period changes.
  - Delete is level 1: soft delete with an undo toast. Worded **Remove from plan** (delete-pattern.md word list).
  - **Use this starter plan** creates the three `starter` items. The Plan options menu moved to 5g (owner, Nov 26), when Edit spending budgets exists.
  - Ended periods are read-only: no edit links, no starter button, and the actions refuse them.
  - Done when: editing and deleting an item updates the summary, and Undo brings it back.
- [x] **5f. Add one-off item** (`plan.md` §6). Done Nov 26 (checked in a browser on local Supabase). `suggestedPeriodStart()` and `oneOffImpact()` in `lib/plan.ts`; `addOneOffItem` and `getPeriodNotAssigned` in `plan/actions.ts`; `components/plan/one-off-form.tsx`. Category uses Add expense's tile grid (top 5 + More), not chips. Needed by is a plain date input. The impact box leaves out "with a reminder" until Week 7.
  - Sheet on mobile, dialog on desktop. Fields: What is it for?, Amount, Needed by (optional), Which payday pays for it? (period cards up to 3 months ahead), Category.
  - Smart default from Needed by: "Suggested: the payday just before Dec 5."
  - Impact box: "Nov 30 – Dec 14 not assigned: ₱23,200 → ₱20,700", yellow when it goes below ₱0.
  - Done when: a one-off added to a future period shows there with the right totals.
- [x] **5g. Debt payments and spending budgets.** Split in two (owner, Nov 26). Done Nov 26.
  - [x] **5g-1. Spending budgets.** Done Nov 26 (checked in a browser on local Supabase).
    - **Budget per payday** on New and Edit category (`default_budget`), starting with the current period. The category list shows "₱3,000 per payday".
    - The **Set a budget** sheet (`plan.md` fix #2, `?add=budget`): category, amount, and "Every payday" or "This period only".
      - "Every payday" saves `default_budget` and sets this period's item.
      - "This period only" sets just this period's item, marked `edited`.
      - Both make a `recurring` item, one per category per period.
    - Migration `20261126100000_plan_items_insert_edited.sql` (insert `edited`): local and live (Nov 26).
  - [x] **5g-2. Debt payments and the Plan options menu.** Done Nov 26 (checked in a browser on local Supabase). `debtLeft()` in `lib/debts.ts`, `debtPaymentSchema`, `addDebtPayment`; `components/plan/debt-payment-form.tsx`, `payday-picker.tsx`, `plan-options-menu.tsx`. The menu also offers Plan a debt payment; the empty plan's Debt payments row keeps "Add a debt".
    - Plan a debt payment in any period: an extra amount on any active debt (including "When I can"), origin `one_off` with `debt_id`, counting as Savings & debt payoff. Capped at what's left on the debt.
    - The **Plan options menu** (moved from 5e): Set a budget, Use starter plan, Edit spending budgets (Settings › Categories). Period settings isn't designed yet.
    - Share 5f's payday cards and impact box between Add one-off item and Plan a debt payment.
  - Done when: a debt payment planned two periods ahead and a Food budget both show in their periods.
- [x] **5h. Wire-up.** Split into 5h-1, 5h-2 and 5h-3 (owner, Nov 26). Done Nov 26.
  - [x] **5h-1. Keep plans in sync.** Done Nov 26 (checked in a browser on local Supabase). `planSync()` in `lib/plan.ts`, `syncOpenPeriods()` in `lib/plan-periods.ts`.
    - Saving a bill, pot, income source, debt (and Mark paid off), category, or Set a budget "Every payday" brings every open period in line. So does opening a period.
    - Only **unpaid, unedited** `recurring` items change. Items that no longer belong are soft-deleted and come back if they belong again.
    - Remove from plan marks the item `edited`, so it stays removed. Undo puts the old value back.
    - No "Update future paydays only?" question (owner, Nov 26).
    - Migration `20261126110000_plan_items_removed_are_edited.sql`: local and live (Nov 26).
    - Done when: changing a bill's amount shows in next period's plan. ✅
  - [x] **5h-2. The add sheet's budget line.** Done Nov 26 (checked in a browser on local Supabase). `categoryBudgets()` and `budgetLeft()` in `lib/plan.ts`; `budgetLine()` in `sheet-impact.ts`.
    - "Food budget: ₱2,580 left after this", "₱120 over your Food budget" (yellow), or "No Food budget yet. Set one in Plan to see what's left."
    - The budget is this period's budget item, none if removed, or the budget per payday while the period's plan hasn't been opened (owner, Nov 26). Starter lines and one-offs don't count.
    - Skipped: "₱2,760 left" on the category picker's tiles (not in 5h). It's still an open item.
  - [x] **5h-3. Bills and Savings.** Done Nov 26 (checked in a browser on local Supabase). `billDueInPeriod()`, `stillDue()`, `potsDueLine()`, `upcomingCounts()` and `upcomingLine()` in `lib/plan.ts`; `openCurrentPlan()` and `upcomingItems()` in `lib/plan-periods.ts`. No "Paid this period" until Mark paid (Week 6); "due" lines don't clear when you pay until then.
    - Bills: "₱1,000 still due this period" (summary card and desktop stat, with the next bill).
    - Savings: "Due this period: ₱2,000 to Travel" under YOUR POTS.
    - Delete bill and Delete pot: "Planned in N upcoming paydays".
    - Both pages open the current period the way the Plan does, so its items exist and are in sync.
- [x] **5i. Live check.** Push, then plan your next three months on your phone. Done Nov 26: the owner checked the live site (`89e6d34`) and said "tick it".

## Decisions (owner, Nov 25)

- Starter items have no category; plan items get a nullable `budget_group`, required only when there's no category (3.9).
- Spending budgets copied from `categories.default_budget` use origin `recurring` (3.10).
- Plan URLs use a query string: `/plan?start=2026-11-30`, not `/plan/[periodId]`.
- `generatePlan` adds installment and one-time debt payments due in the period automatically; "When I can" debts are planned by hand only.
- The picker reaches 3 months ahead (about 6 periods on a twice-a-month budget), plus one past period.
- Copy last period's plan moved to `V1.1.md` (5.3). Give leftover a job moved to Week 6.
- Plan items have no note; edit name and amount only.

- **Decided in 5a:** an `edited` flag on plan items, set by 5e's Edit, so 5h's sync skips hand-edited items. The locked "Debt payment" category (Needs) is added in 5a, not Week 6, because generated debt items need it.

## Out of Week 5

Mark paid and the tick circles, planned vs actual, carry-over and closing a period, Give leftover a job, the Transfer tab (Week 6); Dashboard due this period and pot progress (Week 7).
