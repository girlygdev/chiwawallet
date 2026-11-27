# Dev log

Newest entry first.

## 2026-11-27 · Week 7 · 7g-1 Paydays overview
- **What:** a read-only page, `/plan/paydays` ("Paydays overview" in the Plan options menu), with every payday from your first period to 6 months ahead (today: 15 paydays, Oct 15, 2026 – May 29, 2027).
  - **Columns:** Money in, Bills, Debts, Savings, Spending, One-offs, Planned, Not assigned, and a Total row.
  - **Status:** Closed, Open (the period exists, so its own items, edits and one-offs) or Preview (not opened: `generatePlan()` from today's bills, pots, debts, income and budgets). Rows the Plan can open link there.
  - **Layout:** a table from 1280px; cards below that, two across from tablets.
- **Files:** src/lib/plan.ts, src/lib/plan-periods.ts, src/app/(app)/plan/paydays/page.tsx (new), src/components/plan/paydays-table.tsx (new), src/components/plan/plan-options-menu.tsx, tests/lib/plan.test.ts, docs/week-7-tasks.md
- **Decisions (owner, Nov 27):**
  - Money in is the planned income, past paydays included: it's plan vs Sheet.
  - Not assigned is that payday's money in − planned, without carried-in leftover (the page says so). Below ₱0 shows in the heads-up colour, not red.
  - The range ends 6 months ahead instead of a fixed Apr 2027. Editing is still 3 months ahead, on the Plan.
  - Nothing is opened or written: 3 queries (periods, their items, the plan sources).
- **Tests:** written first, 8 new Vitest cases (650 pass); lint and typecheck pass. Browser: visiting created no periods (2 before, 2 after); a Preview row (Dec 15) showed the same numbers after the Plan opened it; the main account's Nov 15 row matched the Plan's Planned (₱32,349); Jan 15 shows ₱0 debts since SPayLater's last payment was cleared early; the table fits at 1280px (it overflowed at 1024, so it starts at 1280); the menu link works; no console errors.
- **AI notes:** the dev server served a stale `plan-periods.ts` ("loadPaydaysOverview is not a function") until restarted, the second time today; Turbopack seems to miss some script-made edits to `lib/` files. The first table didn't fit at 1280px; shortened "Debt payments" to "Debts" and put the status tag under the dates.
- **Next:** 7g-2, enter your real plan and compare it with your Sheet.

## 2026-11-27 · Week 7 · 7f Carried-forward polish
- **What:**
  - **Plan group headings (phones):** above plan they read "₱575 paid (₱549 planned)" / "₱3,880 spent (₱3,300 planned)"; at or under plan, "₱3,240 of ₱6,000 spent" as before.
  - **Dashboard Due row on a 390px phone:** the detail line wraps under the name instead of being cut short beside the pill. Desktop stays one line.
  - **Closed, empty periods:** the summary and Money in, then "Nothing was planned for this period." No starter card or build rows.
- **Files:** src/lib/plan.ts, tests/lib/plan.test.ts, src/components/plan/plan-groups.tsx, src/components/plan/empty-plan.tsx, src/components/dashboard/due-card.tsx, src/app/(app)/plan/page.tsx, docs/week-7-tasks.md
- **Decisions:** keep Money in on a closed empty period, so you still see what came in (owner, Nov 27). The desktop table already has separate Planned and Actual columns, so it's unchanged.
- **Tests:** written first, 2 new Vitest cases (642 pass); lint and typecheck pass. Browser: main account Bills heading "₱575 paid (₱549 planned)", Spending "₱4,080 of ₱25,800 spent"; fresh account's Due rows wrap to two lines at 390px and stay one line at 1280px; a throwaway local account with an empty Oct 30 period showed Closed, Money in and the new line, while its open empty period still shows the starter card; no console errors.
- **AI notes:** the first browser run hit "groupProgressLine is not a function". An old dev server from earlier was still holding port 3000 with a stale build; restarting it fixed it. No code change was needed.
- **Next:** 7g-1, the Paydays overview.

## 2026-11-27 · Week 7 · 7e Savings and Debts: check against the specs
- **What:** walked `savings.md` and `debts.md` against the pages and fixed three gaps.
  - **Cleared early:** a payment that extra payments fully cleared reads "Jan 25 · cleared early by extra payments", shows its original amount muted and a "Cleared early" tag (was "paid from Jan 15 payday · ₱0 · Paid"). A partly lowered one adds "· ₱1,500 cleared early".
  - **Debts summary card:** white on phones, so the green bar carries the good news; Deep Green hero from tablet up (debts.md fix #1, owner Nov 24).
  - **Savings desktop stats:** "₱2,000 more planned" / "Nothing else planned" and "₱3k + ₱4k + ₱5k" / "No savings plans yet".
- **Files:** src/lib/debts.ts, src/lib/pots.ts, src/app/(app)/debts/page.tsx, src/app/(app)/savings/page.tsx, tests/lib/debts.test.ts, tests/lib/pots.test.ts, docs/week-7-tasks.md, docs/mvp-brief.md (Week 7 items 1 and 2 ticked)
- **Decisions:**
  - `debtProgress()` gets a `cleared` status; `isSettled()` (paid or cleared) keeps Payments made, Next and Mark paid as before.
  - No desktop debt details panel (Week 4), so its subtitle fix doesn't apply.
- **Tests:** 14 new Vitest cases (640 pass); lint and typecheck pass. Browser: SPayLater's third payment showed "Cleared early" with ₱4,000 muted; the summary card was white at 390px and green at 1280px; on the fresh account a "Laptop fund" pot (₱40,000 by Mar 2027) showed Behind with "Save ₱4,500 each payday", and a locked MP2 showed "Locked · deposits only" with no Withdraw on its details page; stats read "₱2,000 more planned" and "₱3k + ₱1k"; no console errors.
- **AI notes:** I planned a V1.1 note for a missing back arrow, but it was already there; the Next.js dev badge covered it in my screenshot.
- **Next:** 7f, the carried-forward polish.

## 2026-11-26 · Week 7 · 7d-2 Dashboard: period arrows and Next period
- **What:**
  - **Period switcher:** previous and next arrows around the Dashboard's dates (44px on phones, 40px on desktop), opening those periods on the Plan. In the first period the previous arrow is shown disabled.
  - **Next period** (desktop side column, mint): the dates, "₱25,000 expected · Electricity due" and Plan ahead. Hidden when nothing is expected or due.
  - **Phones:** "Plan next payday · Nov 30 – Dec 14" under Recent activity.
- **Files:** src/lib/plan.ts, src/lib/plan-periods.ts, src/components/dashboard/period-switcher.tsx (new), next-period-card.tsx (new), src/app/(app)/dashboard/page.tsx, tests/lib/plan.test.ts, docs/week-7-tasks.md
- **Decisions:**
  - The arrows come from the Plan's own `plannablePeriods()`, so they never point somewhere the Plan won't open.
  - The card never opens (creates) the next period. Already open: its live items, with edits and one-offs. Not open yet: `generatePlan()` from the sources `openCurrentPlan` already loaded, so at most two more queries. Bills and Savings don't ask for it.
  - Expected = the next period's income items; names in Plan order (bills, debts, savings, one-offs), three then "and N more".
- **Tests:** 8 new Vitest cases; lint, typecheck and `npm run test` pass (632). Browser: the fresh account showed prev disabled, next → `/plan?start=2026-11-30`, the card went from "₱25,000 expected" to "· Electricity due" after adding a bill, and stayed the same once the next arrow opened that period; the main account's previous arrow opens Oct 30 on the Plan and its card read "Meralco and Travel due"; phones show the link, not the card.
- **AI notes:** Nothing went wrong this time; the card's numbers match before and after the period is opened.
- **Next:** 7e, check Savings and Debts against their specs.

## 2026-11-26 · Week 7 · 7d-1 follow-up: when "Create a savings pot" ticks
- **What:** The step now ticks once any pot has money in it or a target. Every account gets two empty starter pots at sign-up (Emergency Fund, Sinking Funds), so it used to be ticked on day one. The unticked step goes to Savings (to fill those pots in) instead of the add-pot sheet. One fewer query: it uses the pots the Dashboard already loads.
- **Files:** src/lib/checklist.ts, src/app/(app)/dashboard/page.tsx, src/components/dashboard/get-started-card.tsx, tests/lib/checklist.test.ts, docs/week-7-tasks.md
- **Decisions:** `potStarted()` (owner, Nov 26: "Ok"). The starter pots themselves are unchanged.
- **Tests:** 3 new Vitest cases; lint, typecheck and `npm run test` pass (624). Browser on the fresh account: 2 of 5 with only the empty starter pots, 3 of 5 after adding ₱500 to Emergency Fund.
- **Next:** 7d-2, the period arrows and Next period.

## 2026-11-26 · Week 7 · 7d-1 Dashboard: first-day state
- **What:**
  - **Get started:** a sticker card with "3 of 5 done", an 8px bar and an `<ol>` of five link rows (tick or dashed ring). Undone steps go to their task: Add income filled in with the first source, `/bills?add=1`, `/savings?add=1`, Add expense. Done ones go to where the thing lives. Dismiss with an Undo toast.
    - Phones: under the Cash card. Desktop: above the stat row, with "A few minutes now makes every payday easier."
  - **Empty cards:** one shared `EmptyCard` (dashed, mascot, title, sentence, soft button) for Due this period, Recent activity and, on desktop, "No pots yet".
  - **First period:** "Your first payday period · Day 12 of 15"; with nothing logged or planned, Safe to spend reads "Your starting balance. Nothing planned yet."
- **Files:** src/lib/checklist.ts (new), src/lib/checklist-cookie.ts (new), src/lib/periods.ts, src/app/(app)/dashboard/actions.ts (new), src/app/(app)/dashboard/page.tsx, src/components/dashboard/get-started-card.tsx (new), empty-card.tsx (new), cash-card.tsx, due-card.tsx, pots-card.tsx, recent-activity.tsx, tests/lib/checklist.test.ts (new), tests/lib/periods.test.ts, docs/week-7-tasks.md
- **Decisions (owner, Nov 26):**
  - 7d split into 7d-1 (this) and 7d-2 (arrows, Next period).
  - Dismiss is a cookie holding the budget's id: no migration, per browser, and another account on the same browser still sees its own card.
  - The card shows in any period until all five steps are done or it's dismissed.
  - The h1 stays "Your payday at a glance" (it renders before the data loads).
- **Tests:** 7 new Vitest cases; lint, typecheck and `npm run test` pass. Browser on a fresh local account: 2 of 5 → 3 of 5 after logging an expense from its step; Dismiss hides it, Undo brings it back, a dismissed card stays gone after reload; the empty Due and Recent cards; phone and desktop placements.
- **AI notes:** My first browser script reloaded before the second Dismiss finished (it matched the old toast) and looked like a bug; waiting for the card to go fixed the script, not the code. Dropped the strikethrough on done steps (not in the spec, harder to read).
- **Open:** onboarding's starter pots tick "Create a savings pot" on day one (open question 5).
- **Next:** 7d-2, the period arrows and Next period.

## 2026-11-26 · Week 7 · 7c Dashboard: desktop layout
- **What:**
  - **Stat row** (1024px and up, replacing the Cash card):
    - Safe to spend (the sticker) with "₱1,355 a day for 10 days"
    - Money out so far with a bar and "32% of ₱30,000"
    - This period's money: "₱25,000 income + ₱5,000 carried in" (+ "from savings" for withdrawals)
    - Still due: "1 bill, 1 debt, 1 savings transfer"
  - **Main column:** Due this period with "Due Nov 22 · in 2 days", "₱4,000 left after this" on debts, a Paid tag and "Open plan"; Spending vs plan with "₱4,750 of ₱9,500"; Recent activity as a table of the last five, then All transactions.
  - **Side column:** Savings pots (Manage, "₱13,000 / ₱30,000", "+₱3,000 this period" or "₱2,000 planned this period", locked pots in one compact row), the 50/30/20 check, Income.
  - **Pay prompt:** a Forest banner above the stat row on desktop; still inside the Cash card on phones (shared `PayPrompt`).
- **Files:** src/lib/plan.ts, src/lib/pots.ts, src/lib/debts.ts, src/lib/money.ts, src/lib/plan-periods.ts, src/components/dashboard/stat-row.tsx (new), cash-card.tsx, due-card.tsx, spending-card.tsx, pots-card.tsx, recent-activity.tsx, src/components/activity/activity-list.tsx, src/app/(app)/dashboard/page.tsx, tests/lib/{plan,pots,debts,money}.test.ts, docs/week-7-tasks.md
- **Decisions:**
  - "Left after this" = the debt's balance after this payment, debt rows only (owner, Nov 26).
  - The Spending total covers every spending line (budgets and starter lines), like the Plan, not just the three shown.
  - Desktop uses a grid whose side column spans every row (last row `1fr`), so the DOM, and so the phone order and tab order, stays Cash, Due, Spending, Pots, 50/30/20, Income, Recent.
  - Below 1280px the stat row is 2 × 2 (auto-fit wrapped 3 + 1) and the table drops its Category column so amounts fit. From 1280px it follows the spec.
  - The Next period card moves to 7d with the mobile link.
- **Tests:** 19 new Vitest cases; lint, typecheck and `npm run test` pass. Browser on local Supabase: an expense moved Money out, Safe to spend and the Spending total; a ₱500 deposit showed "+₱X this period"; the table opens Edit transaction; no sideways scroll at 1024, 1280 or 1440px; phones unchanged (Cash card, four recent rows).
- **AI notes:** First 1024px pass cut off the table's Amount column; fixed by hiding Category below `xl`. The test account had no unpaid items, so "in N days" and "left after this" were checked by unit tests only.
- **Next:** 7d, the first-day state, period switcher arrows and Next period.

## 2026-11-26 · Week 7 · 7b Dashboard: the 50/30/20 check
- **What:**
  - **`spentSplit()`:** money out so far by group, on the same base as the Dashboard's "₱X out so far".
    - Expenses and debt payments count by their category's group: Debt payment is Needs, Extra debt payment is Savings & debt payoff.
    - Net transfers to pots count as Savings & debt payoff.
    - Each group gets its share, its target and a comparison in words: "19 pts over 50%", "1 pt over 50%", "above 20%", "target 30%".
  - **The card:**
    - a 14px stacked bar, rows with "Target 50%" (mobile) or the comparison (desktop), and the footnote
    - hidden until money out reaches ₱1,000
    - placed after Savings pots
- **Files:**
  - New: `src/components/dashboard/split-card.tsx`.
  - Edited:
    - `src/lib/money.ts`
    - `tests/lib/money.test.ts`
    - `src/app/(app)/dashboard/page.tsx`: `category_id` on period rows, `budget_group` on categories
    - `docs/week-7-tasks.md`
- **Decisions (owner, Nov 26, Claude's recommendation):** debt payments count by their category.
- **Tests:** written first, 7 new unit tests (595 pass), including a check that the base equals `dashboardNumbers()`' money out. Lint, typecheck and the build pass. Checked in a browser with Playwright on local Supabase:
  - money out ₱16,455: Needs ₱8,455 (Groceries + Netflix + SPayLater) = 51%, Savings & debt payoff 49%
  - mobile showed "Target 50%"; desktop showed "1 pt over 50%" and "above 20%"
  - no console errors
- **AI notes:** the browser showed "1 pts over 50%". Claude fixed the singular, with a test.
- **Next:** 7c, the Dashboard's desktop layout.

## 2026-11-26 · Week 7 · 7a Dashboard: Spending and Savings pots
- **What:**
  - **Spending:** the three category budgets with the biggest planned amounts. Each shows "₱3,880 / ₱3,300", the Plan's bar and "₱580 over", plus a "Plan" link.
  - **Savings pots:** a card per pot with its balance, an 8px bar and "17% of ₱3,000". Without a target, "No target"; a locked pot shows a lock, a full line-dash bar and "Locked savings". They scroll sideways on phones, with "See all".
  - **Both stay hidden** when there's nothing to show.
- **Files:**
  - New: `src/components/dashboard/spending-card.tsx`, `pots-card.tsx`.
  - Edited:
    - `src/lib/plan.ts`: `topBudgets()`
    - `src/lib/pots.ts`: `potCardLine()`
    - `tests/lib/plan.test.ts`, `tests/lib/pots.test.ts`
    - `src/lib/plan-periods.ts`: `openCurrentPlan` items get `category_id`, `spent` and `bar`
    - `src/app/(app)/dashboard/page.tsx`
    - `docs/week-7-tasks.md`
- **Decisions (owner, Nov 26):**
  - The Spending card shows the three biggest planned budgets.
  - Starter lines stay on the Plan.
- **Tests:** written first, 6 new unit tests (589 pass), and 292 database tests pass. Lint, typecheck and the build pass. Checked in a browser with Playwright on local Supabase:
  - Groceries went from ₱3,680 to ₱3,880 against ₱3,300 after a ₱200 expense
  - Sinking Funds went from ₱0 to ₱1,000 after a deposit
  - the pots scroll sideways
  - with a temporary target and lock: "17% of ₱3,000" and "Locked savings"
  - no console errors
- **Next:** 7b, the 50/30/20 check.

## 2026-11-26 · Week 6 · 6i Live check (Week 6 done)
- **What:** the owner checked Week 6 on the live site (`358adf4`). The checklist covered the payday screen, Safe to spend and Due this period, Mark paid and Undo, spending bars, the Transfer tab, Mark paid and Pay extra on Debts, and Give leftover a job. All fine ("tick it").
- **Files:** `docs/week-6-tasks.md` (6i ticked), `docs/mvp-brief.md` (Week 6's checkboxes ticked), `docs/dev-log.md`.
- **Decisions:** none.
- **Tests:** at `358adf4`, 583 unit and 292 database tests pass. Lint, typecheck and the build pass. Week 6's one migration (6a) is live.
- **Known, carried forward:**
  - a debt payment cleared by extras reads "paid from Jan 15 payday"
  - "₱575 of ₱549 paid" when a group is paid above plan
  - the Due row's detail is cut short beside the pill on a 390px phone
  - a closed period with nothing planned still shows the empty-plan card
  - the Dashboard's desktop stat row, pot progress and 50/30/20 are Week 7
- **Next:** Week 7, savings, debts and the dashboard.

## 2026-11-26 · Week 6 · 6h-2 The payday screen
- **What:** `/payday?start=<the period that ended>` (payday-rollover.md). The Dashboard and the Plan redirect there when 6h-1 leaves a period waiting. The screen has:
  - **The header:** the mascot, "IT'S PAYDAY", and "Nov 15 – 29 has started" (focused).
  - **"How Oct 30 – Nov 14 went"** (Closed): the leftover or "₱2,000 over", "₱1,000 used of ₱5,000", and up to three true wins.
  - **"What should happen to the ₱4,000?"**, with live effect lines: Carry, Move it to a pot, Pay off a debt early, Split it myself. When overspent: Carry, or Cover it from a pot, with a pot picker. ₱0 left over: no choices.
  - **"Your new period is ready":** money in, carried in, money for the period, what's already planned, and Not assigned yet. These update with the choice.
  - **Both buttons confirm** (`closeWithChoice`):
    - the deposit, extra payment or withdrawal is dated the old period's last day
    - then `closePeriod()` records `carried_in` and the choice
    - a failed close undoes the transaction
    - Split goes on to Give leftover a job for the new period
  - **Old links** to a closed period go to the Dashboard.
- **Files:**
  - New:
    - `src/app/(app)/payday/page.tsx`
    - `src/components/payday/payday-screen.tsx`
  - Edited:
    - `src/lib/plan.ts`: `joinNames()`, `paydayWins()`, `leftoverChoices()`, `newPeriodMoney()`, `paydayPreview()`, `coverFromPot()`
    - `tests/lib/plan.test.ts`
    - `src/lib/plan-periods.ts`:
      - `closePeriod()`, taken out of `closeEndedPeriods()`
      - `awaiting` now has its start date
      - `loadPaydayData()`; pots know `locked`
    - `src/app/(app)/plan/actions.ts`: `closeWithChoice`
    - `src/app/(app)/dashboard/page.tsx`, `src/app/(app)/plan/page.tsx` (the redirect)
    - `tests/db/close-periods.test.ts`
    - `docs/week-6-tasks.md`
- **Decisions (owner, Nov 26, Claude's recommendations):**
  - Split = Carry, then Give leftover a job on the new period.
  - Move to a pot moves the whole leftover.
  - "on time" only when it's true.
  - The pot and debt follow 6f's rule.
- **Tests:** written first, 11 new unit tests (583 pass) and 2 new database tests for closing with a choice's transaction (292 pass). Lint, typecheck and the build pass. Checked in a browser with Playwright on local Supabase (the test user's Oct 30 – Nov 14 reopened):
  - the Dashboard redirected, with focus on the h1
  - ₱4,000 left over gave four options; the new-period card went from ₱29,000 to ₱25,000 when the debt was picked
  - Pay off Tita Ana early saved ₱4,000 dated Nov 14 and closed with "debt", carrying ₱0
  - ₱0 left over showed no choices, and Review my plan closed with Carry
  - overspent (₱2,000 over): Cover from Emergency Fund ₱500 said "₱1,500 still comes out"; Carry left Nov 15 carrying −₱2,000
  - the old link went to the Dashboard
  - no console errors
- **AI notes:** the browser script waited for `/`, but the root page forwards to `/dashboard`. The app was right.
- **Next:** 6i, the Week 6 live check.

## 2026-11-26 · Week 6 · 6h-1 Closing a period
- **What:** Dashboard and Plan visits close every period that has ended (payday-rollover.md §1), oldest first.
  - **Each one:** the next period (created if needed) gets `carried_in` = the leftover (6g's `carryOver()`, a record), then the period gets `closed_at` and `leftover_choice = "carry"`.
  - **With Ask on payday on,** the most recent ended period waits for the payday screen (6h-2). Its own `carried_in` is recorded.
  - **Running it twice** changes nothing.
  - **On the Plan,** a closed period shows "Closed · This period is closed, so its plan can't change." It was already read-only.
  - **A closing failure** is logged and never breaks the page.
- **Files:**
  - New: `tests/db/close-periods.test.ts`.
  - Edited:
    - `src/lib/plan.ts`: `periodsToClose()`
    - `tests/lib/plan.test.ts`
    - `src/lib/plan-periods.ts`: `closeEndedPeriods()`, `closeEndedPeriodsOnVisit()`
    - `src/app/(app)/dashboard/page.tsx`, `src/app/(app)/plan/page.tsx`
    - `docs/week-6-tasks.md`
- **Decisions (owner, Nov 26, Claude's recommendations):**
  - Closing runs on Dashboard and Plan visits.
  - Transactions in closed periods stay editable.
  - `carried_in` is a record only.
- **Tests:** written first, 4 new unit tests (572 pass) and 5 new database tests (290 pass). Lint, typecheck and the build pass.
  - The database tests cover the "Done when": three periods with transactions (₱3,000 opening; ₱8,000 left, then −₱3,000, then ₱0) close in order with the right `carried_in`.
  - They also cover: the latest waits with ask on and closes with ask off (creating Feb 28 – Mar 14); a second run changes nothing; nothing closes before it ends; user B can't close A's periods.
  - In a browser, with two earlier periods added to the test user:
    - ask on: Oct 15 closed, and Oct 30 waited (carrying ₱5,000)
    - ask off: Oct 30 closed, Nov 15 carried ₱4,000 (after a ₱1,000 expense), and Oct 30's Plan showed Closed with no edit links
    - no console errors
- **Known:** a closed period with nothing planned still shows the empty-plan card (from 5d).
- **AI notes:** Claude's database test first expected the next period on Mar 1. In 2027 the 30th payday falls on Feb 28, so the code was right and the test was fixed.
- **Next:** 6h-2, the payday screen.

## 2026-11-26 · Week 6 · 6g Carry-over math
- **What:**
  - **`carryOver(carriedIn, rows)`:** a period's money, what it used, its leftover (below ₱0 when overspent) and the result (surplus, overspent or zero).
  - **`carryForward(openingBalance, periods)`:** chains it, so each period's carry-in is the last one's leftover, starting from the opening balance.
  - **It shares the Dashboard's rules:** it's built on `periodTotals()`, so it counts money exactly as the Dashboard does.
  - **The payday choices** (move to a pot, pay a debt early) are transactions on the old period's last day, so they lower what carries. Carry adds nothing.
- **Files:** `src/lib/plan.ts`, `tests/lib/plan.test.ts`, `docs/week-6-tasks.md`.
- **Decisions (owner, Nov 26, Claude's recommendations):**
  - An overspend carries in as a negative.
  - The budget's `carry_over` setting stays on, with no screen for it.
- **Tests:** written first, 7 new unit tests (568 pass):
  - surplus, overspend and zero
  - pot withdrawals and deposits
  - deleted rows don't count
  - the payday choices
  - three periods in a row (surplus → overspent → zero), with and without an opening balance
  - three periods checked against `dashboardNumbers()`: carry-in matches, and leftover equals cash now
  - Lint, typecheck and the build pass.
- **AI notes:** Claude's first three-period example was wrong (it expected ₱0 where −₱3,000 carries). Claude rewrote it so the numbers really give surplus, then overspent, then zero.
- **Next:** 6h-1, closing a period.

## 2026-11-26 · Week 6 · 6f Give leftover a job
- **What:** `/plan/assign?start=…` shares out Not assigned yet across pots and debts (plan.md §7).
  - **The Remaining card,** a sticker: some left (yellow), all assigned (Deep Green), or too much (danger), with a stacked bar.
  - **The presets:** Save it all, Debt first then save, Keep it all, Start over.
  - **One row per pot and active debt, plus Keep as buffer:**
    - a ₱500 stepper, or tap the amount to type it
    - the limits: a pot stops at target − balance − planned; a debt at owed − unpaid planned
    - the effect line: "Emergency Fund → ₱2,500", "₱8,000 left after this", "₱1,800 rolls into next period"
  - **The totals box and the button:** "Assign ₱3,000, keep ₱13,200", or a disabled "Remove ₱X to continue".
  - **Saving** adds one `assigned` item per destination (Savings pot or Extra debt payment). Then back to the Plan with "₱3,000 assigned · Undo".
  - **Entry points:**
    - mobile: "Assign the ₱16,200" on the summary card
    - desktop: the "Give ₱16,200 a job" side card, with Top up a pot, Pay extra on a debt, and Keep as buffer shortcuts that pre-fill a preset
- **Files:**
  - New:
    - `src/app/(app)/plan/assign/page.tsx`
    - `src/components/plan/assign-form.tsx`, `give-job-card.tsx`
  - Edited:
    - `src/lib/plan.ts`: the assign functions
    - `tests/lib/plan.test.ts`
    - `src/lib/validation/plan-item.ts`: `assignSchema`
    - `tests/lib/validation/plan-item.test.ts`
    - `src/lib/plan-periods.ts`: `loadAssignData()`, `assignTargets()`
    - `src/app/(app)/plan/actions.ts`: `assignLeftover`, `undoAssign`
    - `src/components/plan/plan-summary.tsx`, `src/app/(app)/plan/page.tsx`
    - `docs/week-6-tasks.md`
- **Decisions (owner, Nov 26, Claude's recommendations):**
  - The presets' pot is the first pot with a target that isn't full; their debt is the earliest active debt with room.
  - Each assign adds new items.
  - The caps are as above.
  - It works for the current and future periods.
- **Tests:** written first, 15 new unit tests (561 pass), and 285 database tests pass. Lint, typecheck and the build pass. Checked in a browser with Playwright on local Supabase (Nov 30, ₱16,200 to assign):
  - Save it all and Start over
  - Tita Ana +₱1,000 and Emergency Fund typed ₱2,000 gave "Assign ₱3,000, keep ₱13,200"
  - SPayLater showed "₱0 max" (its Dec 15 payment is already planned)
  - too much disabled the button
  - assigning took Not assigned from ₱16,200 to ₱13,200, and the items showed as "Extra to savings" and "Extra payment"
  - Undo on a ₱500 assign restored it
  - the desktop Pay extra shortcut pre-filled Debt first
  - no console errors
- **AI notes:** Next 16 keeps the previous page mounted but hidden, so the browser script needed visible-only selectors.
- **Next:** 6g, carry-over math.

## 2026-11-26 · Week 6 · 6e Planned vs actual on the Plan
- **What:**
  - **Spending budgets and starter lines:** "₱3,180 / ₱3,300", an 8px bar (green, gold from 90%, red over 100%), and "₱120 left" or "₱380 over".
    - A starter line's spending is its group's categories that have no budget of their own.
    - Payments made through a plan item don't count against a category budget.
  - **Group headings:** "₱575 of ₱549 paid", "₱3,680 of ₱25,800 spent".
  - **The desktop table:** ACTUAL (paid or spent, or "—") and STATUS: Paid Nov 26, Late · 1 day, Due Nov 22, Planned, the budget's "₱380 over", and Received or Expected for income.
  - **The category picker's tiles:** "₱2,760 left" or "₱380 over".
  - **Future periods:** planned amounts only.
- **Files:**
  - `src/lib/plan.ts`: `spendingActuals()`, `budgetBar()`, `groupProgress()`, `itemStatus()`
  - `tests/lib/plan.test.ts`
  - `src/lib/plan-periods.ts`:
    - rows get `dueOn`, `actual`, `bar` and `status`; the plan gets `progress`
    - the period's transactions load `category_id` and `plan_item_id`
  - `src/components/plan/plan-groups.tsx`, `plan-table.tsx`, `src/app/(app)/plan/page.tsx`
  - `src/components/transactions/category-grid.tsx` (the tile `note`), `category-picker.tsx`, `expense-form.tsx`, `src/components/plan/plan-category.tsx`
  - `docs/week-6-tasks.md`
- **Decisions (owner, Nov 26, Claude's recommendations):**
  - Plan-item payments stay out of category budgets.
  - Future periods show planned amounts only.
  - STATUS is a tag.
- **Tests:** written first, 7 new unit tests (546 pass), and 285 database tests pass. Lint, typecheck and the build pass. Checked in a browser with Playwright on local Supabase:
  - Groceries ₱180 → ₱3,180 ("₱120 left", gold) → ₱3,680 ("₱380 over", red)
  - the picker tile said "₱380 over"
  - headings showed actual of planned
  - the desktop columns filled in
  - Nov 30 showed planned only
  - no console errors
- **Next:** 6f, Give leftover a job.

## 2026-11-26 · Week 6 · Extra debt payments lower the last payments first
- **What:** fixes the 6d-2 open question. Extra payments (Extra debt payment category) now shrink a debt's schedule from the last payment (debts.md §5), and scheduled payments still fill it from the oldest.
  - **Where it shows:** the Debts page (schedule, statuses, next payment, Debt-free by), the More page's debt line, and plan generation (`debtAmount`), which the sync then applies to open periods.
  - **The debt-free date** moves earlier when extras clear whole payments.
  - **What's left** doesn't change.
- **Files:**
  - `src/lib/debts.ts`:
    - `reducedSchedule()`, `debtPaidByKind()`, `debtPaidFor()`
    - `debtProgress()` takes `extraPaid`; `debtsSummary()` passes it
  - `src/lib/plan.ts`: `debtAmount`; sources' debts get `extraPaid`
  - `tests/lib/debts.test.ts`, `tests/lib/plan.test.ts`
  - the payment loads, now with `category:categories(system_key)`, in `src/lib/plan-periods.ts`, `src/app/(app)/debts/page.tsx` and `src/app/(app)/more/money-section.tsx`
  - `docs/week-6-tasks.md`
- **Decisions (owner, Nov 26, Claude's recommendation):** a payment cleared by extras shows as Paid at ₱0. There's no new status.
- **Tests:** written first, 7 new unit tests (539 pass), and 285 database tests pass. Lint, typecheck and the build pass. Checked in a browser with Playwright on local Supabase:
  - with a ₱2,000 extra on SPayLater, payment 1 stayed ₱4,000 (Late), payment 3 showed ₱2,000, and the Plan's Nov 15 item synced back to ₱4,000
  - paying ₱6,000 (₱4,000 due + ₱2,000 extra) cleared payment 3 (₱0, Paid), and Debt-free by went from Jan 25 to Dec 25
  - no console errors
- **Known:** a payment cleared by extras reads "Jan 25 · paid from Jan 15 payday". Better copy could be "cleared early".
- **Next:** 6e, planned vs actual on the Plan.

## 2026-11-26 · Week 6 · 6d-2 To a debt and Pay extra
- **What:**
  - **To a debt,** the Transfer tab's fourth option:
    - "Which debt?" lists active debts with "₱12,000 left", and "Due ₱4,000" when a scheduled payment is unpaid this period
    - the money pays that scheduled payment first, through `mark_plan_item_paid` (Debt payment, Needs)
    - the rest is an extra payment (Extra debt payment, Savings & debt payoff), which ticks a planned extra if there is one
    - the impact line reads "SPayLater: ₱12,000 → ₱6,000 left. Pays the ₱4,000 due Nov 25, plus ₱2,000 extra (Savings & debt payoff)."
    - more than what's left is refused
    - Undo removes every part
  - **Pay extra** on each active debt opens the sheet with that debt picked.
  - **Four options** show as a 2×2 grid on phones.
- **Files:**
  - `src/lib/debts.ts`: `debtPaymentSplit()`
  - `tests/lib/debts.test.ts`
  - `src/lib/validation/transaction.ts`: `debt`, `debtId`
  - `tests/lib/validation/transaction.test.ts`
  - `src/app/(app)/activity/actions.ts`: `loadSheetDebts()`, `payDebt()`
  - `src/components/transactions/savings-form.tsx`
  - `src/components/segmented.tsx`: `wrap`
  - `src/components/transactions/add-transaction-provider.tsx`
  - `src/app/(app)/debts/page.tsx`
  - `docs/week-6-tasks.md`
- **Decisions (owner, Nov 26, Claude's recommendations):**
  - Above the scheduled amount, the payment is split.
  - Below it, it still ticks the payment off.
  - Pay extra opens the same sheet.
  - Four options use a 2×2 grid on phones.
- **Tests:** written first, 4 new unit tests (532 pass), and 285 database tests pass. Lint, typecheck and the build pass. Checked in a browser with Playwright on local Supabase:
  - ₱6,000 on SPayLater (₱4,000 due Nov 25): ₱12,000 → ₱6,000 left, the Plan showed "Paid Nov 26", and Activity had −₱4,000 and −₱2,000
  - a ₱5,000 payment plus Undo removed both parts
  - ₱99,999 was refused ("Only ₱10,000 left")
  - Pay extra on Tita Ana: ₱10,000 → ₱9,000
  - no console errors
- **Open question:** payments fill the oldest scheduled payment first, in `debtProgress()` (Debts page) and `debtAmount` (plan generation), both from Weeks 4–5. debts.md §5 says extra payments "lower the last payments first, so the debt-free date can move earlier."
  - **What it looks like now:** after a ₱2,000 extra on SPayLater, the next scheduled payment showed ₱2,000 instead of ₱4,000. The last payment didn't shrink.
  - **Fixing it** means telling extra payments apart from scheduled ones in both functions (by category). That's a separate task: owner's call.
- **Next:** 6e, planned vs actual on the Plan. Or first, the extra-payment fix if the owner wants it.

## 2026-11-26 · Week 6 · 6d-1 The Transfer tab (pots)
- **What:** the add sheet's Savings tab is now **Transfer**: **To a pot**, **From a pot**, **Pot to pot**.
  - **To a pot:**
    - a pot with an unpaid planned deposit this period shows "Planned ₱2,000", plus the line "This also ticks off the ₱2,000 planned for this period."
    - saving goes through `mark_plan_item_paid` (6a), so the deposit is linked and the item ticked in one step
    - Undo deletes it, and the item is due again
  - **Pot to pot:**
    - From and To pots, with "Travel ₱2,000 → ₱1,000 · Emergency Fund ₱0 → ₱1,000. Your cash stays the same."
    - saves a withdrawal and a deposit in one insert
    - "Moved ₱1,000 from Travel to Emergency Fund · Undo" removes both
    - a locked From pot and more than its balance are refused
  - **Editing** a savings row offers To a pot and From a pot only.
- **Files:**
  - `src/lib/pots.ts`: `potTransfer()`
  - `tests/lib/pots.test.ts`
  - `src/lib/validation/transaction.ts`: `move`, `toPotId`
  - `tests/lib/validation/transaction.test.ts`
  - `src/app/(app)/activity/actions.ts`: pots' `planned`, `writeSavings`, `undoTransfer`
  - `src/components/transactions/savings-form.tsx`, `type-tabs.tsx`, `add-transaction-provider.tsx`
  - `docs/week-6-tasks.md`
- **Decisions (owner, Nov 26, Claude's recommendations):**
  - Any amount ticks off the planned item.
  - Pot to pot ticks nothing off.
  - There's no link column between a move's two rows.
  - The four-option layout waits for 6d-2.
- **Tests:** written first, 3 new unit tests (528 pass), and 285 database tests pass. Lint, typecheck and the build pass. Checked in a browser with Playwright on local Supabase:
  - Travel showed "Planned ₱2,000"; a ₱2,000 deposit ticked it ("Paid Nov 26")
  - Undo of a ticked deposit made it due again
  - moving ₱1,000 Travel → Emergency Fund, then Undo, worked
  - moving ₱500 left cash now at −₱1,755, and Activity showed +₱500 and −₱500
  - no console errors
- **AI notes:** a long inline shell script broke on quoting, so Claude ran the form edit from a script file. Claude's first browser script typed the amount before the field had focus.
- **Next:** 6d-2, To a debt and Pay extra.

## 2026-11-26 · Week 6 · 6c Safe to spend and Due this period
- **What:**
  - **Safe to spend replaces Cash now as the Dashboard hero:**
    - the amount, with a per-day pill ("₱1,355 / day"), or "Over by ₱X" when it's below ₱0
    - "After ₱X in bills, savings and debts still due this period."
    - Carry-in · Income · Cash now below
  - **A Due this period card:**
    - unpaid bills, debt payments, savings and one-offs by due date, then paid ones, at most five
    - each row has Mark paid (Add to pot for savings), and the row opens the item on the Plan
    - the empty card says "No bills or debts yet"
  - **Opening the current period:** the Dashboard opens and syncs it like the Plan.
- **Files:**
  - New: `src/components/dashboard/due-card.tsx`.
  - Edited:
    - `src/lib/money.ts`: `stillDueTotal()`, `safeToSpend()`, `perDay()`
    - `tests/lib/money.test.ts`
    - `src/lib/plan.ts`: `itemDueOn()`, `dueList()`
    - `tests/lib/plan.test.ts`
    - `src/lib/plan-periods.ts`: `openCurrentPlan` items get `section`, `tickable`, `dueOn` and `varies`
    - `src/components/dashboard/cash-card.tsx`
    - `src/app/(app)/dashboard/page.tsx`
    - `docs/week-6-tasks.md`
- **Decisions (owner, Nov 26, Claude's recommendations):**
  - Unpaid one-offs count in Still due.
  - Per day rounds down to whole pesos.
  - Variable bills ask for the amount.
  - The desktop stat row waits for Week 7.
- **Tests:** written first, 9 new unit tests (525 pass), and 285 database tests pass. Lint, typecheck and the build pass. Checked in a browser with Playwright on local Supabase:
  - cash now ₱2,245 − still due ₱4,000 = Safe to spend −₱1,755, with "Over by ₱1,755" (Main job's pay wasn't logged yet)
  - Mark paid on SPayLater from the Due list: still due ₱4,000 → ₱0, cash now ₱2,245 → −₱1,755, Safe to spend unchanged, and the row moved down as "Paid Nov 26"
  - no console errors
- **Week 6 "Done when":** marking an item paid updates the Dashboard. ✅
- **Known:** on a 390px phone, a Due row's detail ("Debt · Due No…") is cut short beside the pill.
- **Next:** 6d-1, the Transfer tab for pots.

## 2026-11-26 · Week 6 · 6b-2 Mark paid on Bills and Debts
- **What:**
  - **Bills:**
    - each row with an unpaid item this period has a **Mark paid** pill (a variable bill asks for the amount)
    - a paid row's tag says "Paid Nov 26"
    - desktop has a **Paid this period** stat card, from the actual payments
  - **Debts:** the next-payment strip ("Next: ₱4,000 due Nov 25", or "Late: …") has **Mark paid**, or **Mark Nov 25 paid** on desktop, when that payment's plan item is unpaid in a period that has started and isn't closed.
  - **One app-wide toast:** the add sheet's provider exposes `showToast` (`useAppToast()`). The Plan's own toast is gone, so every Undo toast shows in one place and survives page changes.
  - **`useMarkPaid` hook:** the Mark paid logic moved into it, shared by the Plan's circle and the new pill.
- **Files:**
  - `src/lib/plan.ts`: `paidThisPeriod()`, `billRowStatus()`, `debtItemToPay()`
  - `tests/lib/plan.test.ts`
  - `src/lib/plan-periods.ts`: `openCurrentPlan` returns paid items with their payment; `payableDebtItems()`
  - `src/components/transactions/add-transaction-provider.tsx`: `showToast`, `useAppToast()`
  - `src/app/(app)/plan/plan-item-sheet.tsx`: uses the app toast
  - `src/components/plan/tick-button.tsx`: `useMarkPaid`, `TickButton`, `MarkPaidPill`
  - `src/app/(app)/bills/page.tsx`, `debts/page.tsx`, `savings/page.tsx`
  - `docs/week-6-tasks.md`
- **Decisions (owner, Nov 26, Claude's recommendations):**
  - There's one app-wide toast.
  - The Mark paid pill shows on mobile Bills rows too.
  - Bills and Debts only tick.
- **Tests:** written first, 5 new unit tests (516 pass), and 285 database tests pass. Lint, typecheck and the build pass. Checked in a browser with Playwright on local Supabase:
  - SPayLater (3 × ₱4,000, first due Nov 25, so Late) was paid from Debts: ₱8,000 left, the next payment moved to Dec 25, and the Plan showed "Paid Nov 26"
  - Undo from the Debts toast put it back
  - Netflix (variable) was paid from Bills at ₱575: tag "Paid Nov 26", and desktop Paid this period ₱575
  - the Plan's remove + Undo works on the app toast
  - 5f's checks still pass
  - no console errors
- **Next:** 6c, Safe to spend and Due this period on the Dashboard.

## 2026-11-26 · Week 6 · 6b-1 Mark paid on the Plan
- **What:**
  - **Tick circles are buttons** on bills, debt payments, savings and one-offs, on mobile rows and in the desktop table ("Mark Netflix paid", "Mark Travel added").
    - A fixed amount pays in one tap, with "Netflix paid · Undo" or "Added ₱2,000 to Travel · Undo".
    - A variable bill asks "How much was Netflix?" first, filled in with the estimate.
  - **Paid rows** show a solid green circle and "Paid Nov 26", the payment's date.
  - **Tapping a paid circle** un-ticks it: "Netflix is due again · Undo", and Undo restores the same payment.
  - **Dates:** today in the current period, or the last day of an earlier period that hasn't closed. Future periods' circles aren't buttons.
  - **Removing:** paid items can't be removed ("delete its payment in Activity first"), and the server refuses it too.
- **Files:**
  - New: `src/components/plan/tick-button.tsx`.
  - Edited:
    - `src/lib/plan.ts`: `paidOnDate()`, `isTickable()`
    - `tests/lib/plan.test.ts`
    - `src/lib/plan-periods.ts`:
      - each row gets `tickable`, `paidOn` and `varies`; the plan gets `payOn`
      - one query for the period's payments
      - bills load `amount_varies`
    - `src/app/(app)/plan/actions.ts`: `markPaid`, `unmarkPaid`, the shared `loadPayable()`, and the paid check in `removePlanItem`
    - `plan-groups.tsx`, `plan-table.tsx`, `plan-item-form.tsx`, `page.tsx`
    - `docs/week-6-tasks.md`
- **Decisions (owner, Nov 26, Claude's recommendations):**
  - 6b is split into 6b-1 (the Plan) and 6b-2 (Bills and Debts).
  - Future periods can't be ticked.
  - Un-ticking has no dialog, only Undo.
  - Variable bills ask for the real amount.
- **Tests:** written first, 5 new unit tests (511 pass), and 285 database tests pass. Lint, typecheck and the build pass. Checked in a browser with Playwright on local Supabase:
  - ticking Netflix showed "Paid Nov 26", and Bills went to ₱0 still due
  - un-tick + Undo, and pay + Undo, both worked
  - Travel's tick cleared the Savings due line
  - a paid item offered no Remove
  - a variable Netflix paid ₱620 showed in Activity
  - Nov 30 had no tick buttons
  - the desktop table had them
  - no console errors
- **AI notes:** `unmarkPaid` first reused `loadItem()`, which refuses ended periods. Claude moved both actions onto a shared `loadPayable()`, so un-ticking works wherever ticking does.
- **Next:** 6b-2, Mark paid on Bills and Debts.

## 2026-11-26 · Week 6 · 6a Mark paid migration
- **What:**
  - **`mark_plan_item_paid(item, paid_on, amount)`**, a SQL function that runs as the caller. It creates the transaction that pays a plan item and sets `paid_at`, all in one step, and returns the transaction's id:
    - a pot becomes a savings deposit
    - a debt becomes a `debt_payment` (Debt payment, or Extra debt payment for extras)
    - a bill or one-off becomes an expense
    - the transaction is always in the item's own category, with `plan_item_id`
  - **Refused:** missing, removed or someone else's items (P0002); income, spending budgets, starter lines and ₱0 (22023); already paid or a closed period (55000); a date outside the period (23514, the existing trigger).
  - **A trigger on transactions:** soft-deleting the payment clears `paid_at` (unless another live payment still covers the item), and restoring it sets `paid_at` again.
  - **New grants:** `paid_at` updates on plan items, and `plan_item_id` inserts on transactions.
- **Files:**
  - New:
    - `supabase/migrations/20261126120000_mark_plan_item_paid.sql`
    - `tests/db/mark-paid.test.ts`
  - Edited:
    - `tests/db/plan-items.test.ts`: two 5a permission tests now match 6a
    - `src/lib/supabase/types.ts`: the function's type, added by hand
    - `docs/week-6-tasks.md`
- **Decisions (owner, Nov 26, Claude's recommendations):**
  - Undo uses the existing soft delete plus the trigger. There's no unmark function.
  - The function runs as the caller with two column grants, not with elevated rights.
- **Tests:** written first, 11 new database tests (285 pass), and 506 unit tests. Lint and typecheck pass.
- **AI notes:**
  - `supabase gen types --local` reformatted the whole types file (a diff of over 1,000 lines). Claude reverted it and added the 4 lines by hand. Regenerate from the live project once the migration is live.
  - Claude's first version of the updated link test passed a row where an id was needed. Fixed.
- **Live:** pushed Nov 26 (dry run first, owner's go). Types generated from the live project match the hand-added lines.
- **Next:** 6b, Mark paid in the app.

## 2026-11-26 · Week 5 · 5i Live check (Week 5 done)
- **What:** the owner checked Week 5 on the live site (`89e6d34`): the Plan for this and next payday, a period three months ahead, one-offs, budgets, debt payments, edit/remove/Undo, the bill sync, the budget line and Bills/Savings. All fine ("tick it").
- **Files:** `docs/week-5-tasks.md` (5d and 5i ticked), `docs/mvp-brief.md` (Week 5's checkboxes ticked), `docs/dev-log.md`.
- **Decisions:** none.
- **Tests:** at `89e6d34`, 506 unit and 274 database tests pass. Lint, typecheck and the build pass. Both of today's migrations are live.
- **Known, for Week 6:**
  - Logging a payment doesn't tick its plan item yet, so "due" lines stay.
  - Future periods show "—" for carried in.
  - "₱2,760 left" on the category picker's tiles is still open.
- **Next:** Week 6, plan vs actual and carry-over.

## 2026-11-26 · Week 5 · 5h-3 Bills and Savings
- **What:**
  - **Bills:** the hero now says "2 recurring bills · ₱549 still due this period". On desktop, a "Still due this period" stat card shows the next bill ("Netflix · Nov 22").
  - **Savings:** YOUR POTS shows "Due this period: ₱2,000 to Travel". It names up to two pots, then "and N more".
  - **Delete bill and Delete pot:** both say "Planned in N upcoming paydays. Those plan items are removed; paid ones stay."
  - **Opening the current period:** Bills and Savings open it like the Plan does (create and sync) before reading its items.
- **Files:**
  - `src/lib/plan.ts`: `billDueInPeriod()` (taken out of `planItemDetail()`), `stillDue()`, `potsDueLine()`, `upcomingCounts()`, `upcomingLine()`
  - `tests/lib/plan.test.ts`
  - `src/lib/plan-periods.ts`: `openCurrentPlan()`, `upcomingItems()`
  - `src/app/(app)/bills/page.tsx`, `bill-sheet.tsx`
  - `src/app/(app)/savings/page.tsx`, `savings/details/page.tsx`
  - `src/components/savings/delete-pot.tsx`
  - `docs/week-5-tasks.md`
- **Decisions (owner, Nov 26, Claude's recommendations):**
  - The "due" lines show now, even though logging a payment won't tick items off until Week 6.
  - There's no "Paid this period" card until Mark paid exists.
  - Up to two pots are named in the Savings line.
  - Both pages open and sync the current period on view.
- **Tests:** written first, 10 new unit tests (506 pass), and 274 database tests pass. Lint, typecheck and the build pass. Checked in a browser with Playwright on local Supabase:
  - Bills went from ₱0 to ₱549 still due after adding Netflix (due the 22nd); the desktop card said "Netflix · Nov 22"
  - Delete Meralco said "Planned in 1 upcoming payday" (its Dec 30 item was removed earlier)
  - a new Travel pot at ₱2,000 each payday showed "Due this period: ₱2,000 to Travel"
  - Delete Travel said "Planned in 5 upcoming paydays"
  - no console errors
- **Next:** 5i, the live check: push, then plan the next three months on your phone.

## 2026-11-26 · Week 5 · 5h-2 The add sheet's budget line
- **What:** once a category is picked for an expense in the current period, Add expense's impact line shows that category's budget (activity.md §3):
  - "Groceries budget: ₱3,120 left after this."
  - "₱1,880 over your Groceries budget." (yellow)
  - "No Health budget yet. Set one in Plan to see what's left."
  - Before a category is picked, or for another period, it still says "Money out this period: …" or "Goes in …".
  - Editing an expense takes its old amount out of what's spent first.
- **Files:**
  - `src/lib/plan.ts`: `categoryBudgets()`, `budgetLeft()`
  - `tests/lib/plan.test.ts`
  - `src/app/(app)/activity/actions.ts`: `getAddSheetData` returns `budgets` (one more query for the period's budget items)
  - `src/components/transactions/sheet-impact.ts`: `budgetLine()`
  - `expense-form.tsx`
  - `docs/week-5-tasks.md`
- **Decisions (owner, Nov 26, Claude's recommendations):**
  - 5h is split further: 5h-2 is the budget line, and 5h-3 covers Bills and Savings.
  - The budget is this period's budget item. A removed one means no budget. With no item yet (the plan was never opened), it's the budget per payday.
  - Starter lines and one-offs don't count as a category's budget.
  - The picker tiles' "₱2,760 left" stays an open item.
- **Tests:** written first, 8 new unit tests (496 pass). Lint, typecheck and the build pass. Checked in a browser with Playwright on local Supabase, with Groceries at ₱3,300:
  - ₱180 → "₱3,120 left"; saved
  - then ₱200 → "₱2,920 left"
  - ₱5,000 → "₱1,880 over" in yellow
  - Health → "No Health budget yet"
  - editing the ₱180 expense to ₱250 → "₱3,050 left"
  - no console errors
- **AI notes:** Claude first subtracted an edited expense's old amount in `sheet-impact.ts`. It moved that into `budgetLeft()` with a test, so no money math lives in components.
- **Next:** 5h-3, Bills and Savings.

## 2026-11-26 · Week 5 · 5h-1 Keep plans in sync
- **What:** open periods (not ended) now follow their sources. Saving a bill, pot, income source or debt (including Mark paid off), a category with a budget per payday, or Set a budget "Every payday" runs `syncOpenPeriods()`, and so does opening a period. For each period, `planSync()` compares what `generatePlan()` makes now with what's there:
  - changed amounts and names are updated
  - new sources are added
  - items that no longer belong are taken out (soft delete), for example a bill moved to the other payday, a pot set to ₱0, an ended income source, or a cleared budget
  - items the sync took out come back if they belong again
  - only unpaid, unedited `recurring` items change; one-offs, starter items, extra debt payments and ended periods never do
- **Files:**
  - New:
    - `tests/db/plan-sync.test.ts`
    - `supabase/migrations/20261126110000_plan_items_removed_are_edited.sql`
  - Edited:
    - `src/lib/plan.ts`: `planSync()`
    - `tests/lib/plan.test.ts`
    - `src/lib/plan-periods.ts`: `syncOpenPeriods()`; `openPlanPeriod()` syncs instead of only adding
    - the save actions in `bills`, `savings`, `income`, `debts`, `settings/categories` and `plan`
    - `plan-item-sheet.tsx`: Undo passes back `edited`
    - `docs/week-5-tasks.md`
- **Decisions (owner, Nov 26, Claude's recommendations):**
  - 5h is split into 5h-1 (sync) and 5h-2 (plan data on other screens).
  - There's no "Update future paydays only?" question: changes go to the current and future open periods, unpaid and unedited items only.
  - Your removals are marked `edited`; the sync's own removals aren't. That tells them apart without a new column.
  - The one-time migration marks items already removed as edited, because before 5h only you removed items.
  - Edited items are fully frozen, name included.
  - A failed sync after a save is logged, not shown, and the period catches up on its next open.
- **Tests:** written first, 9 new unit tests (488 pass), and 4 new database tests that run the sync on local Supabase (274 pass). Lint, typecheck and the build pass. Checked in a browser with Playwright on local Supabase:
  - a new Meralco bill (₱2,500, due the 10th) showed in Nov 30 and Dec 30
  - changing it to ₱3,000 showed in both
  - a Meralco edited by hand to ₱2,800 on Nov 30 stayed there when the bill went to ₱3,500, while Dec 30 followed
  - a removed Meralco stayed removed
  - Groceries removed then Undone followed its budget change to ₱3,300, while Nov 30's "This period only" ₱4,000 stayed
  - no console errors
- **Live:** the migration was pushed Nov 26 (dry run first, owner's go), before the code.
- **Next:** 5h-2, plan data on other screens.

## 2026-11-26 · Week 5 · 5g-2 Debt payments and the Plan options menu
- **What:**
  - **Plan a debt payment** (`/plan?start=…&add=debt`):
    - **Fields:** Which debt? (active debts, including "When I can", with "₱10,000 left"), Amount, and the payday cards.
    - **Checks:** more than what's left is refused, on the form and on the server ("Only ₱10,000 left on Tita Ana.").
    - **Saves** a `one_off` item with `debt_id` and the Extra debt payment category, so it shows under DEBT PAYMENTS as "Extra payment" and counts as Savings & debt payoff.
    - **After saving:** you land on that period, with "Tita Ana payment planned · Undo".
    - **Opens from:** DEBT PAYMENTS (shown whenever there's an active debt) and the menu.
  - **Plan options menu** (Base UI Menu):
    - **Where:** in the mobile header, and beside Add one-off item on desktop.
    - **Items:** Set a budget, Plan a debt payment (with a debt), Use starter plan (while a starter group is missing and pay is expected), and Edit spending budgets (Settings › Categories).
  - **Shared:** 5f's payday cards, the per-period loader and the impact box moved to `payday-picker.tsx`, used by both sheets.
- **Files:**
  - New: `src/components/plan/debt-payment-form.tsx`, `payday-picker.tsx`, `plan-options-menu.tsx`.
  - Edited:
    - `src/lib/debts.ts`: `debtLeft()`
    - `src/lib/validation/plan-item.ts`: `debtPaymentSchema`
    - `src/lib/plan-periods.ts`: returns the active debts, ordered by when they were added
    - `src/app/(app)/plan/actions.ts`: `addDebtPayment`
    - `src/app/(app)/plan/plan-item-sheet.tsx`: the debt sheet and `useShowToast`
    - `page.tsx`
    - `src/components/plan/one-off-form.tsx`, `plan-groups.tsx` (`groupAddLink()`), `plan-table.tsx`
    - Tests: `tests/lib/debts.test.ts`, `tests/lib/validation/plan-item.test.ts`
    - `docs/week-5-tasks.md`
- **Decisions (owner, Nov 26, Claude's recommendations):**
  - The cap is what's left on the debt (total − paid), without subtracting payments planned in other periods.
  - The menu also has Plan a debt payment.
  - The empty plan's Debt payments row keeps "Add a debt".
  - Use starter plan in the menu has no Undo. Each item can be removed.
- **Tests:** written first, 4 new unit tests (479 pass), and 270 database tests pass. Lint, typecheck and the build pass. Checked in a browser with Playwright on local Supabase:
  - with no debts, the menu has no Plan a debt payment
  - added a "When I can" debt, Tita Ana ₱10,000; the menu then offers it, with the debt already picked
  - ₱12,000 was refused
  - ₱2,000 on Dec 15 (₱22,000 → ₱20,000) landed there as "Extra payment", next to the Groceries ₱3,000 budget; the split showed Savings & debt payoff 8%
  - the menu's Edit spending budgets and Set a budget work
  - 5f's checks still pass
  - no console errors
- **Next:** 5h, the wire-up.

## 2026-11-26 · Week 5 · 5g-1 Spending budgets
- **What:**
  - **Budget per payday** on New and Edit category. Its note says "₱3,000 added to every payday's plan, starting with this one." The category list shows "₱3,000 per payday".
  - **Set a budget sheet** (`/plan?start=…&add=budget`): Category, Amount, and Every payday or This period only.
    - The amount starts at the budget the category already has in this period.
    - The impact box reads "Not assigned yet: ₱7,500 → ₱4,500".
    - It opens from SPENDING BUDGETS (now shown even when empty), the desktop table, and the empty plan's Spending budgets row.
- **Files:**
  - New:
    - `src/components/plan/set-budget-form.tsx`
    - `src/components/plan/plan-category.tsx`: the category grid, picker and New category, now shared with Add one-off item
    - `supabase/migrations/20261126100000_plan_items_insert_edited.sql`
  - Edited:
    - `src/lib/plan.ts`: `budgetImpact()`
    - `src/lib/validation/category.ts`: `budgetPerPayday`
    - `src/lib/validation/plan-item.ts`: `setBudgetSchema`
    - `src/app/(app)/plan/actions.ts`: `setBudget`
    - `src/app/(app)/settings/categories/actions.ts`, the categories and edit pages
    - `src/components/categories/category-form.tsx`, `category-list.tsx`
    - `src/components/plan/one-off-form.tsx`, `plan-groups.tsx`, `plan-table.tsx`, `empty-plan.tsx`
    - `src/app/(app)/plan/plan-item-sheet.tsx`, `page.tsx`
    - Tests: `tests/lib/plan.test.ts`, `tests/lib/validation/category.test.ts`, `tests/lib/validation/plan-item.test.ts`, `tests/db/plan-items.test.ts`
    - `docs/week-5-tasks.md`
- **Decisions (owner, Nov 26, Claude's recommendations):**
  - 5g is split into 5g-1 (spending budgets) and 5g-2 (debt payments and the Plan options menu).
  - Budget per payday starts with the current period, because generation adds it to every open period.
  - "This period only" is a `recurring` item marked `edited`, so it shows under SPENDING BUDGETS and 5h's sync leaves it alone. Inserting with `edited` needed a one-line grant (a migration, not a data model change).
  - Setting a budget twice changes the amount. A removed budget item is brought back rather than re-added, because the unique key counts removed rows.
- **Tests:** written first, 4 new unit tests (475 pass) and 1 new database test (270 pass). Lint, typecheck and the build pass. Checked in a browser with Playwright on local Supabase:
  - Groceries ₱3,000 every payday on Nov 15 (₱7,500 → ₱4,500)
  - Nov 30 got Groceries ₱3,000 from the budget per payday
  - "This period only" ₱4,000 on Nov 30 (prefilled ₱3,000; ₱22,000 → ₱21,000), while Dec 15 and Nov 15 stayed at ₱3,000
  - Settings › Categories shows "₱3,000 per payday", and the edit field has 3,000
  - desktop "+ Set a budget"
  - 5f's checks still pass
  - no console errors
- **Live:** the migration was pushed Nov 26 (dry run first, owner's go).
- **Next:** 5g-2, debt payments and the Plan options menu.

## 2026-11-26 · Week 5 · 5f Add one-off item
- **What:** an Add one-off item sheet (a dialog on desktop) at `/plan?start=…&add=1`. It has:
  - **Fields:** What is it for?, Amount, Needed by, payday cards (now and up to 3 months ahead) and Category.
  - **Suggestion:** setting Needed by picks the payday just before it, until a card is picked by hand.
  - **Category:** the tile grid shows "Counts as Wants" for the picked category.
  - **Impact box:** "Nov 30 – Dec 14 not assigned: ₱25,000 → ₱22,500". It turns yellow with "₱500 more than that period has left" when it goes over.
  - **Saving:** it goes to the chosen period, with "Dad's birthday gift added · Undo".
  - **Opens from:** the mobile ONE-OFF ITEMS group, the desktop header and table, and the empty plan's One-off items row.
- **Files:**
  - New: `src/components/plan/one-off-form.tsx`.
  - Edited:
    - `src/lib/plan.ts`: `suggestedPeriodStart()`, `oneOffImpact()`
    - `tests/lib/plan.test.ts`
    - `src/app/(app)/plan/actions.ts`: `addOneOffItem`, `getPeriodNotAssigned`
    - `src/app/(app)/plan/plan-item-sheet.tsx`, `page.tsx`
    - `src/components/plan/plan-groups.tsx`, `plan-table.tsx`, `empty-plan.tsx`
    - `docs/week-5-tasks.md`
- **Decisions (owner, Nov 26, Claude's recommendations):**
  - Category reuses Add expense's tile grid, the picker and New category, not chips of four.
  - Needed by is a plain date input, because DateButton can't pick future dates.
  - The impact box says "It'll show in that period's plan" without "with a reminder" until Week 7.
  - The past period isn't offered.
  - The impact number comes from `openPlanPeriod()` for the chosen card, so it matches that period's Plan. Picking a future card opens that period, the same as tapping its chip.
  - The server rejects system categories (Savings pot, Debt payment). The database would accept them.
- **Tests:** written first, 8 new unit tests (468 pass). Lint, typecheck and the build pass. Checked in a browser with Playwright on local Supabase:
  - name focused, 7 payday cards, Needed by Dec 5 → Nov 30
  - added to Nov 30 (₱25,000 → ₱22,500), then Undo
  - the yellow over-budget box
  - a one-off on Feb 15, 3 months ahead (₱22,000)
  - More, then Esc back to the form
  - desktop Cancel
  - no console errors
- **Next:** 5g, debt payments and spending budgets.

## 2026-11-26 · Week 5 · 5e Edit and remove plan items; starter plan
- **What:**
  - **Edit item:** tapping a plan row opens a sheet on mobile and a dialog on desktop (`/plan?start=…&edit=<id>`). It edits the name and amount, plus Needed by for one-offs, and shows "Not assigned yet: ₱8,800 → ₱8,300" before saving. Pay that hasn't come in shows Money for this period instead. Saving sets `edited`, so 5h's sync leaves the item alone. The bill, pot or debt keeps its link and its own amount.
  - **Remove from plan (level 1):** "Remove Meralco from this plan?" with the item card and its effect in pesos. It's a soft delete, then "Meralco removed · Undo" for 5 seconds. Generated items say "It won't be added back to this period."
  - **Use this starter plan:** the button on the empty plan's starter card adds the three `starter` items, skipping groups already there. The pay is worked out on the server.
  - **Ended periods are read-only:** no edit links and no starter button, and the actions refuse them too.
- **Files:**
  - New:
    - `src/app/(app)/plan/actions.ts`: `updatePlanItem`, `removePlanItem`, `restorePlanItem`, `addStarterPlan`
    - `src/app/(app)/plan/plan-item-sheet.tsx`: `PlanEditor` (sheet, remove dialog, toast) and `UseStarterPlanButton`
    - `src/components/plan/plan-item-form.tsx`
  - Edited:
    - `src/lib/plan.ts`: `editImpact()`, `removeImpact()`, `missingStarterItems()`
    - `tests/lib/plan.test.ts`
    - `src/lib/plan-periods.ts`: returns `ended`.
    - `src/components/plan/plan-groups.tsx`, `plan-table.tsx`, `empty-plan.tsx`, `src/app/(app)/plan/page.tsx`
    - `src/components/confirm-delete.tsx`: an optional `pendingLabel` ("Removing…"). The default stays "Deleting…".
    - `docs/week-5-tasks.md`
- **Decisions (owner, Nov 26, Claude's recommendations):**
  - The Plan options menu moved to 5g. For now it would only hold "Use starter plan", and Period settings isn't designed.
  - Income items can be edited too (name and expected amount). Pay already received counts as logged, so editing it changes nothing in the totals, and the form says so.
  - The wording is "Remove from plan", not "Delete", following delete-pattern.md.
  - On mobile, the whole row is the link. On an income row only the name is, because the I got paid pill is its own button. On desktop, the item name is the link.
  - The starter button uses the Primary look, not Hero, because the starter card is already the area's sticker.
- **Tests:** written first, 9 new unit tests (460 pass). Lint, typecheck and the build pass. 269 database tests pass, after writing `.env.test.local` (gitignored) and starting local Supabase.
  - Checked in a browser with Playwright against local Supabase: a new user's starter plan, editing Needs, removing Wants and Undo, all with the right totals. The desktop table's links also work. Not checked: an ended period being read-only, because a new user has no past period.
  - Noticed, from 5d-1: starter rows read "Needs · Needs", because the detail repeats the group.
- **AI notes:** Claude first ran Prettier on `plan-groups.tsx`, but the project has no Prettier config, so it reformatted the whole file. Claude reverted that and redid the edit by hand.
- **Next:** 5f, Add one-off item.

## 2026-11-25 · Week 5 · 5d-2 Plan desktop table and empty state
- **What:**
  - **Desktop Plan:**
    - the schedule as the header eyebrow
    - stat cards: Money in, Planned, Not assigned yet, and Paid or spent (hidden for future periods)
    - one plan table, with `rowgroup` headers and their totals
    - the Planned split of income card
  - **Empty plan:** shown when nothing but income is planned, with:
    - a plain summary card
    - the starter card with three tiles from `starterPlan()`
    - MONEY IN
    - OR BUILD IT YOURSELF
  - **Also:** an **I got paid** pill on income that hasn't arrived (current and past periods), and "Starting balance · From setup" on the first period.
- **Files:**
  - New: `src/components/plan/plan-stats.tsx`, `plan-table.tsx`, `planned-split.tsx`, `empty-plan.tsx`.
  - Edited:
    - `src/lib/plan.ts`: `isEmptyPlan()`, `planCounts()`, `planDone()`.
    - `tests/lib/plan.test.ts`
    - `src/lib/plan-periods.ts`: adds `isFirst`, `future`, `moneyOut`, `starter` and `pay`.
    - `src/components/plan/plan-groups.tsx`, `src/components/plan/plan-summary.tsx`, `src/app/(app)/plan/page.tsx`
    - `docs/week-5-tasks.md`
- **Decisions (owner, Nov 25, Claude's recommendations):**
  - The empty plan means "nothing but income", since income items are always generated.
  - The "Use this starter plan" button comes in 5e, with the other item writes. The card shows the tiles until then.
  - The table has ITEM, DETAILS and PLANNED only. ACTUAL and STATUS come with ticking (Week 6).
  - Desktop chips keep the date range only. Per-chip stats would mean loading every period's items.
  - Set a budget (5g) and Add one-off (5f) rows have no button yet. The Bill, Debt and Pot rows link to `?add=1` on their pages.
- **Tests:** written first, 4 new unit tests (451 pass), plus 269 database tests. Lint, typecheck and the build pass. Not checked in a browser, for the same reason as 5c.
- **Next:** 5e, editing and deleting items, and the starter plan.

## 2026-11-25 · Week 5 · 5d-1 Plan screen: picker, summary and groups
- **What:** The real mobile Plan screen replaces 5c's temporary list:
  - a period picker (PAST, NOW, NEXT, AHEAD chips)
  - the summary card (Money for this period, a planned bar, Planned and Not assigned yet)
  - sections for MONEY IN (with Carried in), BILLS, DEBT PAYMENTS, SAVINGS, SPENDING BUDGETS and ONE-OFF ITEMS
- **Files:**
  - New: `src/components/plan/period-picker.tsx`, `plan-summary.tsx`, `plan-groups.tsx`.
  - Edited:
    - `src/lib/plan.ts`: `periodIncome()`, `incomeStatus()`, `planItemDetail()`.
    - `tests/lib/plan.test.ts`
    - `src/lib/plan-periods.ts`: `openPlanPeriod()` loads its sources once (for generating and for the detail lines) and returns the rows, income, carry-in and summary.
    - `src/app/(app)/plan/page.tsx`
    - `docs/week-5-tasks.md`
- **Decisions (owner, Nov 25, Claude's recommendations):**
  - Spending budgets show the planned amount only. Spent, left and the bar come with planned vs actual (Week 6).
  - Group headings show the group total. "₱1,700 of ₱2,700 paid" comes with ticking (Week 6).
  - Tick circles are drawn but `aria-hidden`, not buttons, until Mark paid exists (Week 6).
  - Carry-in and received income use the Dashboard's `dashboardNumbers()`, so the current period matches the Dashboard. Future periods use expected income, and their carry-in shows "—". Ended periods count only the income that came in.
  - The chip for the period being shown gets the Deep Green look and `aria-current`. The current period is always labelled NOW.
  - Too much planned shows a yellow "You've planned ₱500 more than this period has" note, not red.
- **Tests:** written first, 13 new unit tests (447 pass) and 269 database tests. Lint, typecheck and the build pass. Not checked in a browser, for the same reason as 5c.
- **Skipped (later tasks):**
  - The "Add one-off item" button (5f) and the Plan options menu (5e)
  - The desktop table and the empty plan (5d-2)
  - Assign the ₱8,800 (Week 6); the "I got paid" pill came in 5d-2
- **Next:** 5d-2, the desktop table and the empty state.

## 2026-11-25 · Week 5 · 5c Opening a period
- **What:** `/plan?start=…` opens any period from one back to 3 months ahead, creating it the first time and adding its generated items. For now the page shows a period picker and a plain list of items; 5d replaces it with the real screen.
- **Files:**
  - New:
    - `supabase/migrations/20261125110000_add_plan_items.sql`: `add_plan_items(target_period, items)`.
    - `src/lib/plan-periods.ts`: `openPlanPeriod()`.
    - `tests/db/add-plan-items.test.ts`
  - Edited:
    - `src/lib/plan.ts`: `plannablePeriods()`, `resolvePlanStart()`.
    - `tests/lib/plan.test.ts`
    - `src/app/(app)/plan/page.tsx` (temporary list)
    - `src/lib/supabase/types.ts` (by hand)
    - `docs/week-5-tasks.md`
- **Decisions (owner, Nov 25, Claude's recommendations):**
  - **`add_plan_items()`:**
    - Runs as the caller, so RLS, the column permissions and the same-owner keys apply.
    - Always inserts `recurring` items and skips duplicates with a bare `on conflict do nothing`.
    - Returns how many it added.
  - **Generation:**
    - Runs on every open of a period that hasn't ended, so a bill added later appears in plans already open. Items you deleted stay deleted.
    - Past periods never generate.
  - **Plannable periods:**
    - One back (never before the budget's first period) to the last one starting within 3 months of today.
    - Anything else in `?start=` opens the current period.
- **Tests:** written first. 9 new database tests (269 pass) and 5 new unit tests (434 pass). Lint, typecheck and the build pass. Not checked in a browser: `.env.local` points at live, so the dev server would write test periods there.
- **Live:** applied Nov 25 (dry run, owner's go, `db push --linked`) before pushing the code, since `/plan` calls `add_plan_items()`. `types.ts` regenerated from live matched the hand edit. Not browser-checked: open `/plan` on your phone after the deploy.
- **Next:** 5d-1, the Plan screen (picker, summary and groups).

## 2026-11-25 · Week 5 · 5b Plan math, tests first
- **What:** Pure functions for the plan:
  - `generatePlan()`: a period's recurring items from income sources, bills, debts, pots and spending budgets.
  - `payingPeriodStart()`: which payday pays a bill.
  - `starterPlan()`, `planSection()` and `planSummary()`.
  - Zod schemas for Add one-off item and Edit item.
- **Files:**
  - New: `src/lib/plan.ts`, `src/lib/validation/plan-item.ts`, `tests/lib/plan.test.ts`, `tests/lib/validation/plan-item.test.ts`
  - Edited: `docs/week-5-tasks.md`
- **Decisions (owner, Nov 25, Claude's recommendations):**
  - **A bill is paid by the latest period of its payday that starts on or before the due date.** Due Dec 10, paid from the 15th, goes in the Nov 15 plan. On weekly and monthly budgets it's the period containing the due date, like debts.
  - **Starter plan:** "Needs", "Wants", "Savings & debt". Needs and Wants round down to whole pesos, and Savings & debt gets the rest, so the three add up to the income.
  - **Debt items** are what's left of each scheduled payment after what's been paid, oldest payment first.
  - **Sections:** an item linked to nothing and not recurring or starter is a one-off; an extra debt payment shows under Debt payments. The 50/30/20 split uses each item's category group.
- **Tests:** written first, then the code. 32 new unit tests (429 pass). Lint and typecheck pass.
- **AI notes:** I wrongly wrote that `splitHalves()` gives the odd centavo to payday 1; it gives it to payday 2. Fixed in the task list.
- **Next:** 5c, opening a period (needs the `add_plan_items()` SQL function, a migration).

## 2026-11-25 · Week 5 · 5a `plan_items` migration
- **What:** The `plan_items` table, the "Debt payment" system category, and `transactions.plan_item_id`.
- **Files:**
  - New: `supabase/migrations/20261125100000_plan_items.sql`, `tests/db/plan-items.test.ts`
  - Edited:
    - `src/lib/supabase/types.ts` (by hand)
    - `src/lib/categories.ts`, `src/components/categories/delete-category-dialog.tsx` and `src/app/(app)/settings/categories/edit/page.tsx`: the delete dialog counts plan items ("2 bills, 3 plan items and 12 transactions use Fun.").
    - `src/components/categories/category-list.tsx`: the detail line for Debt payment.
    - `tests/lib/categories.test.ts`, `tests/db/categories.test.ts` (20 default categories)
    - `docs/week-5-tasks.md`, `docs/mvp-brief.md`
- **Decisions (owner, Nov 25, Claude's recommendations):**
  - **`edited`** (default false), set by 5e's Edit, so 5h's sync skips hand-edited items.
  - **"Debt payment"** (Needs, `debt_payment`) is added now, not in Week 6: generated debt items need a category. Existing accounts that already have their own "Debt payment" get "Planned debt payment".
  - **Generation keys:** one recurring item per period per income source, bill, pot or debt, and one per category for spending budgets. They count soft-deleted rows, so an item you delete never comes back. The starter plan is once per period (live rows only).
  - **Detaching:** a recurring item whose source is deleted, or whose spending budget's category is moved by `delete_category()`, becomes a `one_off`. Without this, a past Meralco item would clash with a Bills spending budget once Meralco is deleted.
  - **Deleting a bill, pot, debt or income source** soft-deletes its unpaid items in periods that end today (Manila) or later. It runs as the table owner, because deleting an account cascades into bills as the Auth service.
  - **Permissions:** users can't change `origin`, the links or `paid_at` (Mark paid, Week 6), and can't hard-delete. `transactions.plan_item_id` has its foreign key but no column permission until Week 6.
- **Tests:** 36 new database tests (260 pass) and 1 new unit test (397 pass). Lint and typecheck pass. `.env.test.local` is missing on this machine, so the database tests ran with the local URL and key passed inline.
- **AI notes:** The API's `upsert({ ignoreDuplicates })` only skips duplicates of the primary key, not partial unique keys. 5c needs a small SQL function with a bare `on conflict do nothing`.
- **Live:** applied Nov 25 (`db push --linked`, after a dry run that listed only it; owner's go), then pushed `main`. `types.ts` regenerated from live matched the hand edits exactly. The CLI on this machine is now linked to the live project.
- **Next:** push 5a live, then 5b `generatePlan()`.

## 2026-11-25 · Week 5 (planning) · Plan generation tasks
- **What:** Broke the brief's Week 5 into tasks 5a–5i in `docs/week-5-tasks.md`.
- **Files:** `docs/week-5-tasks.md` (new), `docs/mvp-brief.md` (data model, Week 5 and 6 checklists), `docs/designs/plan.md` (Decided Nov 25 note, routes), `docs/plan-review-2026-11-19.md` (3.9, 3.10, 5.3), `docs/V1.1.md`.
- **Decisions (owner, Nov 25, all Claude's recommendations):**
  - A nullable `budget_group` on `plan_items` for starter items (3.9).
  - Spending-budget copies use origin `recurring` (3.10).
  - `/plan?start=…` instead of `[periodId]`.
  - Debt installments are auto-planned; "When I can" debts never are.
  - The picker reaches 3 months ahead.
  - Copy last period's plan goes to v1.1; Give leftover a job goes to Week 6.
  - Plan items have no note.
- **Open:** how 5h spots hand-edited items (settle in 5a).
- **Next:** 5a `plan_items` migration.

## 2026-11-25 · Week 4 · Live check done
- **What:** The owner entered their real bills, pots and debts on their phone (4h). Week 4 is done; the brief's Week 4 boxes are ticked.
- **Files:** `docs/week-4-tasks.md`, `docs/mvp-brief.md`.
- **Tests:** owner's check on live.

## 2026-11-24 · Week 4 · "When I can" on live
- **What:** Applied `20261124170000_flexible_debts.sql` to live (`db push --linked`, after a dry run that listed only it; owner's go). Then pushed `main`: the date-field fix and "When I can". Migration first, because the new code reads and writes `target_date`.
- **Files:** none changed. `types.ts` regenerated from live matched the hand edits exactly.
- **Tests:** the dry run, the push ("Remote database is up to date."), and the types diff.
- **Next:** 4h live check on the phone (bills, pots, debts, including a "When I can" debt).

## 2026-11-24 · Week 4 (extra) · "When I can" debts
- **What:** A third answer to "How will you pay it?": **Installments · One payment · When I can**, for debts with no schedule (owner: "I can only pay it when I have extra money for it").
  - **New debt:** hides Number of payments, the due date and Each payment, and shows an optional **Aim to pay off by** month, plus "Pay what you can, whenever you have extra. Nothing is ever late." and, with a month, "To be debt-free by Jun 2027, pay about ₱900 a month."
  - **Its card:** "When I can", "₱7,000 left of ₱10,000", a paid bar, "₱3,000 paid so far" and "Aiming for Jun 2027" (or "Pay whenever you have extra"). No next payment, no schedule.
- **Files:**
  - New: `supabase/migrations/20261124170000_flexible_debts.sql`
  - Edited:
    - `src/lib/debts.ts`: `DebtTerms` nullable schedule fields and `target_date`, `debtSchedule` / `debtProgress` / `debtsSummary` handle flexible, new `flexibleMonthly`.
    - `src/lib/validation/debt.ts`: `flexible`, `targetMonth` → `targetDate`.
    - `src/components/debts/debt-form.tsx`, `src/app/(app)/debts/page.tsx`, `debt-sheet.tsx`, `actions.ts`.
    - `src/lib/supabase/types.ts` (by hand).
    - Tests in `tests/lib/` and `tests/db/pots-and-debts.test.ts`.
    - `docs/mvp-brief.md` (data model), `docs/designs/debts.md` (§4 note).
- **Decisions (owner, Nov 24, Claude's recommendations):**
  - **Label "When I can".** The optional target is a month, stored as its 1st, like a pot's target date.
  - **Migration:**
    - `payment_type` allows `flexible`.
    - `num_payments`, `payment_amount` and `first_due_date` become nullable.
    - New `target_date`.
    - `debts_payments_match_type` rewritten so each type has exactly its fields (flexible: no schedule; only flexible may have a target).
    - Existing debts are unchanged.
  - **Totals:** a flexible debt is never Due or Late and adds nothing to Due this period; it counts in Total owed and Paid off so far. It sets Debt-free by (the end of its target month) only with a target.
  - **Payments** on it count as extra payments (Savings & debt payoff). They come with Week 6's Transfer → To a debt and Pay extra. Week 5's plan never adds it automatically.
  - **The monthly hint** (`flexibleMonthly`) is what's left ÷ months from this one to the target month, rounded up to ₱100.
- **Tests:** 9 new database tests (224 pass) and 7 new unit tests (396 pass). Lint, typecheck and the build pass. Not browser-checked.
- **Live:** the migration is local only. It must go live **before** this code: the new code reads and writes `target_date`, which doesn't exist on live yet, so pushing the code first would break the Debts page and saving debts.

## 2026-11-24 · Week 4 (fix) · Date fields too wide on mobile
- **What:** On the owner's phone, the date field was wider than its neighbour in New debt (Due date next to Number of payments) and in the Income sheet (Ends next to Starts).
- **Files:** `src/components/auth/text-field.tsx`
- **Decisions:**
  - iPhone Safari gives native date inputs their own minimum width and centres the value, and a grid column doesn't shrink below its content.
  - Fixed once in the shared field: `FieldShell` gets `min-w-0` so a field shrinks to its column, and `TextField` with `type="date"` drops the native look (`appearance-none`, `min-w-0`) and left-aligns the value. Every date field gets the fix.
- **Tests:** lint, typecheck, 389 unit tests and the build pass. Not checked on an iPhone here; the owner checks after the push.

## 2026-11-24 · Week 4 (planning) · Transfers in the add sheet
- **What:** The owner asked whether + can log a transfer (from cash to savings or debts). The brief already had cash ↔ pot (the Savings tab, built in 4e); debt payments were planned only as Mark paid / Pay extra on the Debts and Plan screens; pot ↔ pot wasn't in the brief; account transfers are v1.1.
- **Decisions (owner, Nov 24, Claude's recommendations):**
  - **In Week 6, the add sheet's Savings tab becomes "Transfer":**
    - **To a pot** and **From a pot** (today's Add / Withdraw).
    - **Pot to pot:** a withdrawal plus a deposit, net ₱0 to cash, like Delete pot's move.
    - **To a debt:** a planned payment when one is due this period, otherwise an extra payment.
    - It's Week 6 because it needs Mark paid and plan items.
  - **Planned debt payments use a new locked system category "Debt payment"** (Needs, `system_key = debt_payment`), added with Mark paid. Extra payments keep "Extra debt payment" (Savings & debt payoff). This settles 4f's open question.
- **Files:**
  - `docs/mvp-brief.md`: data model `system_key` values; a new Week 6 checkbox.
  - `docs/designs/activity.md`: a note at the top of the Savings tab section.
  - `docs/week-4-tasks.md`: the open question marked decided.
- **Tests:** docs only.
- **Next:** 4h live check (push the 4g commit first).

## 2026-11-24 · Week 4 · 4g Wire-up: Dashboard money out, More › Money lines
- **What:**
  - **Dashboard:**
    - Money out now counts net transfers to pots (decided in 3f): the spend bar, "₱X out so far" and the Money out stat.
    - When some went to pots, a line under the bar says "Includes ₱2,000 put into savings."
    - Cash now is unchanged (it already took pot transfers off).
  - **More › Money detail lines:**
    - Bills "3 recurring" / "No bills yet".
    - Savings pots "3 pots · ₱67,500 saved" / "No pots yet".
    - Debts "1 debt · ₱8,000 left" / "No active debts".
- **Files:** `src/lib/money.ts` (`dashboardNumbers`) and its test, `src/components/dashboard/cash-card.tsx`, `src/app/(app)/more/money-section.tsx`, `docs/week-4-tasks.md`
- **Decisions:**
  - **`dashboardNumbers` has new fields:**
    - `spending`: Activity's Money out.
    - `toSavings`: Activity's To savings.
    - `moneyOut` = spending + net deposits into pots.
  - **Net withdrawals** (more taken out of pots than put in this period) count as money coming in this period, adding to `periodMoney`, not as negative money out. It matches Delete pot's "Adds ₱6,000 to this period's money", and keeps cash now = period money − money out.
  - **Activity vs Dashboard:** they agree on Money in and on spending. Activity still shows To savings apart; the Dashboard's line explains the difference. A test checks cash now equals `cashOnHand` over every row.
- **Tests:** dashboard tests updated (389 pass), including deposits and a net withdrawal. Lint, typecheck and the build pass. Not browser-checked.
- **Next:** 4h live check: push, then enter your real bills, pots and debts on your phone.

## 2026-11-24 · Week 4 · 4f-2 New and Edit debt, Mark paid off, Delete
- **What:**
  - **New debt** (`/debts?add=1`):
    - Name, lender, total, "How will you pay it?" (In installments / One payment), number of payments (2–60), first due date (a plain date input, since future dates are the point), each payment, and interest %.
    - **The schedule preview** (live, `aria-live`): "1 · Dec 5 · Paid from Nov 30 payday · ₱5,000", "…" past six rows, "Debt-free by Feb 5.", and the yellow check line when the payments don't add up. Then the group note and **Add debt**.
  - **Edit debt** (`?edit=…`): the same form with **Save changes**, **Mark as paid off** / **Move back to active**, and **Delete debt**.
  - **Delete debt** (`?delete=…`): "It still has ₱8,000 left. It disappears from your debts.", "Past payments stay in Activity…", and "Paid it off outside the app? **Mark it paid off** instead".
- **Files:**
  - New: `src/components/debts/debt-form.tsx`, `src/app/(app)/debts/actions.ts`, `debt-sheet.tsx`
  - Edited: `src/app/(app)/debts/page.tsx`, `docs/week-4-tasks.md`
- **Decisions:**
  - **Each payment** fills in total ÷ number (rounded up to the peso) until it's typed by hand. One payment hides the count and Each payment, and the date label becomes "Due date".
  - **The spec's two delete choices are split** ("Mark it paid off" vs "Delete it"). Marking paid off isn't destructive, so it's a normal link in Edit and in the delete dialog; the red button only deletes (CLAUDE.md: red is only for destructive actions). It's reversible ("Move back to active").
  - **Delete** is a hard delete; payments keep their history with `debt_id` emptied (3.6). No migration needed.
  - **Interest hint:** "For your records. It doesn't change the payments." (display only, debts.md §1).
- **Tests:** no new pure logic (the preview uses `debtSchedule`, `paydayFor` and `lastPaymentNote`, all tested). 388 unit tests, lint, typecheck and the build pass. Not browser-checked.
- **Next:** 4g wire-up (More › Money detail lines; the Dashboard counting transfers to pots in Money out), then 4h live check.

## 2026-11-24 · Week 4 · 4f-1 Debts page
- **What:** `/debts` replaces its placeholder:
  - **Hero:** "Total owed", "Debt-free by Dec 25 if you keep the plan", and a "₱4,000 of ₱12,000 paid" bar.
  - **Desktop stat cards:** Due this period ("SPayLater · Nov 25"), Debt-free by, and Paid off so far ("incl. 1 finished debt").
  - **ACTIVE cards:**
    - Name, "3 payments · 3.5% interest · Shopee", "₱8,000 left of ₱12,000".
    - The next payment ("Next: ₱4,000 due Nov 25", or "Late: … was due Nov 18").
    - The schedule as an ordered list: "Payment 2 of 3", "Nov 25 · planned in Nov 15 payday", the amount, and its status in words (Paid, Due in 5 days, Planned, Late · 3 days).
    - An Edit link.
  - **PAID OFF:** three rows, then "Show N more".
  - **The group note** about Needs and Savings & debt payoff.
  - **Empty state.**
- **Files:**
  - `src/app/(app)/debts/page.tsx`
  - `src/lib/debts.ts`: `paydayFor`, `isPaidOff`, `debtsSummary`, `paymentStatusText`
  - `src/lib/validation/debt.ts`: `lastPaymentNote`, and the "only cover" check removed
  - Tests, `docs/week-4-tasks.md`
- **Decisions:**
  - **Fixed a spec mismatch from 4b.** debts.md §4 says payments that don't add up to the total get a *yellow warning*, and the last payment takes the difference. 4b had made the form *refuse* them. Now only a last payment of ₱0 or less is refused, and `lastPaymentNote()` gives the spec's line ("Payments add up to ₱13,500, ₱1,500 less than the total. The last payment will be ₱6,000.") for 4f-2's form.
  - **No separate details page:** each card holds the schedule on every screen size (fix #4 for mobile, used on desktop too).
  - **Late is the error tone** (`bad-bg` / `bad-fg`), not the destructive red, which is only for delete buttons (CLAUDE.md).
  - **Paid off** = marked (`paid_off_at`) or nothing left.
  - **Due this period** = unpaid payments due in the current period, from the schedule (plan items replace this in Week 5).
  - **Mark paid and Pay extra wait for Week 5.** They need plan items, and planned payments need a Needs category we don't have yet. Open question added to `week-4-tasks.md`.
- **Tests:** 7 new unit tests (388 pass), checked against the spec's numbers (₱8,000 owed, ₱14,000 paid off so far, debt-free Dec 25). Lint, typecheck and the build pass. Not browser-checked.
- **Next:** 4f-2, New and Edit debt with the schedule preview, and Delete.

## 2026-11-24 · Week 4 · 4e Savings tab
- **What:** The add sheet's third tab, **Savings**:
  - **Add to pot / Withdraw**, the amount, and **Which pot?** cards ("₱6,000 of ₱20,000"). Locked pots say "· locked, deposits only" and are disabled for Withdraw.
  - **+ New pot** (closes the sheet and opens New pot on the Savings page), and the date.
  - **Impact line:** "Travel will be at ₱8,000 of ₱20,000 (40%)."
  - **The button says what happens:** **Add ₱2,000 to Travel** / **Withdraw ₱1,000 from Travel**.
  - **After saving:** the toast "Added ₱2,000 to Travel" with Undo.
  - **Ways in:**
    - Pot details: **Add money** (primary) and **Withdraw** (secondary, hidden for locked pots), with the pot already chosen.
    - Savings page: **Add money to a pot**.
  - **Activity:** savings rows open in Edit transaction (no type tabs), with **Save changes** and Delete.
- **Files:**
  - New: `src/components/transactions/savings-form.tsx`
  - Edited:
    - `src/app/(app)/activity/actions.ts`: `SheetPot` in the sheet's data, `saveSavings` / `updateSavings`, savings in Edit transaction.
    - `src/components/transactions/add-transaction-provider.tsx`: the tab, the pot and direction options, and the toast.
    - `type-tabs.tsx` (Savings), `src/lib/validation/transaction.ts` (`savingsSchemaFor`), `src/lib/pots.ts` (`potBalanceAfter`) and their tests.
    - `src/app/(app)/savings/page.tsx`, `details/page.tsx`, `docs/week-4-tasks.md`
- **Decisions:**
  - **Signed amounts:** typed above zero and saved signed. A withdrawal is a negative `savings` amount (plan review 3.5), in the locked Savings pot category.
  - **Server checks:**
    - The pot is the user's.
    - A locked pot is deposits only ("MP2 is locked: deposits only."; the database refuses it too).
    - **A withdrawal can't take out more than the pot holds** ("Travel only has ₱6,000."); the impact line warns before saving.
    - Editing takes the row's old amount out of the balance first.
  - **Not editable:** savings rows whose pot was deleted (their link is empty). Debt payments wait for Week 5.
  - **Toast ids:** `toastWithAction()` moved out of the component: the React Compiler lint flagged `Date.now()` in a function defined while rendering.
  - **Not yet:**
    - The "Planned ₱2,000" tag and "This also ticks off…" (plan items, Week 5).
    - "Savings · From Travel" detail lines in Activity rows: they still show the Savings pot category.
- **Tests:** 4 new unit tests (380 pass), lint, typecheck and the build. Not browser-checked.
- **Next:** 4f, the Debts screen.

## 2026-11-24 · Week 4 · `delete_pot` on live, Bills and Savings pushed
- **What:** Applied `20261124160000_delete_pot.sql` to live (`db push --linked`, after a dry run that listed only it; owner's go). A second dry run says "Remote database is up to date." Then pushed `main` so Vercel deploys Week 4 so far (4a–4d: Bills and Savings).
- **Files:** none changed. `types.ts` regenerated from live (`--linked`) matched the hand-written `delete_pot` entry exactly.
- **Tests:** the dry run, the push, and the types diff. Not yet tried on the live app.
- **Next:** try Bills and Savings on the phone; then 4e, the add sheet's Savings tab.

## 2026-11-24 · Week 4 · 4d-3 Pot details and Delete pot
- **What:**
  - **Pot details** (`/savings/details?id=…`, opened from a pot card):
    - The balance hero ("₱13,000 of ₱30,000 · 43%") with the bar and status.
    - Plan, Still needed and Goal date.
    - **Edit pot** (opens the sheet on `/savings`) and **Delete pot**.
    - HISTORY, newest first, ending with "Starting balance".
  - **Delete pot** (level 2):
    - "It still has ₱6,000.", then either **Move it to another pot** ("Emergency Fund becomes ₱19,000 of ₱30,000"; a pot select when there's more than one) or **Count it as withdrawn** ("Adds ₱6,000 to this period's money").
    - "Past deposits stay in Activity for your records."
    - An empty pot just deletes.
- **Files:**
  - New:
    - `supabase/migrations/20261124160000_delete_pot.sql`, `tests/db/delete-pot.test.ts`
    - `src/app/(app)/savings/details/page.tsx`
    - `src/components/savings/delete-pot.tsx`, `pot-status-tag.tsx` (moved out of the Savings page)
  - Edited: `src/app/(app)/savings/actions.ts` (`deletePot`), `page.tsx`, `pot-sheet.tsx`, `src/lib/pots.ts` (`balanceAfterMove`) and its test, `src/lib/supabase/types.ts` (`delete_pot`, by hand), `docs/week-4-tasks.md`
- **Decisions:**
  - **`delete_pot(target_pot, on_period, on_date, choice, move_to)`:**
    - `security invoker`. Works out the balance like `potBalance()`.
    - **move** writes a withdrawal from this pot ("Moved to Emergency Fund") and the same deposit into the other ("Moved from Travel"): net ₱0 to cash.
    - **withdraw** writes one withdrawal ("Travel closed"), which adds the money to cash.
    - Then it deletes the pot; earlier rows keep their history with the link emptied. All in one database transaction.
    - The Server Action passes today's period (`getOrCreatePeriod`) and date.
  - **Locked pots** only offer "Count it as withdrawn", behind a "The money really left" checkbox. The function unlocks the pot just before writing the withdrawal, because `check_transaction_links()` refuses withdrawals from locked pots.
  - **One details page on every screen size** instead of the desktop side panel (savings.md §3). Simpler, and it's also the mobile page the spec asks for.
  - **`choice` and `move_to` default to null,** so the generated types make them optional (the first version had no defaults; it was fixed before going live).
  - **Not yet:** Add money and Withdraw (4e); after Edit pot, the sheet returns to the list, not the details.
- **Tests:** 9 new database tests (215 pass): move, withdraw, locked, empty, bad choices change nothing, past deposits kept, user A vs B, logged out. 1 new unit test (376 pass), lint, typecheck and the build. Not browser-checked.
- **Live:** the `delete_pot` migration is local only. It needs a dry run and the owner's go before pushing.
- **Next:** 4e, the add sheet's Savings tab.

## 2026-11-24 · Week 4 · 4d-2 New and Edit pot
- **What:** New savings pot (`/savings?add=1`) and Edit pot (`?edit=…`):
  - **Fields:**
    - Pot name.
    - 7 icons: Laptop, Emergency, Travel, Home, Gift, School and Planned costs.
    - 6 colour swatches.
    - Target (optional), and Target date (optional, month and year selects, with Clear date).
    - Already saved and Save each time.
    - From: Every payday, 15th only or 30th only, with the real pay days; hidden on one-payday budgets.
    - Locked savings (switch).
  - **The projection box:**
    - "At ₱4,000 a month you reach ₱40,000 by Sep 2027."
    - With no target: "…you'll save ₱48,000 in a year."
    - A target date that won't be met adds the yellow "Save ₱2,700 each payday to make it by Jun 2027."
    - Also "You've already reached…" and "Set how much to save each time…".
  - **Buttons:** **Create pot** / **Save changes**.
- **Files:**
  - New: `src/components/savings/pot-form.tsx`, `src/app/(app)/savings/actions.ts`, `pot-sheet.tsx`
  - Edited:
    - `src/app/(app)/savings/page.tsx`: passes each pot's deposits so far; mounts the sheet.
    - `src/lib/pots.ts`: `potProjection`.
    - `src/components/categories/category-form.tsx`: exports its icon and swatch styles for reuse.
    - Tests, `docs/week-4-tasks.md`
- **Decisions:**
  - **Colour follows the icon** (Emergency → red, Travel → purple…) until a colour is picked by hand. Editing keeps the saved colour.
  - **Target date:** month and year selects instead of `<input type="month">`, which Safari and Firefox on desktop don't support. Years run from this year to 10 years ahead.
  - **Editing "Already saved"** keeps the deposits made since: the projection uses the new starting balance plus deposits so far (`depositsSoFar`).
  - **Duplicate names:** "You already have a pot called Travel." (the database ignores case).
  - **Not yet:** "Update future paydays only?" when the contribution changes (needs plan items, Week 5), and Delete pot (4d-3).
- **AI notes:** One expected goal date in the new tests was a payday late (Apr 30 instead of Apr 15 for 10 paydays). The code was right; the test was fixed.
- **Tests:** 4 new unit tests (375 pass), lint, typecheck and the build. Not browser-checked.
- **Next:** 4d-3, pot details and Delete pot (needs a `delete_pot()` migration; show the owner first).

## 2026-11-24 · Week 4 · 4d-1 Savings page
- **What:** `/savings` replaces its placeholder:
  - **Hero:** "Total saved" with "Across 3 pots · +₱3,000 this period".
  - **Desktop stat cards:** Added this period and Monthly saving plan.
  - **YOUR POTS:** one card per pot with:
    - The tile, name and schedule ("₱3,000 every 15th", "₱2,000 each payday", "No savings plan yet").
    - The balance.
    - A progress bar with "₱17,000 to go" and "43% of ₱30,000".
    - A status tag in words.
  - **Empty state** with **New pot**.
- **Files:**
  - `src/app/(app)/savings/page.tsx`
  - `src/lib/pots.ts`: `monthlySavingPlan`, `potScheduleLine`, `potStatus`, `potToGo`, `totalSaved`
  - `src/lib/periods.ts`: `formatMonthYear`
  - `src/components/transactions/category-grid.tsx`: laptop, life-buoy and calendar-clock icons
  - Tests, `docs/week-4-tasks.md`
- **Decisions:**
  - **4d split in three:** the page, then the New/Edit sheet, then details and delete.
  - **Status order:**
    - Locked ("Locked · deposits only").
    - No target (no tag; a locked pot without one says "No target · long-term savings").
    - Reached ("Goal reached").
    - No plan ("Set how much to save each payday").
    - Behind ("Behind" plus "Save ₱4,700 each payday to make it by Dec 2026.") when a target date can't be met.
    - Otherwise "On track for Feb 2027".
  - **Monthly saving plan:** every-payday pots count twice a month on twice-a-month budgets; weekly budgets count 52 ÷ 12 paydays a month.
  - **"This period":** net deposits minus withdrawals dated inside the current period.
  - **Pot cards** link to `/savings/details?id=…` (4d-3); **New pot** opens `?add=1` (4d-2). Both do nothing until then.
  - **Not yet:** "Add money to a pot" (needs the Savings tab, 4e) and "Due this period: ₱2,000 to Travel" (needs plan items, Week 5).
- **Tests:** 11 new unit tests (371 pass), lint, typecheck and the build. Not browser-checked.
- **Next:** 4d-2, the New and Edit pot sheet.

## 2026-11-24 · Week 4 · 4c-2 New and Edit bill, Delete bill
- **What:** Bills can be added, edited and deleted from `/bills`.
  - **New bill** (`?add=1`): name, amount, How often? (Monthly, Quarterly, Yearly), then "Due every [day]" or "First due [month] [day]", Paid from, Category, "Amount changes each month", "Remind me before it's due", the impact box, and **Add bill**.
  - Paid from is labelled with the budget's real pay days ("15th payday", "30th payday", "Split"). It's hidden on one-payday budgets.
  - **Edit bill** (`?edit=…`): the same form with **Save changes** and **Delete bill**.
  - **Delete** (`?delete=…`): level 2 with no choice. It shows the bill, "It disappears from your bills. Past payments stay in Activity.", and each payday's bills before → after.
- **Files:**
  - New: `src/components/bills/bill-form.tsx`, `src/components/switch.tsx`, `src/app/(app)/bills/actions.ts`, `bill-sheet.tsx`
  - Edited: `src/app/(app)/bills/page.tsx` (loads the form's categories, mounts the sheet), `src/lib/bills.ts` (`billTotalsChange`) and its test, `docs/week-4-tasks.md`
- **Decisions:**
  - **Suggested payday:** picking the due day moves Paid from to the last payday on or before it ("Suggested: the 30th comes right before the 10th."), until Paid from is picked by hand. Editing keeps the saved payday.
  - **Category:** a select of your spending categories (no system ones), defaulting to Bills. If the database refuses one, the error shows under Category.
  - **Impact box:** each payday's bills before → after, with "stay at" for the unchanged one (bills.md §4). Monthly amounts, so a quarterly bill adds a third.
  - **"Remind me" hint:** "Shows on your dashboard 2 days before." (fix #3). The reminder itself is Week 6.
  - **`Switch`:** a new shared component (`role="switch"`, `aria-checked`, label and hint tied to it) for Bills and, next, pots.
  - **After saving:** the spec adds the bill to every open future period's plan. That's Week 5, when plan items exist.
- **Tests:** 2 new unit tests (360 pass), lint, typecheck and the build. **Not browser-checked**, and no automated UI test covers the form. Check it by hand before pushing.
- **Next:** 4d, the Savings screen.

## 2026-11-24 · Week 4 · 4c-1 Bills page
- **What:** `/bills` replaces its placeholder:
  - **Hero:** "Bills each month" with the count.
  - **BILLS PER PAYDAY:** bars with amounts in text and the balance message ("Nicely balanced…" or the heads-up "The 15th carries most of your bills…"), plus the desktop tip.
  - **Sections:** one per payday ("PAID FROM 15TH PAYDAY ₱2,700"), or "Your bills" on one-payday budgets. Split bills appear in both at half, with a Split tag; variable bills show "≈".
  - **Rows:** category tile, name, schedule line ("Due every 20th", "Quarterly · 5th of Feb, May, Aug, Nov", "Yearly · next Nov 30"), amount, and a status tag.
  - **Empty state** with **Add bill**.
- **Files:**
  - `src/app/(app)/bills/page.tsx`
  - `src/lib/bills.ts`: `billsPerPayday`, `heavyPayday`, `suggestedBillSlot` (for 4c-2), `billStatus`, `billScheduleLine`, `splitHalves`, `paydayShares`
  - `tests/lib/bills.test.ts`, `docs/week-4-tasks.md`
- **Decisions:**
  - **4c split in two** (the page now, the sheet and delete next).
  - **No plan items yet:**
    - Status tags are "Due Nov 22" (a due date in this period) or "Next: Dec 10". "Paid Nov 15" waits for Week 5.
    - No "still due this period", no Paid / Still due stat cards and no Mark paid, all Week 5.
  - **Per-payday amounts** use monthly amounts (quarterly ÷ 3, yearly ÷ 12), so the two bars add up to "Bills each month", as in the spec's example (₱2,700 + ₱2,500 = ₱5,200). A split bill's odd centavo goes to the second payday.
  - **Desktop:** the same rows in a two-column layout with BILLS PER PAYDAY on the side, instead of the spec's table. The table's THIS PERIOD column is mostly Mark paid, which waits for Week 5.
  - **The bill tile** uses the bill's category colour, not a fixed yellow.
  - **Add bill and the row links** go to `?add=1` and `?edit=…`, which open the sheet in 4c-2. They do nothing until then; push both together.
- **Tests:** 11 new unit tests (358 pass), lint, typecheck and the build. Not browser-checked.
- **Next:** 4c-2, the New and Edit bill sheet and Delete bill.

## 2026-11-24 · Week 4 · 4b Bill, debt and pot math, and their Zod schemas
- **What:** Pure functions and form schemas for Week 4's screens, tests first.
  - **`lib/bills.ts`:**
    - `billMonths()`: quarterly wraps around the year from `first_due_month`.
    - `billDueDates(bill, from, to)`: also answers which period a date falls in.
    - `nextBillDue()`.
    - `billsPerMonth()`: monthly + quarterly ÷ 3 + yearly ÷ 12.
  - **`lib/debts.ts`:**
    - `debtSchedule()`: monthly from the first due date. The last payment is the remainder.
    - `debtPaid()`.
    - `debtProgress()`: paid, left, payments made, debt-free date, and each payment's status (Paid, Due, Planned, or Late with days).
  - **`lib/pots.ts`:**
    - `potBalance()` and `potProgress()`.
    - `potGoalDate()`: steps through the coming paydays.
    - `contributionNeeded()`: "Save ₱X each payday to make it by June", rounded up to ₱100.
  - **`validation/bill.ts`, `pot.ts`, `debt.ts`:** the New/Edit forms' schemas. Money is typed text in and centavos out, like income.
  - **`dateInMonth()`** in `lib/periods.ts`: the paydays' "day the month doesn't have → its last day" rule, shared by bills and debts.
- **Files:**
  - New: `src/lib/bills.ts`, `debts.ts`, `pots.ts`, `src/lib/validation/bill.ts`, `pot.ts`, `debt.ts`, and their tests in `tests/lib/`
  - Edited: `src/lib/periods.ts`, `tests/lib/periods.test.ts`, `docs/week-4-tasks.md`
- **Decisions:**
  - **Bills × 12 ÷ 12:** "Bills each month" adds up a yearly total and rounds once, so rounding errors don't add up.
  - **Bill pay slots:** payday 1, payday 2 or split on twice-a-month budgets (`every` would pay the bill twice); only `every` on weekly and monthly budgets.
  - **Pot pay slots:** payday 1, payday 2 or every; only every on one-payday budgets.
  - **Debts:**
    - Payments count in order: a part-payment doesn't mark the next one paid.
    - Late beats Due: an unpaid payment past its date is Late even inside the current period.
    - The payments must cover the total with something left for the last one; the errors say how ("3 payments of ₱3,000 only cover ₱9,000 of ₱12,000.").
    - `suggestedPayment()` rounds total ÷ payments up to the peso.
  - **Pots:**
    - The goal date and the contribution needed count only paydays **after today** that pay the pot. "By June" means by the end of June.
    - ₱0 is a valid contribution (the default pots start at ₱0).
    - The pot icons are the spec's 6 plus `calendar-clock` ("Planned costs") for Sinking Funds.
- **Tests:** 57 new unit tests (347 pass), including Feb 28/29, the 31st in short months, a yearly bill almost a year away, the spec's Travel goal (Feb 2027) and its ₱5,200 bills total. Typecheck and lint pass.
- **Next:** 4c, the Bills screen.

## 2026-11-24 · Week 4 · 4a on live
- **What:** Applied `20261124140000_recurring_bills.sql` and `20261124150000_savings_pots_and_debts.sql` to live (`db push --linked`, after a dry run that listed only these two; owner's go). A second dry run says "Remote database is up to date."
- **Files:** `src/lib/supabase/types.ts`, regenerated from live (`gen types --linked`): `savings_pots`, `debts`, `pot_id` / `debt_id` on transactions, and `add_default_pots`. Nothing was removed, so the hand-written `recurring_bills` entry from 4a-1 matched live exactly.
- **Effect:** no visible change yet (no screen uses these tables before 4c). Every live account now has the Emergency Fund and Sinking Funds pots.
- **Tests:** typecheck, lint and 290 unit tests pass with the new types.
- **Next:** 4b, pure functions and Zod schemas for bills, pots and debts, tests first.

## 2026-11-24 · Week 4 · 4a-2 `savings_pots`, `debts` and transaction links
- **What:** The `savings_pots` and `debts` tables with RLS, `pot_id` and `debt_id` on `transactions`, and two default pots (Emergency Fund, Sinking Funds) for every account.
- **Files:**
  - New: `supabase/migrations/20261124150000_savings_pots_and_debts.sql`, `tests/db/pots-and-debts.test.ts`
  - Edited: `tests/db/transactions.test.ts` (savings and debt rows now need a pot and a debt), `docs/week-4-tasks.md`
- **Decisions:**
  - **Pots:**
    - Names are unique per user, ignoring case, like categories.
    - The target date is stored as the 1st of its month (the form picks a month).
    - The starting balance and contribution can be ₱0, so the default pots start empty.
    - The pay slot is `payday_1`, `payday_2` or `every` (default `every`).
  - **Debts:**
    - Installments are 2–60 payments.
    - One-time means 1 payment equal to the total.
    - The payment amount doesn't have to divide the total evenly (the form fills in total ÷ payments, still editable).
    - Interest is 0–100, display only. `paid_off_at` can be set by the user ("Mark it paid off").
  - **Links:**
    - `on delete set null`, so deleting a pot or debt keeps its transactions (3.6).
    - A pot only on savings rows, a debt only on debt payments.
    - **A savings row needs a pot and a debt payment needs a debt** when it's added or its type changes, checked in `check_transaction_links()`.
    - **No withdrawals from a locked pot.**
  - **Default pots:** `add_default_pots()` runs at sign-up (`handle_new_user()`) and for existing accounts. They're ordinary pots, so they can be edited and deleted. Icons: `life-buoy` (red) and `calendar-clock` (blue); 4d's icon choices must include them.
  - **Types:** not hand-written this time. Regenerate from live after the push.
- **AI notes:** The first version also required a pot whenever `pot_id` changed. That blocked deleting a pot: `set null` is an update of `pot_id`, so the trigger refused it and the delete rolled back. A test caught it. The check now runs only on insert or a type change, and the fixed function was re-run on the local database instead of resetting it.
- **Tests:** 31 new database tests (206 pass), including user A vs user B for both tables and links to B's pot or debt. 290 unit tests, lint and typecheck pass. On local, all 802 accounts have both default pots.
- **Live:** 4a-1 and 4a-2 are local only. Next: one dry run for both, then the owner's go, then regenerate types from live.

## 2026-11-24 · Week 4 · 4a-1 `recurring_bills` migration
- **What:** The `recurring_bills` table with RLS. `delete_category()` now moves a category's bills along with its transactions, and the Delete category dialog counts bills ("2 bills and 12 transactions (₱3,400) use Fun.").
- **Files:**
  - New: `supabase/migrations/20261124140000_recurring_bills.sql`, `tests/db/recurring-bills.test.ts`
  - Edited: `tests/db/delete-category.test.ts`, `src/lib/supabase/types.ts` (the table, added by hand like `delete_category`), `src/lib/categories.ts` (`categoryUsage` counts bills) and its test, `src/app/(app)/settings/categories/edit/page.tsx`, `src/components/categories/delete-category-dialog.tsx`, `docs/week-4-tasks.md`
- **Decisions:**
  - **Pay slot `every`** for one-payday budgets (owner), like income sources. Whether a slot fits the budget's frequency is checked in Zod (4b), not the database, the same as income.
  - **`first_due_month`:** required for quarterly and yearly bills, empty for monthly (a check).
  - **Due days:** 1–31. A day a month doesn't have becomes the month's last day in 4b's date math.
  - **Category:** your own non-system expense category. A trigger checks the kind and system key; a same-owner foreign key checks the owner. A category with bills can't be deleted directly (`no action`), so `delete_category()` moves them first.
  - **Permissions:** update only the New bill form's fields (never the owner, budget or timestamps). Bills are hard-deleted (level 2); `(id, user_id)` is unique for Week 5's plan items.
  - **Delete dialog grammar fix:** "1 transaction uses Fun", not "use".
- **Tests:** 29 new database tests (175 pass), including user A vs user B (read, change, delete, create as B, B's budget, B's category). Plus 1 new unit test (290 pass), lint, typecheck and the build.
- **Live:** local only. It needs a dry run and the owner's go.
- **Next:** 4a-2, `savings_pots`, `debts`, and the transaction links.

## 2026-11-24 · Week 4 · Week 4 plan
- **What:** Wrote `docs/week-4-tasks.md` (4a–4h) and settled the Week 4 decisions.
- **Files:** `docs/week-4-tasks.md` (new), `docs/plan-review-2026-11-19.md` (3.7, 3.8 decided), `docs/mvp-brief.md` (data model: `first_due_month` on bills; pots' `pay_slot` without split)
- **Decisions (owner, Nov 24, Claude's recommendations):**
  - **Bills:** quarterly and yearly bills get `first_due_month`. The "Remind me" hint says "Shows on your dashboard 2 days before".
  - **Pots:** no split pay slot. Emergency Fund and Sinking Funds are default pots, made at sign-up and added to existing accounts.
  - **Details pages** use `?id=…` instead of `[id]`.
  - **Debts:** the mobile summary card is white.
  - **Ownership:** pots and debts stay per user; bills stay per budget.
- **Open:** a bill's pay slot on one-payday budgets (suggest `every`, like income sources). Settle in 4a.
- **Next:** 4a, the `recurring_bills`, `savings_pots` and `debts` migrations.

## 2026-11-24 · Week 3 (extra) · Edit from the Dashboard's Recent activity
- **What:** Tapping a Recent activity row on the Dashboard opens Edit transaction, the same sheet as Activity, with **Save changes** and the **Delete transaction** link. After a save or delete, the page refreshes, so Cash now, Income and the list update.
- **Files:** `src/components/dashboard/recent-activity.tsx` (now a client component; rows are buttons), `src/app/(app)/dashboard/page.tsx`, `src/components/activity/activity-list.tsx` (`deleteTargetFor`, shared by both)
- **Decisions:**
  - **Changes 3f's "rows aren't buttons; editing lives in Activity"** (owner, Nov 24).
  - The whole row is the Edit button ("Edit Lunch, −₱180") on mobile and desktop. There's no separate Delete button; Delete lives inside the sheet.
  - **Delete effect for older rows:** the last four rows can come from earlier periods. Their delete effect uses that period's own rows and label ("Money out in Nov 1 – 14"). The Dashboard loads those periods' rows and dates in one extra round trip, only when any recent row is from an older period. `editImpact` does the math on the server.
- **Tests:** lint, typecheck, 289 unit tests and the build pass. Not browser-checked.

## 2026-11-24 · Week 3 (extra) · Loading skeleton for New and Edit category
- **What:** New and Edit category showed an empty area while the form loaded. They now show a grey skeleton the shape of the form: preview card, name, three group rows, the icon grid, colours and Save, plus the Delete link on Edit.
- **Files:** new `src/components/categories/category-form-skeleton.tsx`; edited `src/app/(app)/settings/categories/edit/page.tsx` and `new/page.tsx`
- **Decisions:** The icon and colour blocks come from `CATEGORY_ICONS` and `CATEGORY_COLORS`, so the skeleton keeps matching if the sets change. It uses the shared `SkeletonRegion`, so screen readers hear "Loading…" once. New category got it too (owner asked for Edit; it had the same gap).
- **Tests:** lint, typecheck, 289 unit tests and the build pass. Not browser-checked.
- **Also:** after the region fix, the owner says the live app feels faster.

## 2026-11-24 · Week 3 · 3g Live check, Week 3 done
- **What:** On the phone, categories work end to end (owner). 3g and the brief's five Week 3 boxes are ticked.
- **Still slow on live, fast locally.** Measured from the server code's `x-vercel-id` (`/auth/callback`, 3 tries): `sfo1::iad1::…`. Functions still run in **US East (`iad1`)**, not Tokyo, so every database call crosses the Pacific, several times per page. The dashboard change to `hnd1` didn't apply to this deployment.
- **Files:** `docs/week-3-tasks.md`, `docs/mvp-brief.md`
- **Fix:** pinned the region in the repo (`vercel.json`, `"regions": ["hnd1"]`, commit `f3700b7`). About 50 seconds after the push, `x-vercel-id` showed `sfo1::hnd1::…` on every request. Functions now run in Tokyo, next to Supabase.
- **Next:** the owner checks on the phone whether pages and saving feel faster. If not, use `getClaims()` instead of `getUser()` in `requireAppUser`, and run page queries in parallel.

## 2026-11-24 · Week 3 (extra) · Live: new default categories, Vercel functions in Tokyo
- **What:**
  - Applied `20261124120000_more_default_categories.sql` to live (`db push --linked`, after a dry run; owner's go). The live database is up to date.
  - The owner set Vercel's Function Region to **Tokyo (`hnd1`)** in the dashboard, next to the Supabase project (`ap-northeast-1`).
- **Why the region:** the phone felt slow. With no region set, Vercel runs functions in US East (`iad1`), so every database call went from the US to Tokyo and back, several times per page. Moving Supabase to Singapore was considered and rejected: a Supabase region can't be changed in place (new project, move data and auth users, redo Google and Resend), and Manila is about as close to Tokyo as to Singapore.
- **Files:** none. The region is set in the Vercel dashboard, not in a `vercel.json`.
- **Tests:** the dry run, then the push; a second dry run says "Remote database is up to date." Not yet checked in the live app.
- **Open:**
  - Push the code (`main` is ahead of `origin`): until then, the live site shows a tag icon for Meals, Groceries, Market and Subscriptions.
  - After the deploy, check `x-vercel-id` shows `hnd1` and whether the app feels faster.
  - Optional speed-up: `requireAppUser` could use `getClaims()` instead of `getUser()`, saving one Supabase Auth call per page.

## 2026-11-24 · Week 3 (extra) · More default categories
- **What:** New sign-ups get 19 categories instead of 16:
  - **Needs:** Food is renamed **Meals** (utensils icon). **Groceries** (cart) and **Market** (store) are new.
  - **Wants:** **Subscriptions** (TV) is new.
  - Existing accounts get the same changes.
- **Files:**
  - New: `supabase/migrations/20261124120000_more_default_categories.sql`
  - Edited: `src/lib/validation/category.ts` and `src/components/transactions/category-grid.tsx` (4 new icons, 24 in all), `tests/db/categories.test.ts`, `transactions.test.ts`, `delete-category.test.ts` (Food → Meals, 16 → 19), `docs/designs/more-and-categories.md` §2 and §4
- **Decisions (owner, Nov 24):**
  - **Emergency Fund and Sinking Funds aren't categories.** They hold a balance, so they become default savings pots in Week 4. As expense categories they'd lower Cash now with no balance to show. **Week 4: add them as default pots.**
  - **Food → Meals,** so Meals, Groceries and Market don't overlap. Existing accounts: renamed only where it's still called "Food" and no Meals exists, and the icon changes only if it's still the basket. Its transactions keep their category.
  - **Existing accounts get only the 3 new categories,** not a re-run of `add_default_categories()`, which would bring back defaults someone deleted.
  - **Icons:** Meals, Cart, Store and TV were added to the picker, because every default's icon must be offered or Edit can't save it.
- **Side effects:**
  - A brand-new user's first 5 grid tiles (Needs A–Z with no history) are now Bills, Groceries, Health, Load & data, Market. Meals and Transport move behind More until they're used. "Most used" takes over after a few expenses.
  - Someone who renamed Food to something else keeps that name and doesn't get a Meals.
- **Tests:** 146 database tests and 289 unit tests pass, plus lint, typecheck and the build. On local, all 473 accounts have the 3 new categories and no "Food" is left (472 Meals; one test account never had Food).
- **Live:** applied to local only. It needs a dry run and the owner's go for live.

## 2026-11-24 · Week 3 · `delete_category` migration on live
- **What:** Applied `20261124093000_delete_category.sql` to the live project with `npx supabase db push --linked`, after a dry run that listed only this migration (owner's go).
- **Files:** none changed. `types.ts` regenerated from live (`--linked`) matched the hand-added `delete_category` entry exactly.
- **Decisions:** Pass `--linked` explicitly: the CLI warns that `db push` will target local by default in its next major version.
- **Tests:** the dry run, then the push reported "Finished". Not yet tried in the live app.
- **Next:** push the code (3h is on `main`, not pushed), then the 3g live check: log a real expense on your phone in under 10 seconds, and try deleting a test category.

## 2026-11-24 · Week 3 · 3h-3 New category from the category picker
- **What:** The picker ends with a dashed **New category** tile. It opens New category inside the add sheet (title "New category", back arrow to the picker). After **Save category**, the sheet's categories reload and the expense form comes back with the new category selected in the grid.
- **Files:** `src/components/transactions/category-picker.tsx`, `expense-form.tsx`, `add-transaction-provider.tsx`, `src/components/categories/category-form.tsx`
- **Decisions:**
  - **Back to the expense form, not the picker** (owner, Nov 24): picking from the picker returns to the form anyway, so this saves a tap. activity.md §4 says "returns here [the picker]".
  - **One `view` instead of `picking`:** the provider now holds `"form" | "picker" | "new-category"`. The back arrow and Esc go one step back (New category → picker → form).
  - **The search text becomes the starting name:** searching "Pet" with no match, then New category, starts the name as "Pet". The tile shows while searching too.
  - **Save stays busy until the categories reload,** so the grid never comes back without the new tile. If the reload fails, the id is still selected and saving still works.
  - The tile copies the grid's dashed More style.
- **Tests:** no new pure logic. 289 unit tests, lint, typecheck and the build pass. Not browser-checked.
- **Next:** apply `20261124093000_delete_category.sql` to live (dry run first, owner's go), then 3g live check.

## 2026-11-24 · Week 3 · 3h-2 Delete a category (level 2)
- **What:** Edit category has a **Delete category** link. Its dialog shows the category, says what uses it ("12 transactions (₱3,400) use Fun."), and when anything does, requires **Move them to** (a select grouped by Needs / Wants / Savings & debt payoff). It shows the effect: "₱3,400 moves to Food and counts as Needs." Then **Delete category** or **Keep it**, and back to the list.
- **Files:**
  - New: `supabase/migrations/20261124093000_delete_category.sql`, `src/components/categories/delete-category-dialog.tsx`, `tests/db/delete-category.test.ts`
  - Edited: `src/app/(app)/settings/categories/actions.ts` (`deleteCategory`), `edit/page.tsx`, `src/lib/categories.ts` (`categoryUsage`), `tests/lib/categories.test.ts`, `src/lib/supabase/types.ts` (the new function, added by hand)
- **Decisions:**
  - **`delete_category(target_category, move_to)`** is `security invoker`, so RLS and the column grants still apply. It moves the transactions, then deletes, in one call (one database transaction). It refuses system categories (42501), a missing category (P0002), and a missing or bad destination (22023): itself, a system category, another kind, or someone else's.
  - **Soft-deleted transactions move too:** they still point at the category, and Undo can bring them back. If only deleted ones use it, the dialog says so and still asks where they go.
  - **Destinations:** the user's other non-system categories of the same kind (Savings pot and Extra debt payment are left out).
  - **No undo** (level 2); the required choice is the safety net. No toast: the toast lives in the add sheet.
  - **Types:** the local generator formats the whole file differently, so only the `delete_category` entry was added by hand. Regenerate from live after the migration is applied there.
- **Tests:** 3 new unit tests (`categoryUsage`) and 8 new database tests (unused delete, move with a soft-deleted row, bad destinations change nothing, system category, already gone, user A vs B, logged out). 289 unit and 146 database tests pass, plus lint, typecheck and the build. Not browser-checked.
- **Live:** the migration is applied to **local only**. It needs the owner's go to apply to live before this is pushed.
- **Next:** 3h-3, the New category tile in the picker.

## 2026-11-24 · Week 3 · 3h-1 Category list, New and Edit category
- **What:** Users can see, add and edit their categories.
  - **Category list** (`/settings/categories`): Needs, Wants, Savings & debt payoff (each with the budget's target), then Income categories, plus a dashed **+ New category** button. Each row has the icon tile and name and opens Edit. System rows show a lock and what they're for, and aren't links.
  - **New / Edit category** (`/settings/categories/new`, `/settings/categories/edit?id=…`): preview card, name, group radios with the target %, 20 icons, 6 colours, then **Save category** / **Save changes**, which return to the list.
  - **Reached from:** More › BUDGET › Categories (mobile) and a Manage categories link on Settings (desktop).
- **Files:**
  - New: `src/lib/validation/category.ts`, `src/lib/categories.ts`, `src/components/categories/category-form.tsx`, `category-list.tsx`, `src/app/(app)/settings/categories/actions.ts`, `page.tsx`, `new/page.tsx`, `edit/page.tsx`, `tests/lib/validation/category.test.ts`, `tests/lib/categories.test.ts`
  - Edited: `src/app/(app)/more/page.tsx`, `src/app/(app)/settings/page.tsx`, `src/components/transactions/category-grid.tsx` (a 56px `lg` tile for the preview)
- **Decisions (owner, Nov 24):**
  - **Budget per payday is hidden until Week 5:** nothing reads `default_budget` before `generatePlan()`. Saving never touches it.
  - **System categories are read-only** in the list (lock icon, no Edit). `updateCategory` also filters `system_key is null` and `kind = 'expense'`.
  - **Edit is a query string, not `[id]`:** a dynamic segment failed the build, because the app shell's `usePathname()` can't be prerendered for it.
  - **Duplicate names:** Postgres 23505 from the unique index → "You already have a category called Food." on the name field.
  - **List order:** A–Z inside each group (ignoring case), system categories last (`categoryListSections`).
  - **No peso effect line:** with the budget field hidden there's no money to show; the preview card shows the result instead.
  - **Desktop:** the header has a **+ New category** sticker on the list and an "All categories" back link on New/Edit.
- **Tests:** 8 new unit tests (schema and list sections); 286 pass, plus lint, typecheck and the build. Not browser-checked yet: the throwaway check was skipped (reading `.env.local` was blocked), so test by hand (below).
- **AI notes:** Claude first built edit as `[id]/page.tsx`; the build caught the prerender error and it moved to `edit?id=`. It also first exported a constant from a `"use client"` file, which a server page would get as a client reference; that constant moved to `lib/categories.ts`. `npm run test` fails in Git Bash ("Cannot read properties of undefined (reading 'config')" on every suite) but passes in PowerShell. Looks like a path-casing quirk of the shell, not the code.
- **Next:** 3h-2, level 2 delete with the `delete_category()` migration.

## 2026-11-23 · Week 3 · 3f Dashboard with real numbers
- **What:** The Dashboard shows real money:
  - **Cash now (the hero):** the pay prompt with **I got paid**, the spend bar ("₱230 out so far" "of ₱30,760"), and Carry-in · Income · Money out.
  - **Income this period:** received of expected, then each source with Received or Expected.
  - **Recent activity:** the last 4 transactions with See all, or an empty state with **Log an expense**.
  - **Desktop:** two columns.
- **Files:**
  - New: `src/components/dashboard/cash-card.tsx`, `income-card.tsx`, `recent-activity.tsx`
  - Edited: `src/app/(app)/dashboard/page.tsx`, `src/lib/money.ts` (`dashboardNumbers`), `tests/lib/money.test.ts`, `src/components/activity/activity-list.tsx` (shared `RowSummary`)
- **Decisions:**
  - **The hero says "Cash now",** with no per-day pill (owner). Safe to spend is cash now minus what's still due, and nothing can be planned as due before Week 5, so the card never claims the bills are covered.
  - **Carry-in** = the opening balance + every earlier period's net, until Week 6's carry-over (owner).
  - **Money out** = spending + debt payments, the same as Activity. **From Week 4 the Dashboard counts transfers to pots in money out, as the spec says (owner).** Activity keeps showing them separately as To savings.
  - **Where the numbers live:** `dashboardNumbers()` is in `lib/money.ts` (dashboard.md, decided Nov 19). It's built on `cashOnHand` and `periodTotals`, and a test checks that it equals Activity's totals and `cashOnHand` over every row.
  - **The third small stat** is Money out instead of the spec's Cash now, which is already the big number.
  - **Pay prompt:** "₱25,000 from Main job is due today." on the payday, else "was due Nov 15." It uses `duePay`, the same as Activity's empty state.
  - **Income card:** "received" includes one-time income (Activity's Money in), so it can be more than expected. Onboarding's counted pay adds "Your 15th pay is already in your starting balance."
  - **Recent rows** reuse Activity's row look (`RowSummary`) with the day added. They aren't buttons; editing lives in Activity.
  - **Left for later:** Due this period, Spending, Savings pots and 50/30/20 (Weeks 4-5).
- **Tests:**
  - New unit tests for `dashboardNumbers` (carry-in, deleted rows, savings and withdrawals, no opening balance, the spend bar's limits, and equality with Activity and `cashOnHand`). 278 unit tests pass, plus lint, typecheck and the build.
  - Throwaway browser check (local, Edge, 390px and 1280px, light and dark):
    - **Seeded numbers:** carry-in ₱28,760, Cash now ₱30,530, ₱230 out of ₱30,760.
    - **I got paid:** saving it gives Cash now ₱55,530, removes the prompt and marks Main job Received.
    - **Done when:** Activity shows the same Money in (₱27,000) and Money out (₱230).
    - **New account:** Cash now is the ₱5,000 opening balance, Recent activity is empty, and **Log an expense** works.
    - **All 8 browser checks** pass together.
- **AI notes / open items:**
  - **Hydration warning:** the dev overlay showed "A tree hydrated but some attributes… didn't match" from the sidebar's ThemeToggle (a radio's `checked`), during one navigation in the Dashboard check. That component is from Week 2 and wasn't changed here. Look into it separately.
- **Next:** 3g live check. The Week 3 migrations are already live; push the code so Vercel deploys it, then log a real expense on a phone in under 10 seconds.

## 2026-11-23 · Week 3 · 3e-2 Edit and delete transactions
- **What:** Every Activity row can be edited and deleted.
  - **Mobile:** tap the row to edit it, plus a Delete button.
  - **Desktop:** Edit and Delete buttons in an Actions column.
  - **Edit transaction** reuses the add sheet, filled in from the row, with **Save changes** and a **Delete transaction** link.
  - **Delete:** the level 1 dialog (the item, its effect in pesos, then **Delete transaction** or **Keep it**). Then "Lunch deleted" with Undo.
- **Files:**
  - New: `src/components/transactions/delete-transaction-dialog.tsx`, `delete-link.tsx`, `sheet-impact.ts`
  - Edited: `add-transaction-provider.tsx`, `expense-form.tsx`, `income-form.tsx`, `src/components/activity/activity-list.tsx`, `src/app/(app)/activity/page.tsx`, `src/app/(app)/activity/actions.ts`, `src/lib/transactions.ts` (+ tests)
- **Decisions:**
  - **Mobile rows:** the row is the Edit button ("Edit Lunch, −₱180"), with a 44px Delete button beside it (owner). Swipe stays in `V1.1.md`.
  - **Edit mode:**
    - The type tabs are hidden, because a row's type can't change.
    - The sheet waits for the row, so the form starts filled in. Focus goes to the sheet, not the amount, so the phone keyboard doesn't cover the form.
    - Picking another source keeps the saved amount.
    - A row whose source no longer pays still shows that source as a card.
  - **Edit impact line:** counts only the change ("Money out this period: ₱230 → ₱250"). A new date in another period shows "Moves to Oct 30 – Nov 14." and saving moves the row there (`getOrCreatePeriod`). For an older period it says "Money out in Oct 30 – Nov 14: …". `editImpact` does the math; `sheet-impact.ts` words it for both forms.
  - **Server:** `saveExpense` and `updateExpense` share one write, as do `saveIncome` and `updateIncome`, so edits get exactly the same checks. An update also checks that the row still exists, isn't deleted, and has the same type. Ids are checked as UUIDs.
  - **Delete:** a soft delete, and Undo clears `deleted_at` (`restoreTransaction`).
    - The dialog reuses `ConfirmDelete`: Keep it is focused first, and Esc keeps the row.
    - The effect uses every row in the period, not only the filtered ones.
    - Delete inside Edit closes the sheet and opens the dialog, the same as Delete income source.
  - **Left out:**
    - "Food budget left" and "₱180 is back in your Food budget" (Week 5).
    - The toast's countdown line (owner: leave it).
  - **Your duplicate "Bonus":** left for you to delete with the new button (owner).
- **Tests:**
  - New unit tests for `editImpact` (edit, delete, income and savings). 272 unit tests pass, plus lint, typecheck and the build.
  - Throwaway browser check (local, Edge, 390px and 1280px):
    - **Editing an amount:** ₱180 → ₱200 updates the row and the totals.
    - **Changing a date:** moves the row to the previous period (checked in the database).
    - **Delete:** Keep it leaves the row; Delete removes it and updates the totals, and Undo brings it back.
    - **One-time income:** renaming it works.
    - **Delete from inside Edit:** works.
    - **An older period:** its effect line is worded for that period.
    - **Desktop:** the Actions column opens Edit with Main job selected.
    - **Earlier checks:** all 6 browser checks pass together.
- **AI notes:**
  - Claude's test used a loose "Name" locator that also matched "Search notes or names".
  - **One dev-server error:** "Switched to client rendering… useAddTransaction must be used inside AddTransactionProvider". It appeared once, on the first `/activity` render after the code changed, with 4 browsers hitting the dev server at once. It didn't come back in two more full runs, so it looks like a dev-only hot-reload hiccup. Watch for it in the 3g live check.
- **Next:** 3f Dashboard: expected vs actual income, spent, and available (`cashOnHand`) for this period.

## 2026-11-23 · Week 3 · 3e-1 Activity list
- **What:** `/activity` is now the real list:
  - Period bar with previous and next arrows.
  - Totals: Money in and Money out on mobile; Money in, Spending and To savings on desktop.
  - Chips: All, Spending, Income, Savings.
  - Search, opened from a header button on mobile and always shown on desktop.
  - Day groups with each day's net. On desktop: a table and a category select.
  - The empty state, with **Log an expense**, **I got paid ₱25,000** and the starting-balance note.
- **Files:**
  - New: `src/lib/activity.ts`, `tests/lib/activity.test.ts`, `src/components/activity/` (`activity-list.tsx`, `activity-empty.tsx`, `period-bar.tsx`, `search-context.tsx`)
  - Edited: `src/app/(app)/activity/page.tsx`, `src/lib/income.ts` (+ tests), `add-transaction-provider.tsx`, `income-form.tsx`, `category-grid.tsx`, `src/components/shell/page-header.tsx`
  - Docs: `docs/V1.1.md`, `docs/designs/activity.md`
- **Decisions:**
  - **URL:** `/activity?period=<any day>` instead of `/activity/[periodId]` (owner). Browsing past periods only reads, and the current period is created like the Dashboard does. Out-of-range or broken dates fall back to the current period, or the first one. `activity.md` is updated.
  - **The whole period loads at once** (up to 500 rows), and filtering happens in the browser (owner). 50-at-a-time loading and the desktop side panel moved to `V1.1.md` (owner).
  - **Row names:**
    - An expense is named by its note, else its category ("Food · Expense").
    - Pay from a source is named by the source.
    - One-time income is named by its note, with "Income · One-time".
    - Pay whose source was deleted is "Income".
  - **Chips** are the four desktop types on both widths (fix #2). Spending covers expenses and debt payments. The category select is desktop only, as the spec says.
  - **Day headings** are "Today, Nov 23", "Nov 22", with the year added for other years. The net is inside the `<h3>` (with a hidden "Net" for screen readers), so it's read with the day.
  - **Period bar:** previous stops at the first period and next at the current one. At either end the arrow stays in place but disabled, so the dates don't shift.
  - **Empty state:**
    - **I got paid** uses `duePay`: the first source paying this period that isn't received. It opens Income with that source and its amount filled in, through the new `openAddSheet({ amount })`.
    - Its buttons show only for the current period. The starting-balance note shows only in the first period.
    - Habit 3 uses the "edit and delete buttons" wording (no swipe). Those buttons come in 3e-2.
  - **Mobile search:** the button sits in the page header and shares state with the list through `ActivitySearchProvider`. `PageHeader`'s "title" style now takes an action.
- **Tests:**
  - New unit tests for `rowLabels`, `typeLabel`, `filterRows`, `dayHeading`, `resolvePeriod`, `periodNav` and `duePay`. 268 unit tests pass, plus lint, typecheck and the build.
  - Throwaway browser check (local, Edge, 390px and 1280px) on seeded rows in two periods:
    - Totals, day headings and nets, and row names are right.
    - Chips and search filter correctly, including the no-match state and "Clear filters".
    - Previous and next periods work, including the first period and a URL past today.
    - The desktop table works, including the category select.
    - Empty state: **I got paid** opens Income with Main job and ₱25,000 filled in, and saving it replaces the empty state.
- **AI notes:** Three of Claude's test steps were wrong, not the app:
  - Seeding inserted a period the Dashboard had already created.
  - A totals check didn't allow for the hidden desktop label "Spending" in the text.
  - A bash heredoc broke on quoting, so the spec was written with the editor instead.
- **Next:** 3e-2 edit and delete: Edit and Delete on every row, "Edit transaction" in the sheet, the level 1 delete dialog and Undo. Then delete the owner's duplicate "Bonus".

## 2026-11-23 · Week 3 · 3d-2 Income screen: Received, Recently received, Log one-time income
- **What:** The Income screen now shows what actually came in:
  - **Status lines** on each source card ("15th: Received Nov 23", "30th: Expected Nov 30").
  - **RECENTLY RECEIVED:** the last 4 pays from sources, each with a result line.
  - **Log one-time income:** opens the add sheet on Income with One-time income chosen.
  - **Desktop Upcoming paydays:** says Received or Expected.
- **Files:** `src/app/(app)/income/page.tsx`, `src/lib/income.ts`, `tests/lib/income.test.ts`, `src/components/transactions/add-transaction-provider.tsx`, `income-form.tsx`.
- **Decisions:**
  - **Status lines:** at most two (owner).
    - This period's payday, if the source pays in it: Received with the date it arrived, or Expected.
    - Then the next payday it pays on.
    - In the first period, pay that onboarding counted (3.14) shows Received on the payday's date.
  - **Results compare against the source's current amount** (owner), because past amounts aren't stored. "Received as expected", "₱500 less than expected" (warning pill) or "₱500 more than expected" (positive pill). Pills instead of coloured text, because `warn-fg` doesn't change for dark mode.
  - **Recently received includes one-time income** with a neutral "One-time" pill and its name ("Nov 23 · Bonus") (owner, changed after testing). The spec said "from sources", which left one-time income with nowhere to show until Activity (3e). `income.md` §2 is updated.
  - **Upcoming paydays:** the current payday is Received once every source paying on it is logged (owner).
  - **`openAddSheet({ tab, incomeSource })`** replaces `openAddExpense`. The + button still opens on Expense.
  - **Period:** the page uses `getOrCreatePeriod` for the current period, like the Dashboard.
  - **New helpers:** `receivedOn` (when each source's pay arrived) is new, and `receivedSourceIds` now uses it.
- **Tests:**
  - New unit tests for `receivedOn`, `sourceStatusLines` (including weekly and a source ending mid-period), `incomeResult` and Received in `upcomingPaydays`. 253 unit tests pass, plus lint, typecheck and the build.
  - Throwaway browser check (local, Edge, 390px and 1280px):
    - **Status lines:** they read right before and after logging pay.
    - **Log one-time income:** opens Income with One-time checked, Name showing and the amount focused. One-time income appears in Recently received with the One-time pill.
    - **Short pay:** ₱24,500 against ₱25,000 shows "₱500 less than expected".
    - **Upcoming paydays:** Nov 15 says Received and Nov 30 says Expected.
    - **Earlier flows:** the expense and income flows still pass.
    - **Dark mode:** checked.
- **AI notes:**
  - Claude first coloured the "less than expected" text with `warn-fg`, which would be unreadable in dark mode. It switched to the status pill before testing.
  - The owner logged one-time income and saw nothing change, because the screen only showed pay from sources. Claude hadn't flagged that gap in the plan.
  - **Open:** the owner has a duplicate "Bonus" ₱2,000 on local. Delete it once 3e adds delete.
- **Next:** 3e Activity list.

## 2026-11-23 · Week 3 · 3d-1 Income tab in the add sheet
- **What:** The add sheet has Expense and Income tabs. Income has the amount, "Where is it from?" (source cards plus One-time income), Date received, a "Money in this period" impact line and **Save income**. After saving, the toast reads "Income saved · +₱25,000" with Undo.
- **Files:**
  - New: `src/components/transactions/income-form.tsx`, `type-tabs.tsx`, `amount-field.tsx`
  - Edited: `add-transaction-provider.tsx`, `expense-form.tsx`, `date-button.tsx`, `src/app/(app)/activity/actions.ts`, `src/lib/income.ts`, `src/lib/transactions.ts`, `src/lib/validation/transaction.ts`, plus the tests for the last three
- **Decisions:**
  - **Split:** 3d is now two parts; 3d-2 covers the Income screen (owner).
  - **Always opens on Expense,** not the last tab used as the spec says, so logging spending stays fast after a payday (owner).
  - **Picking a source fills its amount** only if the amount is empty or was filled by an earlier pick. It never overwrites what you typed (owner).
  - **Amount carries over** when switching tabs.
  - **One-time income needs a Name,** saved as the note. This was my recommendation; the owner didn't answer this one, so it's flagged in the reply.
  - **Category:** income always uses the locked Income category, set on the server. The source must belong to this budget and not have ended before the date.
  - **Source cards:** sources active today. "₱25,000 expected · Nov 15" when the source pays this period, "· next on Nov 30" when it doesn't (`sourcePayday`).
  - **Received tag:** live income from that source this period, or every source paying in the first period when onboarding's `first_pay_received` is true (3.14 as changed, `receivedSourceIds`).
  - **Tabs** follow the WAI-ARIA tabs pattern: arrow keys switch, and only the selected tab is in the Tab order.
  - **Refactors:** `getAddExpenseData` is now `getAddSheetData` (both tabs). The amount and date rules are shared between the expense and income schemas, and the big amount input is a shared `AmountField`.
  - **Left for later:** "Safe to spend goes from…" and "Help me give this money a job" (both Week 5).
- **Tests:**
  - New unit tests for `incomeSchemaFor`, `moneyInImpact`, `sourcePayday` (including weekly, monthly and mid-period starts) and `receivedSourceIds`. 244 unit tests pass, plus lint, typecheck and the build.
  - Throwaway browser check (local, Edge, 390px):
    - **Tabs:** they switch with a click and with the arrow keys, and the typed amount is kept.
    - **Source cards:** the lines read right.
    - **Fill rule:** a pick doesn't overwrite a typed "500", but it does replace an auto-filled "8,000".
    - **Saving pay:** the row has the source and the Income category. On reopen the sheet starts on Expense and Main job shows Received.
    - **One-time income:** with no name it shows the error and focuses Name. Saved with a name, the note is "13th month pay". Undo soft-deletes it.
    - **Expense flow:** still passes.
    - **Dark mode:** checked.
- **AI notes:**
  - Lint caught two places reading a ref during render, the carried amount and the auto-fill memory. Both are now state set in event handlers.
  - Two of Claude's test checks were wrong, not the app: a monthly fixture whose source started after the payday, and a "Received" match that also hit "Date received".
- **Next:** 3d-2 Income screen: Received and Expected status lines, Recently received, and **Log one-time income**, which opens the sheet on Income with One-time selected.

## 2026-11-23 · Week 3 · 3c-2 Category picker and category colours
- **What:** More in the Add expense sheet now opens "Choose a category". It has a search field, a RECENT row (your last 4) and one section per group with the budget's target ("NEEDS · 50% target"). Category icons now show their colour, in light and dark.
- **Files:**
  - New: `src/components/transactions/category-picker.tsx`
  - Edited: `category-grid.tsx`, `expense-form.tsx`, `add-transaction-provider.tsx`, `src/components/sheet.tsx`, `src/app/(app)/activity/actions.ts`, `src/lib/transactions.ts`, `tests/lib/transactions.test.ts`, `src/app/globals.css`, `docs/designs/style-guide.md`
- **Decisions:**
  - **One sheet, two views:** the picker replaces the form inside the same sheet. The form stays mounted but hidden, so the amount, date and note are kept. The title changes and a back arrow appears. Esc goes back to the form instead of closing the sheet. Focus goes to the picker on open (not the search field, which would pop the phone keyboard over the tiles), and back to the chosen tile or More afterwards.
  - **Grid:** a category picked from More that isn't in your top 5 takes the 5th tile's place, so the choice is visible (`gridCategories`).
  - **Empty groups are hidden.** For now that's always Savings & debt payoff, because its two categories are system ones (owner).
  - **Targets** come from the budget's `needs_pct`, `wants_pct` and `savings_debt_pct`.
  - **Colour tokens:** `cat-{colour}-bg` and `cat-{colour}-fg`. Light values are from more-and-categories.md §2. Dark values are new (owner approved) and were added to the style guide. Icon contrast is 4.8–9.2:1.
  - **Tiles use `aria-pressed`, not the spec's `aria-current`:** they're toggle buttons, the same as in the grid (activity.md §6).
  - **Left for later:** the New category tile (3h, owner) and "₱X left" on tiles (needs the Plan, Week 5).
- **Tests:**
  - New unit tests for `recentCategories`, `groupCategories` and `gridCategories`. 230 unit tests pass, plus lint, typecheck and the build.
  - Throwaway browser check (local, Edge, 390px and 1280px):
    - The picker opens and gets focus. RECENT and the two group headings show, with 14 tiles and no Savings pot.
    - Search: "tra" finds 2, and "zzz" shows the no-match line.
    - Esc and the back arrow both return to the form with "75" still typed, and focus lands on More.
    - Picking Travel shows it selected and focused in the grid. Saving stores it as Travel.
    - No console errors.
- **AI notes:**
  - The colours didn't show at first. The dev build (Turbopack) silently dropped every declaration after an en dash (–) inside a CSS comment in `globals.css`. Plain ASCII in comments fixed it. Keep `globals.css` comments ASCII.
  - Claude's first test step tapped Transport, which isn't in a new user's top 5. That was a test bug, not an app bug.
- **Next:** 3d Income tab.

## 2026-11-23 · Week 3 (extra) · Fix the `Date.now()` prerender error
- **What:** Dev showed "Next.js encountered the unstable value `Date.now()` while prerendering" on Dashboard, Income and More. It's gone.
- **Files:** `src/lib/supabase/server.ts`.
- **Decisions:**
  - **Cause:** Supabase's auth code reads the clock to check the session's expiry before each query. The sidebar's profile chip (on every app page) and the greeting query Supabase, and Cache Components refuses clock reads that aren't clearly per-request.
  - **Fix:** `createClient()` now calls `await connection()` right after `cookies()`, so every server-side Supabase user is request-time. These pages already were (they read cookies), so nothing changes for users.
- **Tests:**
  - Lint, typecheck, build and 218 unit tests pass.
  - **Browser check (local, Edge):** log in, add an expense, then visit Income, More, Activity and Dashboard. There were no console errors. With the line commented out, the error came back on Dashboard, Income and More.
- **AI notes:** At first this looked like a Dashboard problem, but the stack trace pointed at the sidebar. The error shows on whichever app page is opened.
- **Next:** 3c-2, the category picker and category colour tokens.

## 2026-11-23 · Week 3 · 3c-1: Add expense sheet and saving
- **What:** The mobile + and the desktop "+ Add transaction" now open an Add expense sheet over any app page. You type an amount, tap a category and Save, and a toast says "Expense saved · −₱180" with Undo.
- **Files:**
  - New: `src/app/(app)/activity/actions.ts`, `src/components/transactions/{add-transaction-provider,expense-form,category-grid,date-button}.tsx`, `src/components/toast.tsx`.
  - Changed: `src/lib/transactions.ts` and its tests (`topCategories`, `moneyOutImpact`), `src/components/sheet.tsx` (optional `initialFocus`), `src/components/shell/{bottom-bar,page-header,nav-items}`, `src/app/(app)/layout.tsx`, `docs/week-3-tasks.md`.
- **Decisions (owner, Nov 23):**
  - **Grid:** "Most used" counts your last 200 expenses. Ties go Needs first, then A to Z, so a new user sees Bills, Food, Health, Load & data, Padala. Income and system categories are never offered.
  - **Impact line:** "Money out this period: ₱X → ₱Y". A date in an earlier period shows "Goes in Nov 1 – 14." instead.
  - **More:** shows every category in the grid until the 3c-2 picker exists.
  - **No type tabs yet:** 3d adds Income.
  - **Loading:** the sheet loads its data when it opens (Server Action). The amount field is focused at once and works before the data arrives, and Save waits for it.
  - **Server checks:** the action validates with the same Zod schema, refuses system categories (the database would accept Savings pot as an expense category), and saves into the period that contains the date (`getOrCreatePeriod`).
  - **Undo:** soft-deletes the row.
  - **Date:** the button opens the native picker with `showPicker()`, falling back to focusing the hidden date input.
  - **Toast:** our own. A single always-present `role="status"` region, gone after 5 seconds.
  - `Sheet` got an optional `initialFocus` ref. Without it, the Close button would get focus first. This file wasn't in the plan; it's a three-line pass-through to Base UI.
  - Tiles use neutral `track` icon backgrounds for now. There are no tokens yet for the six category colours.
- **Tests:**
  - Lint, typecheck, build and 218 unit tests pass (7 new).
  - A throwaway browser check ran against local Supabase and the dev server in Edge, at 390px. The amount is focused on open. 180 → Food → Save writes one ₱180 expense and shows the toast. Undo sets `deleted_at`. More shows all 13 categories and no system ones.
  - The amount → category → Save path took about 0.9 seconds of automated input.
- **AI notes:**
  - Lint caught a ref being written during render; it's now written in an effect.
  - The browser console shows "Route /dashboard: Next.js encountered the unstable value `Date.now()` while prerendering". It shows up without this change too (checked by stashing it), so it comes from the Dashboard and isn't part of this task.
- **Open:**
  - Category colour tokens (orange, blue, purple, yellow, red, green, in light and dark) for the tiles.
  - The Dashboard's `Date.now()` prerender error.
  - Playwright browsers aren't installed (`@playwright/test` isn't a dependency yet), so the check used the local Edge.
- **Next:** 3c-2, the category picker.

## 2026-11-23 · Week 3 · 3b: transaction math and schema
- **What:** Pure functions for signed amounts, period totals, day groups and cash on hand, plus the Zod schema for the add and edit sheet. Tests written first.
- **Files:** `src/lib/transactions.ts`, `src/lib/validation/transaction.ts`, `tests/lib/transactions.test.ts`, `tests/lib/validation/transaction.test.ts` (all new), `docs/week-3-tasks.md`.
- **Decisions (owner, Nov 23):**
  - `signedAmount` is the effect on cash. Savings flips its sign: a ₱3,000 deposit is −₱3,000 cash, and a withdrawal is +₱1,000.
  - **Totals:**
    - `periodTotals`: money in is income, and money out is spending plus debt payments.
    - "To savings" is deposits minus withdrawals and can be negative. A withdrawal isn't money in.
    - Day nets include pot moves.
  - `cashOnHand(openingBalance, rows)` covers every transaction from the first period through today. An empty opening balance counts as ₱0, and `carried_in` waits for Week 6.
  - Every function skips soft-deleted rows itself.
  - **Schema:** `transactionSchemaFor({ today, firstPeriodStart })` covers expense and income only. Savings and debt payments join in Weeks 4–5. Dates can't be in the future or before the first period, and a date that doesn't exist (Feb 30) gets one message. Notes can be up to 100 characters, and an empty note becomes null. Only income can have a source.
- **Tests:** 211 unit tests pass (24 new), and lint and typecheck pass.
- **AI notes:** The first run showed that a date that doesn't exist also got the "before your first period" message. Fixed with `abort: true` on the real-date check.
- **Also:** Pushed the `transactions` migration (3a-2) to live on the owner's go and regenerated `src/lib/supabase/types.ts`; 3a ticked.
- **Next:** 3c, the Add expense sheet.

## 2026-11-23 · Week 3 · 3a-2: `transactions` migration
- **What:** Added the `transactions` table (income, expense, savings, debt payment) with soft delete. Applied on local only.
- **Files:** `supabase/migrations/20261123141644_transactions.sql` (new), `tests/db/transactions.test.ts` (new), `docs/week-3-tasks.md`.
- **Decisions (owner, Nov 23):**
  - Amounts are above ₱0, except `savings`, which can be anything but 0 (negative = pot withdrawal, 3.5).
  - `note` is optional, 1–100 characters.
  - **Links:** period, category and income source are each linked together with `user_id`, so they must be your own. `budget_periods` and `income_sources` got `unique (id, user_id)` for this.
  - **Delete rules:**
    - Budget → periods → transactions cascade.
    - Income source: `set null (income_source_id)`, so the transaction stays.
    - Category: `no action` instead of `restrict`. Deleting a category that's in use is refused the same way, but the check runs at the end of the statement, so account deletion still works.
  - **Two triggers back up Zod:** the date must be inside its period, and the type must match the category (income ↔ income kind, the rest ↔ expense kind).
  - Savings and debt-payment category rules are left to Weeks 4–5.
  - **Permissions:** there's no hard delete through the API. Delete and Undo both edit `deleted_at`. ids, `user_id` and the timestamps can't be changed.
- **Tests:** Lint, typecheck and 187 unit tests pass; `npm run test:db` passes (138 tests, including the new transactions suite). On local, deleting a user with transactions in a rolled-back transaction left no orphan rows.
- **AI notes:** At first the category trigger would have raised its own error for someone else's category, before the foreign key could. It now leaves that case to the foreign key, so the error is the same "not yours" one as for periods and sources.
- **Live:** Applied Nov 23 with 3b (see above).
- **Next:** 3b, transaction math (tests first).

## 2026-11-23 · Week 3 (extra) · Home page goes to Log in
- **What:** `/` no longer shows the temporary theme-check page. Logged-out visitors go to Log in; logged-in users go straight to Dashboard.
- **Files:** `src/proxy.ts`, `src/app/page.tsx`.
- **Decisions:**
  - The proxy handles `/` itself, so logged-in users get one redirect, not `/` → `/login` → `/dashboard`.
  - `page.tsx` is a fallback `redirect("/login")` in case the proxy doesn't run.
  - The theme-check page was dropped (owner, Nov 23); it's in git history.
  - "Back to home" on the Privacy and Terms placeholders now lands on Log in or Dashboard.
- **Tests:** Lint, typecheck and 187 unit tests pass. On the dev server, a logged-out request to `/` returns 307 to `/login`. The owner checks the logged-in case.
- **Next:** 3a-2, the `transactions` migration.

## 2026-11-23 · Week 3 · 3a-1: `categories` migration and default categories
- **What:** Added the `categories` table. Every new sign-up gets 16 default categories: 7 Needs, 6 Wants, and the locked Income, Savings pot and Extra debt payment. Existing accounts got them too. Applied on local, then on live (owner's go, Nov 23).
- **Files:** `supabase/migrations/20261123105712_categories.sql` (new), `tests/db/categories.test.ts` (new), `src/lib/supabase/types.ts` (regenerated from live; most of the diff is the CLI's formatting), `CLAUDE.md`, `docs/mvp-brief.md`, `docs/designs/more-and-categories.md`, `docs/week-3-tasks.md`.
- **Decisions:**
  - The brief's `group` is named `budget_group`, because `group` is reserved in SQL (owner, Nov 23). The brief, the category spec and CLAUDE.md's "Choice fields" line now say `budget_group`.
  - Default icons are Lucide names. Colours are the six from `more-and-categories.md` §2, and the owner approved both on Nov 23. The system categories use icons outside the 20-icon grid (`wallet`, `piggy-bank`, `credit-card`), which is fine because the picker hides them.
  - **Locking system rows:**
    - Renaming one or changing its group is blocked by a trigger.
    - Deleting one is blocked by the RLS delete policy, so deleting the account still cascades.
    - Their icon, colour and default budget can still change.
  - **Column permissions:**
    - `system_key` and `user_id` can't be sent on insert.
    - `kind` can't change after a category is created.
  - Names are unique per user, ignoring case and outer spaces. They can be 1–30 characters. `default_budget` is empty or above ₱0.
  - `unique (id, user_id)` is ready for the same-owner links from transactions and plan items.
  - `handle_new_user()` calls a new `add_default_categories()`. If that fails, the sign-up fails, so no account is left without categories.
- **Tests:** `npm run test:db` passes (102 tests, including the new categories suite). On local, every account has its 16 defaults, and deleting a user in a rolled-back transaction left no orphan categories.
- **AI notes:** At first Claude didn't have the earlier icon and colour list in its session, so it re-proposed the list for approval rather than guessing.
- **Next:** 3a-2, the `transactions` migration.

## 2026-11-20 · Week 3 · Week 3 plan review
- **What:** Settled the Week 3 data-model questions and wrote `docs/week-3-tasks.md` (3a–3h). Started `docs/V1.1.md`.
- **Files:** `docs/mvp-brief.md` (data model, delete rules, Week 3–4 boxes), `docs/plan-review-2026-11-19.md`, `docs/week-3-tasks.md` (new), `docs/V1.1.md` (new).
- **Decisions:**
  - 3.4: `categories.system_key` (`income`, `savings_pot`, `extra_debt`). Defaults are copied per user at sign-up and are editable; custom categories are per user (option A).
  - 3.5: pot withdrawals are negative `savings` amounts.
  - 3.6: `set null` for pots, bills, debts and income sources; `restrict` for categories.
  - 3.14 changed: no income transaction from "pay already arrived", because the opening balance already has it.
  - Scope: the Savings tab moves to Week 4; the budget-left line and "Give this money a job" to Week 5; Export CSV to Week 8. Search all periods, the N shortcut and swipe go to `V1.1.md`. No mobile Bills chip.
  - Our own toast, and the browser's native date picker (also on desktop). No new dependencies.
  - The dark-mode mint overlay behind sheets and dialogs stays (owner, Nov 20).
- **Tests:** Docs only.
- **AI notes:** Claude caught that turning `first_pay_received` into an income transaction would double-count the opening balance.
- **Next:** 3a, the `categories` migration.

## 2026-11-20 · Week 2 (extra) · Loading skeletons for onboarding and Income
- **What:**
  - Onboarding steps and the Income screen now show grey skeleton blocks while their data loads, instead of a blank screen (onboarding) or a "Loading…" line (Income).
  - The owner had seen a lag between onboarding steps on live, where the screen seemed unresponsive.
- **Files:**
  - New: `src/components/skeleton.tsx` (`Skeleton`, `SkeletonRegion`), `src/components/onboarding/onboarding-skeleton.tsx` (`OnboardingSkeleton`, `OnboardingDoneSkeleton`).
  - Changed: `src/app/onboarding/{page,budget/page,income/page,start/page,done/page}.tsx`, `src/app/(app)/income/page.tsx`.
- **Decisions:**
  - Skeletons, not a spinner (app-shell.md §5; owner's call).
  - They go in each page's existing `<Suspense>` fallback, not `loading.tsx`. With Cache Components every page already has its own `<Suspense>`, so a `loading.tsx` would never show; the empty fallback was the blank moment.
  - Each skeleton matches its page's layout, and the onboarding progress bar keeps the current step filled.
  - Screen readers hear "Loading…" once (`role="status"`). The pulse is off with reduced motion.
  - Other app pages get skeletons with their features, or in Week 9's loading-states task.
- **Tests:** Lint and typecheck pass; 187 unit tests pass; the build passes and all six prerendered pages include the skeleton. The owner checks the look on a phone.
- **AI notes:** The first plan (`loading.tsx`) wouldn't have worked with Cache Components. Caught while reading the pages, before writing it.
- **Next:** Push both commits, then settle plan review 3.4–3.6 and write `week-3-tasks.md`.

## 2026-11-20 · Week 2 (extra) · Mint sticker border in dark mode
- **What:** In dark mode the sticker outline and offset shadow are now mid mint (#7FD3A3) instead of black, which disappeared on the dark background. Light mode is unchanged.
- **Files:** `src/app/globals.css`, `docs/designs/style-guide.md`.
- **Decisions:**
  - A new `--sticker` variable (black in `:root`, mint in `.dark`) feeds `border-sticker` and all three `shadow-sticker*` sizes, so no component changed.
  - The style guide said stickers "stay black in dark mode"; the owner changed that rule.
- **Tests:** Lint and typecheck pass; 187 unit tests pass. The compiled CSS has both values. The owner checked the screens.
- **AI notes:**
  - The dev server missed the last CSS edit and needed a restart.
  - Vitest must run from `C:\Projects\...` (uppercase drive); from `c:\` every suite crashes (the known Windows path bug).
- **Open:** The dimmer behind sheets and delete dialogs uses `bg-sticker/50`, so in dark mode it's now a mint wash. Suggested fix: a fixed `scrim` token. Waiting on the owner.
- **Also:** The Google consent live test passed on the owner's phone (Nov 19 night), and the live screens check out.

## 2026-11-19 · Week 2 (extra) · More › Money links on mobile
- **What:**
  - Phones had no way to reach Income. More now has the spec's MONEY section, with Income, Bills, Savings pots and Debts.
  - Income shows a live "2 sources · ₱58,000 a month".
  - The Appearance toggle moved into the spec's section style.
- **Files:** `src/app/(app)/more/money-section.tsx` (new), `src/app/(app)/more/page.tsx`.
- **Decisions:**
  - Built ahead of More's Week 3 task, from `more-and-categories.md` §1.
  - Bills, Savings pots and Debts open their placeholder pages until those features exist; their detail lines come with them.
  - The Income detail streams in after the rows appear.
- **Tests:** Lint, typecheck and the build pass. With a test user, More shows all four links, "2 sources · ₱58,000 a month", Appearance and Log out.
- **AI notes:** The Income screen (2e-1) went in without a mobile way to reach it. The owner found it.
- **Next:** Push, then check Week 2's "done when" on live.

## 2026-11-19 · Week 2 · Week 2 complete (end of day)
- **What:** All six Week 2 boxes are ticked in `mvp-brief.md` (owner's call), and every task in `week-2-tasks.md` is done.
- **Open for next session:**
  - Open the live dashboard after this push and confirm the "done when": the right period, plus expected income that differs on the 15th and 30th.
  - Plan Week 3 (transactions). First settle plan review 3.4–3.6 (system categories, pot withdrawals, what happens to history when something is deleted), then write `week-3-tasks.md`.
  - Still open from before:
    - plan review 4.4–4.9 and 5.1–5.7
    - starting `V1.1.md`
    - the Google consent live test
    - a dark-mode readability pass across screens
    - trying Vitest 5.1.1 after Dec 2 for the Windows path bug

## 2026-11-19 · Week 2 · 2f Dashboard header
- **What:**
  - The dashboard shows this period's dates ("Nov 15 – 29") and "15th payday · 10 days left".
  - A hero card with this period's expected income and the sources landing on this payday.
  - "Already in your starting balance" when onboarding said the pay had arrived.
  - Opening the dashboard creates the period row on first open (`getOrCreatePeriod`).
- **Files:** `src/app/(app)/dashboard/page.tsx`, `src/lib/periods.ts` (`daysLeft`, `periodStatusLine`), `tests/lib/periods.test.ts`, `docs/week-2-tasks.md`.
- **Decisions:**
  - Days left counts today, using Manila calendar dates (dashboard.md §1).
  - Future periods say "Starts Nov 30"; past ones say "Ended Nov 14".
  - The period switcher's arrows wait for Plan (Week 5), because moving periods opens that period's plan.
  - Safe to spend and the other dashboard sections need transactions and plans (Weeks 3–5).
- **Tests:**
  - Written first and failing. 187 unit tests pass; lint, typecheck and the build pass.
  - Locally with a test user:
    - On the 15th period: ₱25,000, with the 30th-only source left out.
    - On payday 2: ₱33,000 with it included.
    - Two opens make one period row.
- **AI notes:** None.
- **Next:** The owner checks it, then a push, and Week 2's "done when" is checked on live.

## 2026-11-19 · Week 2 · 2e-2 Delete income source
- **What:**
  - Edit income source now has a "Delete income source" link. It opens "Delete Main job?" with the item, its effect in pesos (for example "Each month: ₱58,000 → ₱8,000"), and Keep it, which is focused first.
  - The red "Delete income source" button.
  - "Stopped getting this? End it instead" opens Edit with the Ends field focused.
- **Files:**
  - New: `src/components/confirm-delete.tsx`, a reusable delete confirmation for later deletes.
  - Changed: `src/app/(app)/income/income-sheet.tsx` (the `?delete=` address and the dialog), `src/app/(app)/income/actions.ts` (`deleteIncomeSource`), `src/components/income/income-form.tsx` (`onDeleteRequest`, `focusEnd`), `src/lib/income.ts` (`removalImpact`).
  - Tests: `tests/lib/income.test.ts`.
- **Decisions:**
  - Built on Base UI's AlertDialog, so screen readers announce it as a warning. Focus starts on Keep it, and Esc keeps the item.
  - On phones, a bottom sheet with red on top; on desktop, a centered dialog with red on the right.
  - A source that isn't paying now says expected income doesn't change.
  - Deleting something that's already gone shows "no longer exists".
  - There's no choice step yet, because nothing points at income sources until Week 3 (plan review 3.6).
- **Tests:**
  - Written first and failing. 178 unit tests pass; lint, typecheck and the build pass.
  - The Income page loads with the delete, end and unknown-id addresses.
  - The dialog and the delete itself need the owner's check by eye.
- **AI notes:** None.
- **Next:** 2f, the dashboard header. It completes Week 2's "done when".

## 2026-11-19 · Week 2 (extra) · Theme toggle
- **What:**
  - Dark mode actually turns on now. Before this, nothing added the `.dark` class.
  - Light / Dark / Match device: a three-icon switch in the desktop sidebar, and an Appearance section on More.
  - A choice applies instantly and is saved on the device and to `profiles.theme`.
  - On app pages the profile's theme wins, so it follows you to other devices.
  - "Match device" follows the device's setting live; tabs stay in step.
- **Files:**
  - New: `src/lib/theme.ts`, `src/components/theme/*` (toggle, sync, watcher, `applyTheme`, `saveThemeToProfile`), `tests/lib/theme.test.ts`.
  - Changed: `src/app/layout.tsx` (head script, `suppressHydrationWarning` on `<html>`), `src/app/(app)/layout.tsx` (profile sync), `src/components/shell/sidebar.tsx`, `src/components/shell/placeholder-page.tsx` (`children`), `src/app/(app)/more/page.tsx`.
- **Decisions:**
  - No `next-themes`: about 30 lines of our own, with no new dependency.
  - A head script sets the class before the page draws, so there's no flash.
  - On desktop, an icon switch instead of a button that opens a menu: one tap, no popup.
  - The profile wins over the device on app pages (owner's go).
  - The toggle reads the device's choice with `useSyncExternalStore`, so the server and browser renders don't disagree.
- **Tests:**
  - 10 theme tests, including running the head script against a fake page. 176 unit tests pass; lint, typecheck and the build pass.
  - Checked with a throwaway local user: the script is on every page, the toggles render on More and in the sidebar, and `profiles.theme` updates.
- **AI notes:**
  - The theme code and its tests were written together, not test-first.
  - The first toggle set state inside an effect. The React lint rule flagged it, and it was rewritten with `useSyncExternalStore`.
- **Next:** A quick dark-mode pass over the main screens, now that real users can switch. Then 2e-2.

## 2026-11-19 · Week 2 · 2e-1 Income screen: list, add and edit
- **What:**
  - `/income` shows a hero "Expected each month" card, per-payday stats, and source cards (active, starting later, ended), each opening Edit.
  - Desktop adds the schedule line, "Income sources", "+ Add income source" and an Upcoming paydays column.
  - Add and edit happen in the sheet, with Starts and an optional Ends.
- **Files:**
  - New: `src/app/(app)/income/page.tsx`, `income-sheet.tsx`, `actions.ts`.
  - Moved: the income form, from `src/app/onboarding/income/` to `src/components/income/income-form.tsx`. It now takes `onSave`, an optional `onRemove`, and an optional `withDates`.
  - Changed:
    - `src/components/shell/page-header.tsx`: `desktopTitle`, `eyebrow`, `mobileAction`, `desktopAction`, `HeaderStickerLink`.
    - `src/lib/income.ts`: `isActiveOn`, `expectedForPeriod`, `upcomingPaydays`, `monthlyAmount`, `sourceScheduleLine`.
    - `src/lib/validation/income.ts`: optional start and end dates, required on the Income screen.
    - `src/app/onboarding/income/income-step.tsx`.
  - Tests: `tests/lib/income.test.ts`, `tests/lib/validation/income.test.ts`.
- **Decisions** (the owner accepted all recommendations):
  - Split into 2e-1 and 2e-2.
  - Received parts wait for Week 3.
  - The sheet, not separate pages.
  - Deleting is a simple confirmation for now, with "End it instead".
  - Deleting the last source is allowed, with an empty state.
  - Pages can swap the header button.
  - The sheet opens from the page address, so the header button and cards are plain links (income.md §5: cards are links).
  - A source counts in a period when it's active on that period's payday.
  - The before-and-after box compares against active sources only.
- **Tests:**
  - Written first and failing. 166 unit tests pass; lint, typecheck and the build pass.
  - The Income screen rendered with a throwaway local user: empty state; ₱58,000, ₱25,000 and ₱33,000; schedule lines; the Varies and Ends tags; the Starting later and Ended groups; Upcoming paydays; the header; add and edit links.
  - Onboarding step 2 rechecked after the form move.
- **AI notes:** The first test script inserted several rows with different columns. supabase-js fills missing ones with null, so `amount_varies` failed. The script was fixed; the app was fine.
- **Next:** 2e-2, Delete income source.

## 2026-11-19 · Week 2 · 2d-3 Onboarding step 3 and Done
- **What:**
  - Step 3 "Starting point": a big starting-balance input (₱0 and negatives allowed), and "Has your Nov 15 pay already arrived?" with Yes or Not yet, no default.
  - The live "Your first period" card on desktop, and a "Ready to plan" line on mobile.
  - Finish setup creates the period, saves the answer, then saves the opening balance last.
  - The Done screen: full screen on mobile, a centered card on mint from 1024px.
  - The step placeholders are gone.
- **Files:**
  - New: `src/lib/validation/start.ts`, `src/lib/onboarding-data.ts`, `src/components/onboarding/first-period-card.tsx`, `src/app/onboarding/start/*`, `src/app/onboarding/done/page.tsx`.
  - Changed: `src/lib/income.ts` (`expectedForSlot`, `describeIncome`), `src/lib/onboarding.ts` (`firstPeriodSummary`, `periodTag`), `src/lib/periods.ts` (`formatShortDate`), `src/app/onboarding/actions.ts` (`finishOnboarding`), `src/components/segmented.tsx`.
  - Deleted: `src/components/onboarding/step-placeholder.tsx`.
  - Tests: `tests/lib/validation/start.test.ts`, plus additions to the income, onboarding and periods tests.
- **Decisions:**
  - The pay question has no default, because a wrong guess counts pay twice or not at all.
  - If the pay has arrived, the card shows "Already in balance", and Ready to plan is just the balance (`firstPeriodSummary`).
  - The "Skip, I'll add these later" link is left out for now: the optional bills, pots and debts items it skips are hidden until Weeks 4–6, so Skip would do the same as Finish.
  - Done only opens for users who finished setup.
- **Tests:**
  - Written first and failing. 155 unit tests pass; lint, typecheck and the build pass.
  - A throwaway local user was checked through step 3, then the same writes as Finish, then Done, then the dashboard. All correct.
  - The Finish button itself needs the owner's click test.
- **AI notes:** Claude's first mobile "Ready to plan" line added the numbers inside the component. Moved to `firstPeriodSummary()`, since UI never does money math.
- **Owner's decisions:**
  - Negative balances on iPhone (no minus key on the decimal keypad): leave as is for the MVP.
  - The Skip link waits for bills, pots and debts.
  - The starting balance is everything the user has now, including pay that already arrived. The app never adds it on top. The owner asked whether pay plus the extra ₱4,000 should be added; it shouldn't, because the app can't know what was spent. The field hint and the "Yes" hint now say to include it.
- **Next:** 2e, the Income screen.

## 2026-11-19 · Week 2 · 2d-2 Onboarding step 2 Income
- **What:**
  - Step 2 lists income as cards on mobile and a table on desktop.
  - Adding uses the bottom sheet on mobile and a dashed inline form on desktop. Editing opens the sheet, and Remove asks "Keep it / Remove".
  - "Expected per payday" preview; a mint before-and-after box in the form.
  - Continue is disabled until there's one income.
  - A note when a frequency change moved income to Every payday.
- **Files:**
  - New shared components: `src/components/sheet.tsx` (reusable), `money-input.tsx`, `segmented.tsx`.
  - New: `src/lib/income.ts` (`expectedIncome`, `incomeImpact`), `src/lib/validation/income.ts`.
  - Changed: `src/lib/money.ts` (`formatPesoInput`), `src/components/auth/submit-button.tsx` (`className` prop), `src/app/onboarding/actions.ts` (add, update and remove income; `saveBudget` reports moved income).
  - Step 2: `src/app/onboarding/income/*`.
  - Tests: `tests/lib/income.test.ts`, `tests/lib/validation/income.test.ts`, `tests/lib/money.test.ts`.
- **Decisions:**
  - The Sheet is built on Base UI's Dialog (already installed): a bottom sheet under 768px, a centered sticker dialog from 768px. Base UI handles the focus trap, Esc and returning focus.
  - Amounts travel as typed text and are parsed by the same Zod schema in the browser and on the server.
  - In onboarding, removing income is a plain delete, since nothing has been logged against it yet. The Income screen's delete (2e) follows the level 2 pattern.
  - A new source's start date is the current period's start (3.3).
  - The one-time-income note and the "Starts" date field are left out of onboarding; they belong to the Income screen and Week 3.
- **Tests:**
  - Written first and failing. 141 unit tests pass; lint, typecheck and the build pass.
  - Step 2 rendered with a throwaway local user: empty state, totals (15th ₱25,000, 30th ₱33,000, ₱58,000 a month), the Continue link, edit labels and the frequency note.
  - The sheet and the add, edit and remove clicks need the owner's check by eye.
- **AI notes:** Claude first had the money input tidy its text on blur by setting the input directly. That can leave the form library with the old value, so it was removed.
- **Next:** 2d-3, Step 3 and Done. Still don't deploy until it's done.

## 2026-11-19 · Week 2 · 2d-1 Onboarding frame and step 1
- **What:** The first part of onboarding:
  - `/onboarding` resumes at the first unfinished step.
  - The frame has a mobile top bar and progress bar, plus a desktop mint step rail.
  - Step 1 "Your budget" has frequency radio cards, payday fields for all three frequencies, the short-month hint, and Week starts on.
  - A live "Your next payday periods" preview built on `getPeriod()`.
  - Every app page now sends users who haven't finished setup to onboarding.
  - Steps 2 and 3 are placeholders.
- **Files:**
  - New: `src/lib/money.ts`, `src/lib/onboarding.ts`, `src/lib/current-budget.ts`, `src/lib/validation/budget.ts`, `src/lib/validation/field-errors.ts`.
  - Changed: `src/lib/periods.ts` (`nextPeriods`, `ordinal`, `paydayLabel`, `describeSchedule`), `src/lib/require-app-user.ts` (`requireConsentedUser` split out, plus the budget check), `src/proxy.ts` (`/onboarding`).
  - Onboarding: `src/components/onboarding/*`, `src/app/onboarding/*`.
  - Tests: `tests/lib/money.test.ts`, `tests/lib/onboarding.test.ts`, `tests/lib/validation/budget.test.ts`, `tests/lib/periods.test.ts`.
- **Decisions:**
  - Setup counts as finished once the budget has an opening balance, which is saved last. No extra column is needed.
  - The "not finished" check lives in `requireAppUser()` (plan review 4.1).
  - The form keeps all three payday fields while you switch frequency; `toBudgetRow()` saves only the ones used.
  - Both payday menus offer 1st–31st, as the spec says, and the schema explains bad picks.
  - Fields are 48px.
  - Money parsing works on the typed text, never through a float.
  - Owner's decisions: build a reusable sheet in 2d-2; keep all three previews; frequency changes move one-payday income to "Every payday"; the oldest budget is "yours"; always ask the mid-period question.
- **Tests:**
  - Written first and failing. 124 unit tests now pass; lint, typecheck and the production build pass.
  - A throwaway local user was checked at each stage (no budget, budget only, income, finished with ₱0). Every page redirected correctly, and logged-out `/onboarding/budget` goes to `/login`.
  - The step 1 form itself still needs the owner's check by eye.
- **AI notes:**
  - At first Claude limited the 1st payday menu to 1–27, but switching frequency could leave a saved day the menu can't show. Changed to 1–31 with the schema's error messages.
  - Don't deploy until 2d-3: live users without a budget would land on placeholder steps 2–3 and couldn't finish setup.
- **Next:** 2d-2, Step 2 Income and the reusable bottom sheet.

## 2026-11-19 · Week 2 · 2c Create a period the first time it's opened
- **What:**
  - `getOrCreatePeriod(supabase, budget, date)` returns the budget's period for a date, creating the row on first open.
  - `scheduleFromBudget()` turns a budget row into a `PaySchedule`.
- **Files:** `src/lib/budget-periods.ts` (new), `src/lib/periods.ts`, `tests/lib/periods.test.ts`, `tests/db/budget-periods.test.ts` (new), `docs/week-2-tasks.md`.
- **Decisions:**
  - Written in TypeScript with the user's own client, not as a database function. `getPeriod()` is the single source of period math.
  - The insert is `ON CONFLICT DO NOTHING` on (budget_id, start_date), then the row is read back. Repeat opens and two tabs at once give one row.
  - `carried_in` stays 0 until carry-over is built.
  - Nothing calls it yet; onboarding (2d) and the dashboard header (2f) will.
- **Tests:**
  - Written first and failing.
  - 4 new unit tests and 6 new database tests, including 5 calls at once making one row, and refusing another user's budget.
  - 66 unit and 68 database tests pass; lint and typecheck pass.
- **AI notes:** The owner said "go" before seeing the plan. Claude posted a short plan before writing code because nothing in it needed a decision (no migration or dependency).
- **Next:** 2d onboarding. Likely split into steps 1–2, then step 3 and Done.

## 2026-11-19 · Week 2 · 2b budgets, income_sources, budget_periods
- **What:** A migration for the three Week 2 tables, with RLS on all of them, plus 36 database tests. Applied to local Supabase only.
- **Files:** `supabase/migrations/20261119111038_budgets.sql`, `tests/db/budgets.test.ts`, `src/lib/supabase/types.ts` (regenerated), `docs/week-2-tasks.md`.
- **Decisions:**
  - `user_id` defaults to `auth.uid()`.
  - Income sources and periods point at their budget with `(budget_id, user_id)`. RLS alone wouldn't stop someone attaching rows to another user's budget id.
  - The payday check matches `getPeriod()`, including "payday 1 ≤ 27".
  - Users can update only the listed columns: never ids, owners, timestamps or a period's dates.
  - Deleting a budget deletes its income sources and periods.
  - Income amount must be above ₱0, even when it varies (owner).
  - Whether a pay slot fits the budget's frequency is checked with Zod in the app, not in the database (owner).
- **Tests:**
  - 62 database tests and 62 unit tests pass; lint and typecheck pass.
  - With RLS turned off locally, the four A-vs-B tests failed (plus two owner tests); RLS is back on.
  - The live dry run listed only this migration. Pushed live after the owner's go.
  - On live: RLS is on all three tables, with 4 policies each, no `anon` read access and all 5 key constraints. Migration history matches local.
- **AI notes:**
  - Claude's first draft let a missing payday pass the check: in Postgres, a check that comes out null counts as passing. Fixed with `coalesce(..., false)`, and covered by tests.
  - The first RLS-off check sent several statements in one `db query` call, and they silently didn't run. Redone one statement at a time.
- **Next:** 2c, creating a period the first time it's opened.

## 2026-11-19 · Week 2 · 2a getPeriod()
- **What:** Pure period math in `src/lib/periods.ts`:
  - `getPeriod(date, schedule)` covers semi-monthly, monthly and weekly.
  - `formatPeriodRange()` gives "Nov 15 – 29", "Nov 30 – Dec 14" and "Dec 30, 2026 – Jan 14, 2027".
  - `todayInManila()`.
- **Files:** `src/lib/periods.ts`, `tests/lib/periods.test.ts`, `package.json` and `package-lock.json` (`date-fns` 4.4.0), `docs/week-2-tasks.md`.
- **Decisions:**
  - Dates are "YYYY-MM-DD" strings in and out, so a time zone can't shift a day.
  - A payday missing from a month falls on its last day.
  - `payWeekday` numbering is 0 = Sunday, matching Postgres `extract(dow)`.
  - Semi-monthly payday 1 must be the 27th or earlier, so it can't land on the same day as payday 2 in February.
  - Ranges across years show both years (owner's choice).
- **Tests:** Written first and failing. Now 30 period tests pass, also under `TZ=America/New_York`, `Pacific/Auckland` and `UTC`. 62 unit tests in total; lint and typecheck pass.
- **AI notes:** The payday 1 ≤ 27 rule is Claude's addition; the onboarding form needs to match it.
- **Next:** 2b, the migration for `budgets`, `budget_periods` and `income_sources`.

## 2026-11-19 · Week 2 · Plan and decisions
- **What:** Settled the Week 2 items in the plan review and wrote `docs/week-2-tasks.md`, with tasks 2a–2f. The owner also turned on Vercel Deployment Checks, so production waits for the GitHub `check` job.
- **Files:** `docs/plan-review-2026-11-19.md`, `docs/week-2-tasks.md` (new), `docs/mvp-brief.md` (data model, Week 2 test cases), `docs/designs/onboarding.md`, `income.md`, `dashboard.md`, `style-guide.md`.
- **Decisions:**
  - 3.2: `income_sources.end_date` is optional. 3.3: income start date defaults to the first period's start.
  - 3.11: hiding the Get started checklist is remembered in the browser only.
  - 3.13: weekly periods follow `pay_weekday`; `week_start` only sets how calendars display.
  - 3.14: `budget_periods.first_pay_received`.
  - 4.1: the "no budget yet" check is in the `(app)` layout. 4.2: `/onboarding` goes in the proxy. 4.3: `lib/money.ts` stays one file.
  - 4.10: a desktop Done card. 4.11: fields are 48px in the app and 52px on auth.
  - 4.12: CI blocks production deploys.
- **AI notes:**
  - Claude first told the owner to look for "Deployment Checks" as its own menu item. It's a section inside Settings → Build and Deployment.
  - Claude recommended a required `opening_balance`. That conflicts with onboarding saving the budget at step 1 and the balance at step 3. The owner then chose nullable (3.1).
- **Next:** 2a `getPeriod()`, tests first.

## 2026-11-19 · Week 1 · GitHub Actions CI
- **What:** Every push and pull request runs these on Node 22: `npm ci`, lint, typecheck and the unit tests.
- **Files:** `.github/workflows/ci.yml`, `docs/week-1-tasks.md`, `docs/mvp-brief.md`. Also ticks the app shell, which the owner checked on mobile and desktop.
- **Decisions:**
  - Included unit tests, as the brief's stack table says.
  - Left out `test:db` (needs Docker) and `next build` (Vercel builds every push).
  - No secrets. A newer push to the same branch cancels the older run.
  - A failing run does not block Vercel deploys yet.
- **Tests:**
  - The same steps pass locally: `npm ci` in a clean folder (594 packages), lint, typecheck, 32 tests.
  - The first GitHub run is checked after pushing.
- **AI notes:** None.
- **Next:** Week 1 is done. Before Week 2: settle plan review sections 3–5, update the brief's data model, start `V1.1.md` and write `week-2-tasks.md`.
- **Open:** Should a failed CI run block deploys (branch protection or Vercel setting)? Decide later.

## 2026-11-19 · Week 1 · Dev server uses local Supabase
- **What:** `npm run dev` now uses local Supabase (Docker) instead of the live project. Before this, signing up or clicking around on localhost wrote real rows to the live database.
- **Files:** `.env.development.local` (new, gitignored, local URL and publishable key), `.env.example` (comment explaining the override).
- **Decisions:**
  - Used Next.js's own env file order: `.env.development.local` is loaded before `.env.local`, and only by `next dev`. Builds and Vercel still use live.
  - To test against live, delete or rename the file and restart the dev server.
- **Tests:**
  - `@next/env` resolves dev to `127.0.0.1:54321` and build to the live URL.
  - The dev server lists `.env.development.local` first.
  - lint, typecheck and `npm run test` (32) pass.
- **AI notes:**
  - The owner asked whether local and live share data. Claude checked the env files: the databases are separate, but the dev server pointed at live.
  - The old dev server's node process survived a stop, so Claude killed it by its process ID before restarting.
- **Decided:** `supabase/config.toml` stays as it is. Local sign-up skips the confirmation email and logs in at once, so go to `/dashboard` after the Check your email page. Turning confirmation on would break the database tests, which need a session straight from sign-up, and sign-up confirmation was already tested on live. Password-reset links may open on `127.0.0.1` instead of `localhost`. Google sign-in is off locally; test it on live.
- **Next:** GitHub Actions (lint and type check on every push).

## 2026-11-19 · Week 1 · App shell frame
- **What:** Every app page now sits in a shared frame (`src/app/(app)/layout.tsx`):
  - Under 768px, a bottom bar: Home, Plan, a raised + button, Activity, More.
  - From 768px, a 240px sidebar with the main links, Settings and a profile chip.
  - A page header with three mobile styles (greeting, title, or back arrow + title) and a desktop greeting, title and Add transaction button.
  - A Manila-time greeting.
  - Placeholder pages for Plan, Activity, More, Income, Bills, Savings, Debts and Settings, each checking the login.
  - Log out moved from the dashboard to More and Settings.
- **Files:** src/app/(app)/layout.tsx, src/app/(app)/{plan,activity,more,income,bills,savings,debts,settings}/page.tsx, src/app/(app)/dashboard/page.tsx, src/app/layout.tsx (viewport-fit), src/components/shell/ (nav-items, bottom-bar, sidebar, sidebar-nav, profile-chip, page-header, page-shell, placeholder-page, log-out-button), src/lib/greeting.ts, src/lib/current-profile.ts, src/lib/require-app-user.ts, src/proxy.ts (`/more`), tests/lib/greeting.test.ts, docs/week-1-tasks.md, docs/mvp-brief.md
- **Decisions:**
  - The owner chose (a): the + button and Add transaction link to `/activity` until the add sheet exists (Week 3).
  - Mobile Activity and desktop Transactions share `/activity`.
  - Each page checks login and consent itself with `requireAppUser()`, because a layout doesn't re-run between pages. The profile query is cached per request, so the chip, greeting and check share one call.
  - Current links use the theme-aware `link` and `link-hover` tokens, because Forest text on `mint` is unreadable in dark mode.
  - Left out for now: the period switcher, the budget name, the bell, hiding the bar on sheets, and the desktop `/more` → `/settings` redirect.
  - Placeholders use a new `PlaceholderPage`, not `ComingSoon` (which has its own `<main>` and a "Back to home" link).
- **Tests:** `npm run lint`, `npm run typecheck`, `npm run test` (32, including 8 for the greeting) and `npm run build` pass. Logged out, all 9 app routes redirect to `/login`. Logged-in pages need a real session, so the owner checks them by eye.
- **AI notes:** The first build failed because the server-side sidebar passed icon components to a client component; the client component now imports the nav lists itself.
- **Brief:** Ticked auth, middleware and profiles in the Week 1 list. The app shell waits for the owner's check. GitHub Actions (lint and type check on push) is still open. It was missing from `week-1-tasks.md` and is now added there.
- **Next:** The owner checks the shell by eye; then GitHub Actions, the last Week 1 task.

## 2026-11-19 · Week 1 · Fix the Vercel build: @types/node 22
- **What:** Vercel's build failed at `npm install` with `ERESOLVE`: Vitest 5.1.0 expects `@types/node` `^22 || >=24`, and the project had `^20`. Moved `@types/node` to `^22` (22.20.5), matching local Node 22.16, and regenerated the lockfile with a normal `npm install`.
- **Files:** package.json, package-lock.json, README.md (Node 22 or later)
- **Decisions:** Fixed the real conflict instead of adding `legacy-peer-deps` to `.npmrc`. The same conflict caused npm's `edgesOut` crash on the Vitest and Supabase CLI installs, so `--legacy-peer-deps` is no longer needed (the earlier note about future installs no longer applies). Vercel's Node.js version should be 22.x to match the types.
- **Tests:** A clean install from the new lockfile in an empty folder worked (594 packages, no conflict). `npm run lint`, `npm run typecheck`, `npm run test` (24), `npm run test:db` (26) and `npm run build` pass.
- **AI notes:** Claude installed with `--legacy-peer-deps` to get past the crash instead of finding its cause, which hid the conflict until Vercel's normal install hit it.
- **Deployed:** The Vercel build passed. The owner logged in on the live URL with an existing account and went straight to the dashboard (consent now read from `profiles`).
- **Live tests:** A new email sign-up with a plus address worked (owner, Nov 19). A new Google sign-in (`/consent` → `record_consent` → dashboard) is **not tested on live yet**: waiting for a second Google test user or the published consent screen.
- **Next:** The app shell frame.

## 2026-11-19 · Week 1 · `profiles` part 2: the app reads and writes profiles
- **What:** A new `record_consent(name, version)` database function records consent from the one-time Google consent step. Sign-up sends `consent_version`. The dashboard, the consent page and `/auth/callback` check `profiles.consent_at`, and the greeting reads `profiles.display_name`. The Supabase clients are typed with the generated schema. The consent checkbox now says "I'm 18 or older and agree to…".
- **Files:** supabase/migrations/20261119065318_record_consent.sql, src/lib/legal.ts, src/lib/profiles.ts, src/lib/auth/consent.ts, src/lib/supabase/client.ts, src/lib/supabase/server.ts, src/lib/supabase/proxy.ts, src/lib/supabase/types.ts, src/proxy.ts, src/app/(auth)/actions.ts, src/app/(auth)/consent/page.tsx, src/app/auth/callback/route.ts, src/app/(app)/dashboard/page.tsx, src/components/auth/consent-checkbox.tsx, src/lib/validation/auth.ts, src/app/globals.css (comment), tests/db/record-consent.test.ts, tests/lib/validation/auth.test.ts, docs/designs/auth-screens.md, docs/designs/index.md, CLAUDE.md, docs/week-1-tasks.md, docs/plan-review-2026-11-19.md
- **Decisions:** Option (a): consent goes through a `security definer` function that only updates the caller's row and uses the database's clock. `CONSENT_VERSION = "2026-11-14"` (legal.md's "Last updated"), kept in `src/lib/legal.ts` for the legal pages to share. `profiles.consent_at` is now the record; the login data still gets a copy so the proxy's quick check passes without a query. When that quick check fails, the proxy now checks `profiles`, not the login data again, so a failed copy can't cause a `/consent` ↔ `/dashboard` loop. Fixed plan review section 2 (paths after the style guide move).
- **Tests:** `npm run test:db` (26, including 6 for `record_consent`), `npm run test` (24), `npm run lint`, `npm run typecheck` and `npm run build` pass. A dry run shows only `record_consent` would go to live.
- **Deploy order:** push the migration to live **before** pushing this code, or the consent step calls a function that doesn't exist yet. The migration went live Nov 19 after the owner's go; checked on live that logged-out visitors can't call `record_consent` and logged-in users can.
- **Next:** Push the migration, then the code; the owner tests sign-up and Google consent on the live URL. Then the app shell frame.

## 2026-11-19 · Week 1 · `profiles` migration applied to the live project
- **What:** Linked the repo to the live Supabase project and pushed `20261119061715_profiles.sql` after the owner's go.
- **Files:** docs/week-1-tasks.md, docs/plan-review-2026-11-19.md (no code changes; `supabase/.temp`, where the link is stored, is gitignored)
- **Decisions:** Before pushing, local Supabase was switched to the live versions recorded by `link` (Postgres 17.12, PostgREST 14.18, Auth 2.198; local had been on PostgREST 16.5 and Auth 2.197), and all 20 database tests passed there. A dry run showed only this migration would be applied.
- **Tests:** Read-only checks on live: the migration is in the history; 2 accounts and 2 profiles (both test users backfilled, both with consent); RLS is on; the sign-up trigger exists.
- **Correction:** The live project is in **Tokyo (`ap-northeast-1`)**, not Singapore as the Nov 18 entry says (confirmed by the owner). The Privacy Notice must say so (plan review 4.9).
- **Next:** Profiles part 2: the app reads and writes `profiles`, records `consent_version`, and adds "I'm 18 or older" to the consent text.

## 2026-11-19 · Week 1 · Plan review against the design specs
- **What:** The owner added every page spec to `docs/designs/` and moved the style guide there. Claude checked them all against the brief's data model and 9-week plan, and the findings are tracked in `docs/plan-review-2026-11-19.md`.
- **Files:** docs/plan-review-2026-11-19.md
- **Found:** 2 decisions before the profiles migration goes live (`consent_version`, 18+ consent text), 3 broken references after the move, 12 data model gaps (Weeks 2–8), 8 architecture decisions, and more scope than 9 weeks allow, with 7 candidates for `V1.1.md`.
- **Decided:** 1.1, add `consent_version` to `profiles` (done in the profiles migration, which wasn't live yet, so the file was edited instead of adding a second one). 1.2, add "I'm 18 or older" to the consent text in profiles part 2.
- **Next:** Apply the profiles migration to the live project.

## 2026-11-19 · Week 1 · `profiles` table with RLS (part 1, local)
- **What:** Migration for `profiles`. A trigger on `auth.users` creates the profile at sign-up and copies the display name. Existing accounts are backfilled. Added local Supabase (Docker) and 20 database tests, including that user A can't read or change user B's profile. Later the same day, `consent_version` was added (plan review 1.1). The trigger keeps it only with consent and only if it looks like a date, and users can't change it. Generated `src/lib/supabase/types.ts` from the local database.
- **Files:** supabase/config.toml, supabase/.gitignore, supabase/migrations/20261119061715_profiles.sql, vitest.db.config.ts, vitest.config.ts, tests/db/helpers.ts, tests/db/profiles.test.ts, src/lib/supabase/types.ts, package.json, package-lock.json, .env.example, README.md, docs/week-1-tasks.md
- **Decisions:** `week_start` is `monday` or `sunday`, default `monday`. Users can't change `is_demo`, `consent_at`, `user_id`, `id` or the timestamps, even on their own row (column permissions, owner's call). There are no insert or delete policies: the trigger creates profiles, and deleting the account removes them. At sign-up the trigger records the database's time for `consent_at` when the form sent consent, rather than trusting the time sent. It also trims and shortens the name, because anyone can call the sign-up API directly. Added a shared `set_updated_at()` trigger function for later tables. New dev dependency: `supabase` CLI 2.122.1 (3.0 is a brand-new major version), installed with `--legacy-peer-deps`. Database tests run with `npm run test:db`, kept out of `npm run test` so unit tests and CI don't need Docker. They refuse to run against anything but a localhost URL.
- **Tests:** `npm run lint`, `npm run typecheck`, `npm run test` (24) and `npm run test:db` (20) pass. With RLS turned off on the local database, 7 tests failed, including all three cross-user checks, so the tests do catch a missing policy; RLS was turned back on.
- **AI notes:** Docker Desktop installed per-user, and VS Code's terminal didn't have it on PATH until restarted; Claude added the path for its own commands. PowerShell 5.1 garbled the generated types file, so it was generated through Bash instead.
- **Also:** The owner tested the logged-in proxy cases (Log in and Sign up go to the dashboard, the reset link, and the Google consent step).
- **Not done yet:** The migration isn't on the live project. Google users' `consent_at` stays empty in `profiles` until Part 2. Onboarding (`docs/designs/onboarding.md`) was reviewed; its impact on Weeks 2–6 is in the reply and should go into a Week 2 task split.
- **Next:** Apply the migration to the live project, then Part 2.

## 2026-11-19 · Week 1 · Vitest set up
- **What:** Added `npm run test` (`vitest run`) and `npm run test:watch`. Added the first unit tests: `passwordStrength` (8 tests) and the auth Zod schemas (16 tests). All 24 pass.
- **Files:** vitest.config.ts, tests/lib/auth/password-strength.test.ts, tests/lib/validation/auth.test.ts, package.json, package-lock.json, README.md, docs/week-1-tasks.md
- **Decisions:** New dev deps `vitest` 5.1.0 and `vite` 8.3.5 (Vitest's required peer), the newest versions at least two weeks old. Both were installed with `--legacy-peer-deps` because npm 10.9.2 crashes (`Cannot read properties of null (reading 'edgesOut')`) on a normal install, even for Vitest 4.1.12. That flag skips peers, which is why `vite` had to be added by hand. Tests run in Node, live in `tests/` mirroring `src/lib`, and use the same `@/` alias as the app. The `profiles` RLS test will use local Supabase, not the hosted project (owner's call).
- **Tests:** `npm run test` (24 passed), `npm run lint` and `npm run typecheck` pass.
- **AI notes:** On Windows, Vitest 5.1.0 fails every test file (`Cannot read properties of undefined (reading 'config')`) when started from a lowercase `c:\` path, which is how VS Code opened the project; from `C:\` everything passes. Claude tried changing directory in the config, setting `root` to the uppercase path, and other pool modes; none worked, so they were removed. Owner chose to run tests from `C:\` (noted in the README) for now.
- **Open questions:** Try Vitest 5.1.1 after Dec 2 (two weeks old) in case it fixes the Windows path bug. Any future `npm install` may need `--legacy-peer-deps` until npm is updated. The README's env table still lists `NEXT_PUBLIC_SUPABASE_ANON_KEY`, but the app uses `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
- **Next:** `profiles` table with RLS, plus local Supabase for its RLS test.

## 2026-11-19 · Week 1 · Proxy: session refresh and page redirects
- **What:** Added `src/proxy.ts`. On every page request it refreshes the Supabase session cookie, sends logged-out users from app pages (`/dashboard`, `/plan`, `/activity`, `/savings`, `/debts`, `/bills`, `/income`, `/settings` and below) to `/login`, sends logged-in users from `/login` and `/signup` to `/dashboard`, and sends users without consent from app pages to `/consent`.
- **Files:** src/proxy.ts, src/lib/supabase/proxy.ts, src/lib/supabase/server.ts (comment), src/app/(app)/dashboard/page.tsx (comments), docs/week-1-tasks.md
- **Decisions:** Logged-in users on Log in or Sign up go to the dashboard. Forgot password, Set new password and Check your email stay open because the reset flow uses them while logged in. No `?next=` return-to-page yet; everyone lands on `/dashboard`. Uses `getClaims()` (checks the token locally when possible) instead of `getUser()` on every request. The token's metadata only updates on refresh, so when it says "no consent" the proxy asks Supabase with `getUser()` before redirecting, so the user doesn't loop between `/consent` and `/dashboard` right after consenting. Redirects copy any refreshed cookies. Pages keep their own guards because the proxy is only a fast first check.
- **Tests:** `npm run lint`, `npm run typecheck` and `npm run build` pass. Logged out on localhost: `/dashboard`, `/dashboard/x` and `/settings` → `/login`; the auth pages, `/privacy`, `/`, the `/auth/*` routes, icons and CSS work as before. Logged-in cases not yet tested.
- **Owner decided:** `?next=` return-to-page comes later as its own task, once there are more app pages. Set up Vitest as a small task before the `profiles` table.
- **Next:** Owner tests the logged-in cases. Then Vitest setup, then the `profiles` table.

## 2026-11-18 · Week 1 · Google sign-in and consent step (3f)
- **What:** Both Google buttons start Google sign-in through Supabase. `/auth/callback` finishes it. A first-time Google user goes to `/consent` ("One last thing"): a name pre-filled with their first name from Google, plus the same unticked consent checkbox. The dashboard sends anyone without consent there. Cancelling on Google's screen goes back to Log in with a note.
- **Files:** src/app/(auth)/actions.ts, src/app/auth/callback/route.ts, src/app/(auth)/consent/ (page, consent-form), src/components/auth/google-button.tsx, src/components/auth/consent-checkbox.tsx (moved out of the sign-up form), src/app/(auth)/signup/signup-form.tsx, src/app/(auth)/login/page.tsx, src/app/(auth)/login/login-form.tsx, src/app/(app)/dashboard/page.tsx, src/lib/auth/consent.ts, src/lib/validation/auth.ts, docs/week-1-tasks.md
- **Decisions:** Owner chose a one-time consent step over an "By continuing you agree" notice, so Google users give the same explicit consent as email users. The step also asks for a name, so both kinds of users choose what to be called. Until the proxy task, only the dashboard enforces consent. The Google client secret lives only in Supabase, not in the app.
- **Tests:** `npm run lint`, `npm run typecheck` and `npm run build` pass. Checked `/auth/callback` without a code → `/login?error=google` with the note, and `/consent` logged out → `/login`. The owner set up the Google OAuth client (consent screen in Testing mode) and tested Google sign-in on localhost.
- **Next:** Publish the Google consent screen before public launch. Then the proxy task.


## 2026-11-18 · Week 1 · Forgot password and Set new password (3e)
- **What:** `/forgot-password` sends a reset email and always goes to Check your email (now worded for reset). `/auth/reset` opens the link and logs the user in for the reset. `/reset-password` shows the email, the strength panel, "Passwords match" and "Log out on other devices" (ticked). After saving, the user is signed out and `/login` says "Password updated."
- **Files:** src/app/(auth)/forgot-password/ (page, forgot-password-form), src/app/(auth)/reset-password/ (page, set-password-form), src/app/auth/reset/route.ts, src/app/(auth)/actions.ts, src/app/(auth)/check-email/ (page, resend-button), src/app/(auth)/login/page.tsx, src/lib/auth/pending-email.ts, src/lib/auth/password-strength.ts, src/lib/validation/auth.ts, src/components/auth/auth-card-layout.tsx, src/components/auth/password-field.tsx
- **Decisions:** The pending-email cookie also stores what the email was for (sign-up or reset), so Check your email and Resend handle both. Reset requests never reveal whether the email has an account. Strength levels: Weak below the rules, Strong with 12+ characters and mixed case or a symbol, Okay in between. "Not the same as your old password" can't be checked in the browser, so it stays unticked and Supabase's `same_password` error shows under the field. Ticked "Log out on other devices" signs out every session; unticked signs out only this one. Both then go to Log in, as the design doc says. Fixed `PasswordField` replacing its own classes when given a `className`.
- **Tests:** `npm run lint`, `npm run typecheck` and `npm run build` pass. Checked `/auth/reset` with a bad code goes to `/forgot-password?error=link-expired`, and `/login?password=updated` shows the note. Screenshots of Forgot password at 390px and 1280px. The owner tested the full reset flow, including the error for reusing the old password. Like sign-up, the reset link only works in the browser that asked for it until custom SMTP lets us edit templates.
- **AI notes:** The dev server served a stale module (`TileMascot` undefined, a 500 error) until the file was edited again; the production build was fine.
- **Next:** Owner tests the reset flow; then 3f, Google sign-in.

## 2026-11-18 · Week 1 · Log in and log out (3d), sign-up privacy fix
- **What:** `/login` now logs in with Supabase (React Hook Form + Zod, server-side check too). The dashboard placeholder has a Log out button. Sign-up with an email that already has an account now shows Check your email like any other sign-up.
- **Files:** src/app/(auth)/actions.ts, src/app/(auth)/login/login-form.tsx, src/app/(app)/dashboard/page.tsx, src/lib/validation/auth.ts, docs/week-1-tasks.md
- **Decisions:** Owner chose privacy over the design doc's "There's already an account" message, so nobody can use sign-up to check whether an email is registered; Resend also reports success for an already-confirmed email (the error is logged on the server). Wrong email or password gives one message that never says which was wrong. "Email not confirmed" (only returned after a correct password) goes to Check your email. Log out signs out this device only.
- **Tests:** `npm run lint`, `npm run typecheck` and `npm run build` pass. Owner tested log out, wrong password, log in, and signing up again with an existing email on localhost.
- **Confirmed:** the first test user's metadata has both `display_name` and `consent_at`.
- **Docs:** `docs/designs/auth-screens.md` now says never to reveal whether an email has an account (the "Email already used" message is removed).
- **Next:** 3e, Forgot password and Set new password, or 3f, Google sign-in.

## 2026-11-18 · Week 1 · Sign up and Check your email (3c)
- **What:** `/signup` creates a Supabase user with React Hook Form + Zod; `/check-email` shows the email with Open email app, a 45-second Resend and the spam note; `/auth/confirm` verifies the email link, logs the user in and goes to a placeholder `/dashboard`. Added the centered-card layout.
- **Files:** src/lib/validation/auth.ts, src/lib/auth/pending-email.ts, src/lib/auth/email-app.ts, src/app/(auth)/actions.ts, src/app/(auth)/signup/ (page, signup-form), src/app/(auth)/check-email/ (page, resend-button), src/app/auth/confirm/route.ts, src/app/(app)/dashboard/page.tsx, src/components/auth/auth-card-layout.tsx, src/components/auth/auth-split-layout.tsx, package.json, package-lock.json
- **Decisions:** New deps `zod` 4.6, `react-hook-form` 7.92, `@hookform/resolvers` 7.0. Display name and consent time are saved in the Supabase user's metadata for the profiles task to copy. The pending email lives in a 1-hour httpOnly cookie, not the URL, and Resend reads it from there, so it can't email other addresses. The email link uses `token_hash` + `verifyOtp` (works across devices), with a `?code=` fallback. "Open email app" only shows for Gmail, Yahoo, Outlook and iCloud addresses. Session reads are inside `<Suspense>` because Cache Components is on.
- **Tests:** `npm run lint`, `npm run typecheck` and `npm run build` pass. Checked redirects: `/check-email` with no pending email → `/signup`; `/dashboard` logged out → `/login`; a bad confirm link → `/check-email?error=link-expired`. Screenshots at 390px and 1280px. The owner signed up with a real email on localhost, clicked the link in the same browser and reached the dashboard.
- **Email template:** Supabase only allows template edits with custom SMTP, so the `token_hash` template change is skipped for now. The default `?code=` link works through the fallback in `/auth/confirm`, but only in the browser used to sign up; elsewhere the email still gets confirmed and the user is asked to log in. Switch the template when SMTP is set up.
- **Open questions:** Resend's free plan needs a verified domain you own before it can email other people, and `*.vercel.app` can't be verified. Week 8 needs a custom domain or another free SMTP option. "Email already used" tells people that an account exists (the design doc asks for it), while Forgot password hides this. Keep it? Supabase's built-in email sender allows only a few emails per hour, so testing may hit "Too many tries" until Resend SMTP (Week 8).
- **Next:** Owner updates the Supabase email template and tests sign-up end to end; then 3d, Log in and log out.

## 2026-11-18 · Week 1 · Auth building blocks and Log in screen (3b)
- **What:** Built `/login` (UI only) from `docs/designs/auth-screens.md`: mobile layout with a centered logo, desktop split screen with the mint pitch panel and a sticker Safe to spend example card, and dark mode. Added shared auth components.
- **Files:** src/app/(auth)/login/page.tsx, src/app/(auth)/login/login-form.tsx, src/components/auth/ (logo, auth-split-layout, text-field, password-field, google-button, or-divider, submit-button, form-error), src/app/globals.css, docs/week-1-tasks.md
- **Decisions:** New tokens: `link` and `link-hover` (switch in dark mode), `placeholder` (#7A8A80), `logo-backdrop` (light mint behind the logo in dark mode). Focus and error borders use a 1.5px border plus a 0.5px inset shadow so text doesn't shift. Field errors use `bad-fg` (#9B2C2C), not `danger`, which stays reserved for deletes. The form's submit is blocked until 3d so the browser can't GET the password into the URL. Demo button hidden; the Turnstile spot is marked with a comment. The centered-card layout moved to 3c.
- **Tests:** `npm run lint` and `npm run typecheck` pass. Screenshots in headless Edge at 390px (via an iframe, since headless windows can't go below ~500px) and 1280px, in light and dark mode (by adding `dark` to `<html>` temporarily, then reverting).
- **AI notes:** The design canvas couldn't be read (it loads with JavaScript), so this is built from the design doc only. The pitch panel's three feature rows aren't in the doc; Claude wrote placeholder copy. The running dev server served stale CSS without the dark link colour until globals.css was edited again.
- **Next:** 3c, Sign up and Check your email.

## 2026-11-18 · Week 1 · Supabase clients, auth task split, placeholder pages
- **What:** Added the browser and server Supabase clients (task 3a). Split the auth task into 3a–3f in `docs/week-1-tasks.md` after reviewing `docs/designs/auth-screens.md`. Added "coming soon" placeholders at `/privacy` and `/terms`. Changed `profiles` in the brief to use `user_id`.
- **Files:** src/lib/supabase/env.ts, src/lib/supabase/client.ts, src/lib/supabase/server.ts, src/components/coming-soon.tsx, src/app/privacy/page.tsx, src/app/terms/page.tsx, docs/week-1-tasks.md, docs/mvp-brief.md, package.json, package-lock.json
- **Decisions:** New deps `@supabase/supabase-js` 2.119 and `@supabase/ssr` 0.12. The server client swallows the cookie write error in Server Components; the proxy task will refresh sessions. `profiles` gets its own `id` plus a unique `user_id`, per CLAUDE.md. Turnstile, the demo button and real Privacy/Terms pages wait for Week 8; sign-up goes to the dashboard until onboarding exists.
- **Tests:** `npm run lint` and `npm run typecheck` pass. A throwaway script with `.env.local` got HTTP 200 from Supabase Auth settings: email on, confirm email on, Google off (expected until 3f). Vitest isn't set up yet, so there is no `npm run test`.
- **AI notes:** `npm audit` reports existing moderate and high issues in `minimatch` and `picomatch`, pulled in by shadcn's tooling rather than the Supabase packages. Not fixed: `--force` would make breaking changes.
- **Next:** 3b, the shared auth building blocks and the Log in screen (UI only).

## 2026-11-18 · Week 1 · Supabase project and env vars
- **What:** Created the Supabase project (free plan, Singapore region, automatic RLS on). Added `.env.local` and Vercel env vars, and listed the variable names in `.env.example`.
- **Files:** .env.example, docs/mvp-brief.md (ticked the task)
- **Decisions:** Used the new publishable key (`sb_publishable_…`) instead of the legacy anon key. Both vars are plain config in Vercel, not secrets, because `NEXT_PUBLIC_` values ship to the browser anyway. No service_role key is used. Migrations will still enable RLS explicitly, because auto-RLS is a setting on the hosted project and doesn't carry over to other databases.
- **Tests:** Checked `.env.local` is gitignored and the URL has no `/rest/v1` suffix. Env vars added in Vercel and redeployed. Supabase isn't called from code yet.
- **Also done:** Auth redirect URLs (localhost and the Vercel URL) added in Supabase. The empty `.env` file stays (owner's call).
- **Next:** Supabase Auth with email + password and Google; login, sign-up and logout pages.

## 2026-11-17 · Week 1 · Pushed to GitHub and deployed on Vercel
- **What:** Pushed the scaffold to GitHub and connected the repo to Vercel; the app is live. Ticked the first Week 1 task in `docs/mvp-brief.md`.
- **Files:** docs/mvp-brief.md
- **Decisions:** The GitHub repo was renamed to `chiwawallet`; the local remote still uses the old name and works through GitHub's redirect.
- **Tests:** Deployed by the owner on Vercel.
- **Live URL:** https://chiwawallet.vercel.app/ (added to the README).
- **Open questions:** Update the local remote to the new repo name. The README's clone command still has a `[YOUR GITHUB USERNAME]` placeholder.
- **Next:** Create the Supabase project; add `.env.local`, `.env.example` values and Vercel env vars.

## 2026-11-17 · Week 1 · Sticker shadow back to fixed black
- **What:** Reverted the sticker shadow to the style guide's original fixed #1C1C1E in both themes. Added a `sticker` color token (also #1C1C1E) for the sticker border, so the border stays black in dark mode too instead of turning light with `ink`.
- **Files:** src/app/globals.css, src/app/page.tsx, docs/style-guide.md
- **Decisions:** Sticker elements use `border-sticker`, not `border-ink`. `ink` is now for text only.
- **Tests:** `npm run lint`, `npm run typecheck` and `npm run build` pass. Not yet re-checked by eye in dark mode.
- **Open questions:** On the dark background (#0F1A14) the black border and shadow are close to invisible, so the hero card may look flat. The ₱ on the hero card may be falling back to another font if Fredoka has no peso glyph.
- **Next:** Push to GitHub and connect Vercel.

## 2026-11-17 · Week 1 · Icon folder cleanup
- **What:** Moved the icon README and `preview.png` out of `public/` so they aren't served on the live site, and deleted the three unused `favicon-*.png` sizes. Updated the icon README to show where each file lives now.
- **Files:** docs/icons/README.md, docs/icons/preview.png, public/icons/ (only the four PWA icons remain)
- **Decisions:** `favicon.ico` already covers the small sizes, so the separate PNGs weren't needed.
- **Tests:** No code changed; file moves only.
- **Next:** Push to GitHub and connect Vercel.

## 2026-11-17 · Week 1 · Sticker shadow in dark mode, docs as source of truth
- **What:** The sticker shadow now follows `ink`, so it turns light in dark mode. `CLAUDE.md` points at `docs/mvp-brief.md` and `docs/style-guide.md` as the source of truth, replacing the online links.
- **Files:** src/app/globals.css, docs/style-guide.md, CLAUDE.md
- **Decisions:** Updated the style guide (sections 4 and 10) to match the code, so the two don't disagree.
- **Tests:** `npm run lint`, `npm run typecheck` and `npm run build` pass; the built CSS uses `var(--ink)` for the shadow. Not yet checked by eye in dark mode.
- **Open questions:** Leftover files in `public/icons/` (README, preview, extra favicon sizes) still need a decision.
- **Next:** Push to GitHub and connect Vercel.

## 2026-11-17 · Week 1 · App icons and logo in place
- **What:** Moved the icon set from `public/icons/` to where Next.js picks it up: favicon, SVG tab icon, Apple touch icon and the logo mark. The Chiwawallet favicon replaces the Next.js starter one.
- **Files:** src/app/favicon.ico, src/app/icon.svg, src/app/apple-icon.png, public/logo-mark.svg, public/icons/ (PWA icons stay here)
- **Decisions:** Followed the mapping in `public/icons/README.md`. Left the PWA icons in `public/icons/` for the Week 8 manifest.
- **Tests:** `npm run lint`, `npm run typecheck` and `npm run build` pass; the build lists `/icon.svg` and `/apple-icon.png`. Not yet checked in a browser tab.
- **Open questions:** `public/icons/README.md`, `preview.png` and the three `favicon-*.png` files are not used by the app but would be served publicly; move them to `docs/` or delete them?
- **Next:** `app/manifest.ts` in Week 8 uses the PWA icons.

## 2026-11-17 · Week 1 · Next.js app, shadcn/ui and theme tokens
- **What:** Scaffolded the Next.js app (TypeScript strict, App Router, Tailwind v4), installed shadcn/ui with one Button, added the style guide's theme tokens and fonts, and replaced the starter page with a temporary token check page. Also renamed `.env.sample` to `.env.example`, tightened `.gitignore` to `.env*`, and switched the brief to Needs / Wants / Savings & debt payoff (`needs / wants / savings_debt`).
- **Files:** package.json, package-lock.json, tsconfig.json, next.config.ts, eslint.config.mjs, components.json, AGENTS.md, src/app/layout.tsx, src/app/page.tsx, src/app/globals.css, src/app/favicon.ico, src/components/ui/button.tsx, src/lib/utils.ts, .gitignore, .env.example, docs/mvp-brief.md, docs/dev-log.md
- **Decisions:**
  - Kept the Next.js 16.4 defaults: Cache Components and Partial Prefetching on, Tailwind through `@tailwindcss/turbopack` (no PostCSS config), and the generated `AGENTS.md`.
  - shadcn's default preset (`base-nova`) builds on Base UI (`@base-ui/react`), not Radix.
  - `typecheck` runs `next typegen` before `tsc --noEmit`, because `LayoutProps` comes from generated route types.
  - Fonts load the `latin-ext` subset as well as `latin`, because the peso sign (₱) is not in `latin`.
  - Tokens that point at another variable sit in `@theme inline` so they follow `.dark`; fixed values sit in `@theme`.
  - `rounded-sm/md/lg/xl` use the style guide's radii (10, 14, 18, 24px), replacing shadcn's computed ones.
- **Tests:** `npm run lint`, `npm run typecheck` and `npm run build` pass. Not yet checked by eye in a browser. No Vitest yet (comes with `getPeriod` in Week 2).
- **AI notes:** Claude couldn't read the online brief and style guide, so they were copied into `docs/`. The scaffold differed from Claude's first plan (AGENTS.md, Turbopack Tailwind, Cache Components), so it paused for approval before copying files in.
- **Open questions:**
  - Sticker shadow in dark mode: the shadow is fixed at #1C1C1E while `ink` turns light, so it nearly disappears on the dark background.
  - The online brief still says Essentials / Non-essentials; `docs/mvp-brief.md` is updated.
  - Nothing switches the `.dark` class on yet (needs a theme switcher tied to `profiles.theme`).
- **Next:** Push to GitHub and connect Vercel; restyle Button into the guide's variants (Hero, Primary, Secondary, Soft, Dashed, Destructive); then the Supabase project and env variables.
