# Week 6 tasks

The Week 6 checklist in `mvp-brief.md` broken into one-session tasks. Tick tasks here as they're done; tick the brief's checkbox when its whole group is done.

**Week 6 is done when:** test data across three periods gives correct carry-over, and marking an item paid updates the dashboard.

Specs: `docs/designs/plan.md` (§3 tick rows and spending bars, §4 desktop ACTUAL and STATUS, §7 Give leftover a job), `payday-rollover.md`, `dashboard.md` (§1 Safe to spend, §2 Due this period), `activity.md` (the Transfer tab, "Changed Nov 24"), `debts.md` §5 (Mark paid and Pay extra), `bills.md` (Mark paid, Paid this period), `delete-pattern.md` (deleting a transaction that paid an item). Carried over from Week 5: see "From Week 5" below.

## Tasks

- [x] **6a. Migration: Mark paid.** Done Nov 26 (`20261126120000_mark_plan_item_paid.sql`): local and live (Nov 26). Undo is the existing soft delete of the payment, and a trigger un-ticks the item (owner, Nov 26), so there's no separate unmark function. The app can't set `paid_at` today (5a's grants leave it out), and paying must create the transaction and tick the item together.
  - A SQL function `mark_plan_item_paid(item, date, amount)`. In one transaction it creates the matching `transactions` row, with `plan_item_id` set, and sets the item's `paid_at`. The transaction depends on the item:
    - **Bill or one-off:** an expense in its category.
    - **Pot:** a savings deposit with `pot_id` and the Savings pot category.
    - **Scheduled debt payment:** a `debt_payment` with `debt_id` and the locked Debt payment category (Needs).
    - **Extra debt payment:** the same, in Extra debt payment (Savings & debt payoff).
  - `unmark_plan_item_paid(item)` for Undo: soft-deletes that transaction and clears `paid_at`.
  - Deleting (soft-deleting) a transaction that paid an item clears the item's `paid_at` (`delete-pattern.md`: "Subscriptions goes back to Due Nov 22").
  - Only items in periods that aren't closed. Income items aren't ticked (they use **I got paid**). Spending budgets and starter items aren't ticked either: their actual is what's spent.
  - **RLS** with user A can't mark user B's items tests in `tests/db/`. **Live:** dry run, then the owner's go.
  - Done when: `npm run test:db` passes.
- [x] **6b. Mark paid in the app.** Split in two (owner, Nov 26). Done Nov 26.
  - [x] **6b-1. The Plan.** Done Nov 26 (checked in a browser on local Supabase). `paidOnDate()` and `isTickable()` in `lib/plan.ts`; `markPaid` and `unmarkPaid` in `plan/actions.ts`; `components/plan/tick-button.tsx`.
    - Tapping a paid circle un-ticks it, with Undo and no dialog.
    - Future periods can't be ticked.
    - Paid items can't be removed.
  - [x] **6b-2. Bills and Debts.** Done Nov 26 (checked in a browser on local Supabase). `paidThisPeriod()`, `billRowStatus()` and `debtItemToPay()` in `lib/plan.ts`; `payableDebtItems()` in `lib/plan-periods.ts`; `useMarkPaid` and `MarkPaidPill` in `tick-button.tsx`.
    - One app-wide toast (`useAppToast()`), which the Plan uses too.
    - The Mark paid pill shows on mobile Bills rows too.
    - Bills and Debts only tick; un-ticking is on the Plan or in Activity.
  - **Plan tick circles** become buttons ("Mark Meralco paid", "Mark Travel pot added"). Paid shows a solid circle and "Paid Nov 15".
    - Undo toast: "Meralco paid · Undo".
    - A variable bill (`amount_varies`) asks for the real amount first.
  - **Bills:**
    - "Paid this period" (summary and desktop stat).
    - The row tag "Paid Nov 15".
    - The desktop **Mark paid** button.
  - **Debts:** **Mark Nov 25 paid** on the debt card.
  - Done when: ticking Meralco on the Plan shows it paid on Plan and Bills, and Undo brings it back.
- [x] **6c. Safe to spend and Due this period on the Dashboard.** Done Nov 26 (checked in a browser on local Supabase). `stillDueTotal()`, `safeToSpend()` and `perDay()` in `lib/money.ts`; `itemDueOn()` and `dueList()` in `lib/plan.ts`; `components/dashboard/due-card.tsx`.
  - Unpaid one-offs count in Still due, and per day rounds down to whole pesos (owner, Nov 26).
  - Variable bills ask for the amount here too.
  - The four-card desktop stat row moved to Week 7.
  - Known: on a 390px phone, a Due row's detail line is cut short beside the Mark paid pill.
  - `lib/money.ts`, tests first:
    - **still due:** unpaid bill, savings and debt items this period
    - **Safe to spend:** cash now − still due
    - **per day:** safe to spend ÷ days left, counting today
  - When Safe to spend is below ₱0, the per-day pill becomes "Over by ₱X".
  - The Safe to spend card replaces "Cash now" (`cash-card.tsx`).
  - The **Due this period** card: unpaid and recently paid items with tick buttons, and "See all" to Plan.
  - Done when: marking an item paid moves Safe to spend and the Due list.
- [x] **6d. The Transfer tab.** Done Nov 26.
  - [x] **6d-1. Pots.** Done Nov 26 (checked in a browser on local Supabase). `potTransfer()` in `lib/pots.ts`; the Savings schema's `move` direction and `toPotId`; `writeSavings`'s tick-off and move paths; `undoTransfer`.
    - Any amount ticks off the pot's planned item.
    - Pot to pot never ticks anything off.
    - A move is two rows, with no link column; Undo removes both. The add sheet's Savings tab becomes **Transfer**, with To a pot, From a pot, and Pot to pot (a withdrawal and a deposit, net ₱0 to cash). A deposit to a pot with a planned item this period says "This also ticks off the ₱2,000 planned for this period." and pays it (sets `paid_at` and `plan_item_id`).
  - [x] **6d-2. Debts.** Done Nov 26 (checked in a browser on local Supabase). `debtPaymentSplit()` in `lib/debts.ts`; the `debt` direction with `debtId`; `payDebt()` in `activity/actions.ts`; Pay extra on Debts; Segmented's `wrap` (2×2 on phones).
    - Above the scheduled amount, a payment is split: scheduled (Needs) plus extra (Savings & debt payoff). Below it, it still ticks the payment off.
    - Pay extra opens the same sheet.
    - **Fixed Nov 26:** extra payments now lower the *last* payments first (debts.md §5), and scheduled ones fill from the oldest. See `reducedSchedule()`, `debtPaidByKind()` and `debtPaidFor()`.
    - A payment cleared by extras shows as Paid at ₱0.
    - Known: its line says "paid from Jan 15 payday". **To a debt** has two cases:
    - **A payment is due this period:** it pays that planned item, in the Debt payment category (Needs).
    - **Otherwise:** it's an extra payment, in Extra debt payment (Savings & debt payoff).
    - Also **Pay extra** on the Debts card (a small sheet for the amount).
  - Done when: a ₱2,000 deposit to Travel ticks off its planned item, and an extra debt payment lowers what's left.
- [x] **6e. Planned vs actual on the Plan.** Done Nov 26 (checked in a browser on local Supabase). `spendingActuals()`, `budgetBar()`, `groupProgress()` and `itemStatus()` in `lib/plan.ts`.
  - Payments through a plan item don't count against a category budget.
  - Future periods show planned amounts only.
  - STATUS is a tag; the tick button stays beside the name.
  - **Spending budgets:** "₱3,240 / ₱6,000", the 8px bar (green, gold from 90%, red over 100%), and "₱2,760 left" or "₱340 over".
  - **Group headings:** "₱1,700 of ₱2,700 paid".
  - **Desktop table:** the ACTUAL and STATUS columns.
  - **Desktop stat card:** Paid or spent uses actuals.
  - **The category picker's tiles:** "₱2,760 left" (from 5h-2).
  - Done when: an expense in Food moves Food's bar, and paying Meralco updates the BILLS heading.
- [x] **6f. Give leftover a job** (`plan.md` §7, `/plan/assign?start=…`). Done Nov 26 (checked in a browser on local Supabase).
  - `potAssignCap()`, `debtAssignCap()`, `stepAssign()`, `fitAssign()`, `assignState()`, `assignPreset()` and `assignEffect()` in `lib/plan.ts`
  - `loadAssignData()` and `assignTargets()` in `lib/plan-periods.ts`
  - `assignLeftover` and `undoAssign`
  - `assign-form.tsx`, `give-job-card.tsx`
  - Each assign adds new items, not merged (owner, Nov 26).
  - Caps: target − balance − planned, and owed − unpaid planned.
  - The page works for the current and future periods.
  - **Opens from:** the summary card's **Assign the ₱8,800** button.
  - **The page:** the Remaining card (some left, all assigned, too much), the presets, and one row per pot and debt plus Keep as buffer.
    - Each row has steppers: ₱500 a tap, or tap the amount for a keypad.
    - **Limits:** a pot stops at its target, and a debt at what's owed.
  - **Saves:** one `assigned` plan item per destination above ₱0. The buffer saves nothing.
  - Done when: assigning ₱5,000 to Emergency and ₱2,000 to SPayLater shows both in the period, counted as Savings & debt payoff.
- [x] **6g. Carry-over math, tests first.** Done Nov 26. `carryOver()` and `carryForward()` in `lib/plan.ts`, built on `periodTotals()`. A three-period test checks each carry-in and leftover against `dashboardNumbers()`. An overspend carries as a negative; the budget's `carry_over` setting stays on, with no screen.
  - A pure carry-over function in `lib/`, with Vitest cases for a surplus, an overspend and zero.
  - Also a three-period case: test data across three periods, closed one after another, gives the right carry-in for each.
  - It must agree with the Dashboard's carry-in (`dashboardNumbers()`). See open question 1.
- [x] **6h. Close a period: the payday screen** (`payday-rollover.md`). Likely two sessions:
  - [x] **6h-1. Closing.** Done Nov 26 (checked in a browser on local Supabase). `periodsToClose()` in `lib/plan.ts`; `closeEndedPeriods()` and `closeEndedPeriodsOnVisit()` in `lib/plan-periods.ts`, run on Dashboard and Plan visits; the Plan's Closed tag.
    - Transactions in closed periods stay editable, and `carried_in` is a record (owner, Nov 26).
    - Known: a closed period with nothing planned still shows the empty-plan card.
    - The first visit on or after a payday closes the previous period: `closed_at`, `leftover_choice`, and `carried_in` per open question 1.
    - Several missed periods close in order with Carry.
    - With `ask_on_payday` off, it closes silently with Carry.
    - A closed period's Plan is read-only, with a "Closed" tag.
  - [x] **6h-2. The payday screen** (`/payday?start=…`). Done Nov 26 (checked in a browser on local Supabase).
    - The code: `paydayWins()`, `leftoverChoices()`, `newPeriodMoney()`, `paydayPreview()` and `coverFromPot()` in `lib/plan.ts`; `closePeriod()` and `loadPaydayData()`; `closeWithChoice`; `components/payday/payday-screen.tsx`.
    - The Dashboard and the Plan redirect to it when a period is waiting.
    - Split it myself means Carry, then Give leftover a job on the new period (owner, Nov 26).
    - Moving to a pot moves the whole leftover; covering from a pot takes up to its balance.
    - "made on time" only when every payment was on time.
    - "How Nov 15 – 29 went", with true wins only
    - "What should happen to the ₱9,200?": Carry, Move it to a pot, Pay off a debt early, or Split it myself (opens 6f)
    - "Your new period is ready"
    - the overspent version
  - Done when: the three-period test data gives the right carry-over, and a real payday shows the screen once.
- [x] **6i. Live check.** Push, then mark this period's bills paid on your phone and watch Safe to spend. Done Nov 26: the owner checked the live site (`358adf4`) and said "tick it".

## From Week 5

- Paying doesn't tick plan items yet, so Bills' and Savings' "due" lines stay. 6b and 6d fix this.
- Future periods show "—" for carried in. 6h decides what they show once periods close.
- "₱2,760 left" on the category picker's tiles: 6e.

## Open questions (answered Nov 26, see Decisions)

1. **Carry-in model.** Today carry-in is worked out from every earlier transaction plus the opening balance (`dashboardNumbers()`), never stored. The rollover choices (move to a pot, pay a debt) create transactions dated the old period's last day, so the worked-out carry-in already follows them.
   - **Suggest:** keep working it out, and save `carried_in` at close only as a record (history and the payday screen).
   - **The alternative:** make the stored `carried_in` the source of truth, which means two numbers that can disagree.
2. **Marking paid in a closed period.** Suggest not allowed: a closed period is read-only, so its plan items can't be ticked. A late payment goes in the current period.
3. **Starter items' actual.** Starter lines (Needs, Wants, Savings & debt) have no category. Suggest their actual is the spending in that group's categories that have no budget of their own. Otherwise starter lines never move.
4. **Mark paid's date.** Suggest today, as the spec says, but never after the period ends. Editing the transaction afterwards can change it.
5. **Payday screen route:** `/payday?start=…`, a query string like the Plan's, instead of the spec's `/payday/[periodId]`.

## Decisions (owner, Nov 26: "go with your suggestions")

1. **Carry-in stays worked out** from the opening balance and every earlier transaction (`dashboardNumbers()`). `carried_in` is saved at close as a record only.
2. **No marking paid in a closed period.** A late payment goes in the current period.
3. **Starter items' actual** is the spending in that group's categories that have no budget of their own.
4. **Mark paid is dated today,** never after the period ends; editing the transaction can change it.
5. **The payday screen** is `/payday?start=…`, not `/payday/[periodId]`.
