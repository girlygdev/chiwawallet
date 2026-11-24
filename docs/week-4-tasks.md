# Week 4 tasks

The Week 4 checklist in `mvp-brief.md` broken into one-session tasks. Tick tasks here as they're done; tick the brief's checkbox when its whole group is done.

**Week 4 is done when:** you can enter all your current bills, pots and debts and they list correctly.

Specs: `docs/designs/bills.md`, `savings.md`, `debts.md`, `activity.md` (the add sheet's Savings tab), `delete-pattern.md` (level 2), `more-and-categories.md` (More › Money detail lines). Decisions: `docs/plan-review-2026-11-19.md` (3.5, 3.6, 3.7, 3.8) and "Decisions" below.

## Tasks

- [x] **4a. Migrations: `recurring_bills`, `savings_pots`, `debts`.** Done Nov 24 in two sessions (local; live after the owner's go):
  - [x] **4a-1. `recurring_bills`.** Done Nov 24 (local; live after the owner's go). Also `delete_category()` moves bills, and the delete dialog counts them.
  - [x] **4a-2. `savings_pots`, `debts`, and `pot_id` / `debt_id` on transactions.** Done Nov 24. Default pots: Emergency Fund (life-buoy, red) and Sinking Funds (calendar-clock, blue).
  - Columns from the brief's data model, plus `first_due_month` on bills (3.7). Pots' `pay_slot` is `payday_1`, `payday_2` or `every` (no split, 3.8).
  - Same-owner links like `transactions` (`(id, user_id)` keys); a bill's `category_id` uses the same rule as transactions (`on delete no action`).
  - On `transactions`: add `pot_id` and `debt_id`, `on delete set null` (3.6). A `savings` row needs a pot; a `debt_payment` row needs a debt.
  - **Default pots:** Emergency Fund and Sinking Funds, created at sign-up and added to existing accounts. ₱0 starting balance, no target, ₱0 planned contribution.
  - **RLS** on all three, with user A can't read or write user B's rows tests in `tests/db/`.
  - **Live:** dry run, then the owner's go. Regenerate types.
  - Done when: `npm run test:db` passes and a new sign-up gets the two default pots.
- [x] **4b. Pure functions and Zod schemas, tests first.** Done Nov 24: `lib/bills.ts`, `lib/debts.ts`, `lib/pots.ts`, `validation/bill.ts`, `pot.ts`, `debt.ts`, and `dateInMonth()` in `lib/periods.ts`.
  - Bill due dates: monthly, quarterly and yearly (from `first_due_month`), and which period each falls in.
  - Debt schedule: installment due dates, amount paid and remaining, on time or late.
  - Pot balance: starting balance + contributions − withdrawals; progress and the goal date (`savings.md` §1).
  - Due days on the 29th–31st use the month's last day, like paydays (`debts.md` fix #5).
  - Zod schemas in `src/lib/validation/` (one file per entity).
  - Done when: the Vitest cases pass, including Feb 29–31 and a yearly bill.
- [ ] **4c. Bills screen** (`bills.md`).
  - List with the monthly total ("Bills each month": quarterly ÷ 3, yearly ÷ 12), New bill, and Edit bill (New bill's form with **Save changes** and **Delete bill**).
  - "Paid from": payday 1, payday 2 or split, labelled with the budget's real pay days (fix #4).
  - "Remind me" hint: "Shows on your dashboard 2 days before" (fix #3).
  - Delete: level 2, stating what's planned. Past transactions stay.
  - Done when: your real bills list with the right monthly total.
- [ ] **4d. Savings screen** (`savings.md`).
  - Pot cards with balance, progress, target and status ("On track for…", "Locked · deposits only").
  - New and Edit pot. Locked switch with `role="switch"`. The icon choices must include the default pots' icons: Emergency is `life-buoy`, and add `calendar-clock` for Sinking Funds.
  - Pot details at `/savings/details?id=…` (not `[id]`: a dynamic segment breaks the build). Mobile stacks the desktop panel (fix #4).
  - Delete: level 2. "Move it to [pot]" or "Count it as withdrawn" (`delete-pattern.md` §4). Locked pots only offer "Count it as withdrawn" after a confirm.
  - Done when: your real pots list with the right balances.
- [ ] **4e. The add sheet's Savings tab** (`activity.md`).
  - Add to or withdraw from a pot. A withdrawal is a negative `savings` amount (3.5), using the system Savings pot category.
  - Withdraw is disabled for locked pots ("₱48,500 · locked, deposits only").
  - Activity's Savings filter and the "To savings" total include it.
  - Done when: adding and withdrawing update the pot's balance and Activity.
- [ ] **4f. Debts screen** (`debts.md`).
  - List with amount left; New and Edit debt (installments or one-time, with a schedule preview); optional interest rate, display only.
  - Details at `/debts/details?id=…`. On mobile, the card expands in place (fix #4). The mobile summary card is white, not Deep Green (fix #1).
  - Delete: level 2. "Mark it paid off" or "Delete it (paid outside the app)".
  - Done when: your real debts list with the right amounts left.
- [ ] **4g. Wire-up.**
  - More › Money detail lines: "3 recurring", "3 pots · ₱67,500 saved", "1 debt · ₱8,000 left".
  - Dashboard: transfers to pots count in Money out (decided in 3f). Activity keeps showing them as To savings.
  - Done when: the Dashboard and Activity agree.
- [ ] **4h. Live check.** Push, then enter your real bills, pots and debts on your phone.

## Decisions (owner, Nov 24)

- Quarterly and yearly bills get `first_due_month` (3.7).
- Pots have no split: `payday_1`, `payday_2` or `every` (3.8).
- Emergency Fund and Sinking Funds are default pots, not categories, created at sign-up and for existing accounts.
- Details pages use a query string (`/debts/details?id=…`, `/savings/details?id=…`), not `[id]`.
- Bills' "Remind me" hint: "Shows on your dashboard 2 days before". Push notifications are v1.1.
- The mobile debts summary card is white; the green progress bar carries the good news.
- Pots and debts belong to the user, not a budget, as in the brief. Bills keep `budget_id`.

## Open (settle in 4a)

- ~~A bill's `pay_slot` for one-payday budgets~~ **Decided Nov 24:** `every`, like income sources; the form hides the choice on weekly and monthly budgets.

## Out of Week 4

Plan items and "Planned in N upcoming paydays" (Week 5); pot progress on the Dashboard, debt status and Due this period (Week 6); push reminders (v1.1).
