# Week 7 tasks

The Week 7 checklist in `mvp-brief.md` broken into one-session tasks. Tick tasks here as they're done; tick the brief's checkbox when its whole group is done.

**Week 7 is done when:** you rebuild your Oct 2026 – Apr 2027 paycheck plan in the app and every payday's totals match your Sheet. See open question 1: the app can't plan that whole range today.

Specs: `docs/designs/dashboard.md` (§2 mobile, §3 desktop, §4 empty and first-day, §5 50/30/20, §7 fixes), `savings.md`, `debts.md`, `app-shell.md` §4 (period switcher).

## Already built (check, don't rebuild)

- **Pot balances and progress bars** (brief item 1): Week 4 (4d, 4e) on Savings and the pot details page. 6d-1 added deposits that tick off planned items.
- **Debt remaining, planned vs paid, and status** (brief item 2): Week 4 (4f) on Debts, with on time or Late after the due date. 6b-2 added Mark paid, 6d-2 Pay extra, and a fix made extra payments lower the last payments.
- **Bills and debts due this period on the Dashboard** (part of brief item 3): 6c's Due this period card and Safe to spend.

## Tasks

- [x] **7a. Dashboard: Spending and Savings pots** Done Nov 26 (checked in a browser on local Supabase). `topBudgets()` in `lib/plan.ts`, `potCardLine()` in `lib/pots.ts`; `openCurrentPlan` items get `spent` and `bar`; `spending-card.tsx`, `pots-card.tsx`. Starter lines stay off the Spending card. (`dashboard.md` §2.4–2.5, fix #4).
  - **Spending card:** the three spending budgets with the biggest planned amounts. Each shows "₱3,240 / ₱6,000" and an 8px bar (6e's `budgetBar()`), then a "Plan" link.
  - **Savings pots:** pot cards with the balance, a bar and "43% of ₱30,000".
    - **No target:** "No target".
    - **Locked pot:** a lock icon, a full `line-dash` bar and "Locked savings".
    - **On mobile:** they scroll sideways.
    - **"See all"** goes to Savings.
  - Hidden until there's data, as §4 says.
  - Done when: an expense moves its Spending bar, and a deposit moves its pot card.
- [x] **7b. Dashboard: the 50/30/20 check, tests first** Done Nov 26 (checked in a browser on local Supabase). `spentSplit()` in `lib/money.ts`; `split-card.tsx`. Debt payments count by their category (owner, Nov 26). (`dashboard.md` §5).
  - **A pure function:** money out so far by group.
    - Expenses count by their category's group, and transfers to pots count as Savings & debt payoff.
    - A debt payment that pays a planned item counts as Needs; any payment beyond the plan counts as Savings & debt payoff.
    - Each group gets its share and its comparison to the budget's target.
  - **The card:** a 14px stacked bar, rows with "Target 50%" (mobile) or "11 pts over 50%" (desktop), and the footnote.
  - **Hidden** until money out reaches ₱1,000.
  - Done when: the Vitest cases pass, and the card matches a hand-worked period.
- [x] **7c. Dashboard: desktop layout** Done Nov 26 (checked in a browser on local Supabase at 1024, 1280, 1440 and 390px). `stillDueBreakdown()`, `dueInDays()`, `spendingTotal()` in `lib/plan.ts`; `potPeriodLine()` in `lib/pots.ts`; `debtLeftAfter()` in `lib/debts.ts`; `periodMoneyLine()` in `lib/money.ts`; `stat-row.tsx`. "Left after this" is the debt's balance after the payment; the pay prompt is a banner above the stat row and Income sits at the bottom of the side column (owner, Nov 26). The Next period card moves to 7d. (`dashboard.md` §3).
  - **The stat row:**
    - Safe to spend (hero), with "₱1,355 a day for 10 days"
    - Money out so far
    - This period's money
    - Still due, with "1 bill, 1 debt, 1 savings transfer"
  - **The main column:**
    - Due this period, with longer detail lines ("Due Nov 22 · in 2 days")
    - Spending vs plan
    - Recent activity as a table
  - **The side column:** Savings pots, with "Manage" and "+₱3,000 this period", and the 50/30/20 check.
- [x] **7d. Dashboard: first-day state and the period switcher** (`dashboard.md` §4, `app-shell.md` §4). Split in two (owner, Nov 26):
  - [x] **7d-1. First-day state.** Done Nov 26 (checked in a browser on a fresh local account, 390 and 1280px). `checklistSteps()` in `lib/checklist.ts`, `periodDayLine()` in `lib/periods.ts`; `get-started-card.tsx`, `empty-card.tsx`; Dismiss is a cookie (`gs_dismissed`, per browser, owner Nov 26). The card shows in any period until all five are done or it's dismissed; the h1 stays "Your payday at a glance". Create a savings pot ticks once a pot has money or a target (open question 5).
  - [x] **7d-2. Period arrows and Next period.** Done Nov 26 (checked in a browser on local Supabase, 1280 and 390px). `dashboardNeighbors()`, `nextPeriodLine()`, `nextPeriodSummary()` in `lib/plan.ts`; `openCurrentPlan(…, { withNext: true })` previews the next period without opening it; `period-switcher.tsx`, `next-period-card.tsx`. The arrows open the previous and next periods on the Plan (decision 2); the previous one is disabled in the first period.
  - **Next period:** the desktop side column's mint card ("Nov 30 – Dec 14", "₱33,000 expected · Electricity and MP2 due", Plan ahead) and the mobile "Plan next payday" link (decision 4), both from the next period (moved from 7c, owner Nov 26).
  - **The Get started checklist** (an `<ol>`, "1 of 5 done"), and the empty section cards.
  - **The period switcher's arrows.** See open question 2.
- [x] **7e. Savings and Debts: check against the specs.** Done Nov 27 (checked in a browser on local Supabase, 390 and 1280px). Walk `savings.md` and `debts.md` against the pages and fix any gaps. Fixed: "Cleared early" (a `cleared` payment status in `debtProgress()`, partly lowered ones add "· ₱1,500 cleared early"); the Debts summary card is white on phones and Deep Green from tablet up (debts.md fix #1, owner Nov 24); the Savings desktop stat lines "₱2,000 more planned" and "₱3k + ₱4k + ₱5k" (`morePlannedLine()`, `savingPlanParts()` in `lib/pots.ts`). Already there: the mobile back arrow to More. Not built, by Week 4's choice: the desktop debt details panel, so its subtitle (fix #2) doesn't apply.
  - **Includes the carried-forward wording:** a debt payment cleared by extras should read "Cleared early", not "paid from Jan 15 payday".
  - Done when: brief items 1 and 2 can be ticked.
- [x] **7f. Carried-forward polish (from Week 6).** Done Nov 27 (checked in a browser on local Supabase, 390 and 1280px). `groupProgressLine()` in `lib/plan.ts`; `NothingPlanned` in `empty-plan.tsx`. A closed empty period keeps its summary and Money in above the line (owner, Nov 27).
  - **Overpaid groups:** "₱575 of ₱549 paid" should read better, for example "₱575 paid (₱549 planned)".
  - **Due row on a 390px phone:** the detail line wraps under the name instead of being cut short beside the pill.
  - **Closed, empty periods:** no empty-plan card, just "Nothing was planned for this period."
- [ ] **7g. Your real plan vs your Sheet.** Two parts (open question 1, answer b):
  - [x] **7g-1. Paydays overview.** Done Nov 27 (checked in a browser on local Supabase, 390, 1024 and 1280px). `/plan/paydays`, from the Plan options menu. `overviewPeriods()`, `paydayTotals()`, `overviewTotal()` in `lib/plan.ts`; `loadPaydaysOverview()` in `lib/plan-periods.ts`; `paydays-table.tsx`. Owner, Nov 27: Money in is planned income; Not assigned is money in − planned, without carry-in; the range is the first period to 6 months ahead. A read-only page listing each payday up to Apr 2027.
    - **Columns:** money in, bills, debt payments, savings, spending, one-offs, planned, not assigned.
    - **Where the numbers come from:**
      - periods already open use their plan items
      - later ones use `generatePlan()` without opening them, plus the budgets per payday
    - **Editing** is still only possible 3 months ahead, on the Plan.
  - [ ] **7g-2. Compare with your Sheet.**
    - You enter your real income, bills, pots, debts and budgets, then compare the overview with your Sheet, payday by payday.
    - Claude looks into any mismatch and fixes the code if the app is wrong.
- [x] **7i. The 50/30/20 split as group budgets (owner, Nov 27).** Done Nov 27 (checked in a browser on local Supabase, 390 and 1280px). `groupBudgets()` in `lib/plan.ts`; `planned-split.tsx` reworked; `BudgetGuideCard` in `empty-plan.tsx`; `addStarterPlan` and `missingStarterItems()` removed. The card shows no Not assigned row: it's about the pay, and the summary's Not assigned includes carry-in. The starter plan's Needs, Wants and Savings & debt lines confuse people; the split should be a budget per group that real items count against ("rent ₱2,000 comes off the ₱12,500 for Needs").
  - **Remove** "Use this starter plan" (the empty-plan button, the Plan options menu item and `addStarterPlan`). Existing starter lines stay; people can remove them (owner: leave them). No migration: the `starter` origin stays.
  - **The empty-plan card becomes a guide:** "Your 50/30/20 budget", the three groups in pesos from the budget's own split, then "Add bills, savings and spending budgets. Each one counts toward its group." The build rows stay.
  - **Group budgets on the Plan, phones and desktop:** "Needs · ₱2,000 of ₱12,500 planned · ₱10,500 left" (or "₱500 over", heads-up colour), a bar per group, and Not assigned. Replaces the percentages in the desktop Planned split card; new on phones. `groupBudgets()` in `lib/plan.ts`, tests first. Targets are the percentages of this payday's income, without carry-in.
  - **Docs:** plan.md §4–5, and a note in mvp-brief.md that the Week 5 one-tap starter plan was replaced.
- [ ] **7h. Live check.** Push, then go through the Dashboard on your phone and desktop.

## Open questions (answered Nov 26, see Decisions)

1. **The Oct 2026 – Apr 2027 range in "Done when".** The app can't plan that whole range today:
   - **The past:** the Plan reaches one period back and never before your first period (from onboarding). So Oct 2026 can't be planned.
   - **The future:** it reaches 3 months ahead (Nov 25 decision), so today it stops in late Feb 2027.
   - **The options:**
     - **(a)** Compare only what the app can plan now (about Nov 2026 – Feb 2027).
     - **(b)** Add a read-only **Paydays overview** listing each payday's planned totals up to Apr 2027, worked out by `generatePlan()` without opening the periods. This one page could also be the comparison tool for 7g.
     - **(c)** Raise the Plan's reach to 6 months.
   - **Suggest (b).** It keeps the 3-month editing limit and makes the Sheet comparison one page.
2. **The Dashboard's period switcher arrows** (app-shell.md §4). The Dashboard shows the current period only.
   - **Suggest:** the arrows open the previous and next periods **on the Plan** (`/plan?start=…`). The Dashboard stays "now", and Safe to spend never shows a meaningless future number.
   - **The alternative:** a Dashboard for any period, which means deciding what Safe to spend means for past and future periods.
3. **Which three categories on the Spending card** (dashboard.md fix #4 suggests the biggest planned amounts). Suggest that. The alternative is the three closest to their limit.
4. **Mobile "Next period" link** (fix #5, optional). Suggest a small "Plan next payday" link under Recent activity, going to the next period's plan.

5. **"Create a savings pot" is always done.** Onboarding creates starter pots (Emergency Fund, Sinking Funds), so the step is ticked on day one and "No pots yet" only shows if they're deleted. Suggest: tick it once any pot has money in it or a target. **Answered Nov 26 (owner: ok):** `potStarted()` ticks it once a pot has money or a target; the unticked step goes to Savings, not the add sheet.

## Decisions (owner, Nov 26: "go with your suggestions")

1. **(b) A read-only Paydays overview** up to Apr 2027 for the Sheet comparison (7g-1). The Plan's 3-month editing limit stays.
2. **The Dashboard's period arrows open the previous and next periods on the Plan.** The Dashboard always shows the current period.
3. **The Spending card shows the three budgets with the biggest planned amounts,** and links to the Plan for the rest.
4. **A small "Plan next payday" link under Recent activity on mobile,** to the next period's plan.
