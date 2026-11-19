# Chiwawallet Dashboard Spec

Nov 19, 2026 · Girly Gado

The home screen: how this payday period is going, at a glance. Canvas files: `Dashboard`, `DashboardDesktop`, `DashboardEmpty` and `DashboardEmptyDesktop` (on the **Dashboard** and **Payday & empty states** pages). The frame (bottom bar, sidebar, header, period switcher) is in [`app-shell.md`](app-shell.md); tokens are in [`style-guide.md`](style-guide.md).

Route: `/` (or `/dashboard`). It shows the period that contains today unless the switcher moves it.

## 1. The numbers

All amounts are for the selected period, in centavos, from the database. Never calculate them in the browser from rounded values.

| Name on screen | Formula | Example |
| --- | --- | --- |
| This period's money (desktop) | income received + carried in | ₱25,000 + ₱5,000 = ₱30,000 |
| Money out so far | expenses + savings transfers + debt payments logged this period | ₱9,450 |
| Cash now | this period's money − money out so far | ₱20,550 |
| Still due | unpaid plan items for bills, savings and debts | ₱1,000 + ₱4,000 + ₱2,000 = ₱7,000 |
| **Safe to spend** | cash now − still due | ₱20,550 − ₱7,000 = **₱13,550** |
| Per day | safe to spend ÷ days left, counting today | ₱13,550 ÷ 10 = ₱1,355 |

- **Days left:** count today, in Manila time. On Nov 20 in the Nov 15 – 29 period, that's 10.
- **If Safe to spend is below ₱0:** show it with a minus sign and replace the per-day pill with "Over by ₱X". The hero card stays green; the pill turns danger-coloured (#FBEBEB with #9B2C2C text).
- **Expected but not received income** doesn't count in Safe to spend until it's logged. It shows as an "I got paid" prompt (section 4).

Write these as pure functions in `lib/money/` with Vitest tests, and use the same functions on Plan.

## 2. Mobile layout

Top to bottom, 16px side padding and 16–18px between sections:

1. **Header and period switcher** (`app-shell.md`).
2. **Safe to spend card**, the hero: Deep Green (#157A41), white text, 24px radius, 2px ink border, `5px 5px 0` shadow, 20px padding.
   - A "Safe to spend" label, then the amount in Fredoka 600 44px, with a per-day pill beside it ("₱1,355 / day": Forest fill #0F5E34, mint text, 13px weight 800).
   - Explanation line: "After ₱7,000 in bills, savings and debts still due this period."
   - **Spend bar:** a 10px Forest track with a `gold` fill set to money out ÷ this period's money (32%). Under it, "₱9,450 out so far" on the left and "of ₱30,000" on the right.
   - **Three small stats in a row:** Carry-in ₱5,000 · Income ₱25,000 · Cash now ₱20,550.
3. **Due this period:** a list card of unpaid and recently paid bills, debts and pot transfers, then a "See all" link that opens Plan.
4. **Spending:** a card with up to three expense categories that have a planned amount, each with "₱3,240 / ₱6,000" and an 8px progress bar, then a "Plan" link.
5. **Savings pots:** cards showing the name, a Fredoka 22px balance, an 8px bar and "43% of ₱30,000", then a "See all" link.
6. **50/30/20 check** (section 5).
7. **Recent activity:** the last four transactions, then a "See all" link that opens Activity.

### Due row

A 40px category tile, the name (weight 800), a 13px detail line and the amount on the right, with an action pill under the amount.

| Kind | Detail line | Tile | Action |
| --- | --- | --- | --- |
| Bill | "Bill · Due Nov 22" | Yellow | **Mark paid** |
| Debt | "Debt · Due Nov 25" | Red | **Mark paid** |
| Savings | "Savings · Planned" | Green | **Add to pot** |
| Paid item | "Paid Nov 15" | Solid `green-500` with a white tick | None; amount in `text-3` |

- Action pills are 30px tall with `0 10px` padding: `mint` fill, Forest 12px weight 800 text. Give them a 44px tap area with padding.
- Order: unpaid items by due date, then paid items. Show at most five rows.
- **Mark paid** creates the transaction for the full planned amount, dated today, with a 5-second Undo toast. To change the amount or date, tap the row to open its plan item.

### Pot card

- **Normal pot:** progress = balance ÷ target. With no target, show the balance and "No target" instead of a bar.
- **Locked pot** (MP2): a lock icon next to the name, a full bar in `line-dash` (#9CC9AE), and "Locked savings" instead of a percentage.
- On mobile the pots scroll sideways in one row, each card 150–160px wide.

## 3. Desktop layout

The main area is a wrapping grid, max about 1100px wide.

**Header:** the greeting, the h1 "Your payday at a glance", the period switcher, and the Add transaction button.

**Stat row:** four cards in an `auto-fit, minmax(210px, 1fr)` grid, each with a 20px radius and 18px padding.

| Card | Big number | Line under it |
| --- | --- | --- |
| **Safe to spend** (hero, sticker) | ₱13,550 | "₱1,355 a day for 10 days" |
| Money out so far | ₱9,450 | A bar and "32% of ₱30,000" |
| This period's money | ₱30,000 | "₱25,000 income + ₱5,000 carried in" |
| Still due | ₱7,000 | "1 bill, 1 debt, 1 savings transfer" |

**Body:** two columns.
- **Main column** (`flex: 2 1 460px`):
  - *Due this period*, with an "Open plan" link. The detail lines are longer than on mobile, for example "Due Nov 22 · in 2 days" or "₱4,000 left after this". Paid items get a "Paid" tag.
  - *Spending vs plan*, with a "₱4,750 of ₱9,500" total in the heading row.
  - *Recent activity*, as a table: DESCRIPTION, CATEGORY, DATE, AMOUNT. The last five rows, with an "All transactions" link.
- **Side column** (`flex: 1 1 300px`):
  - *Savings pots*, with a "Manage" link. Each pot shows "₱13,000 / ₱30,000" and a line such as "+₱3,000 this period" or "₱2,000 planned this period". Locked pots go in a compact `bg` row.
  - *50/30/20 check*.
  - *Next period*, a `mint` card: "NEXT PERIOD", "Nov 30 – Dec 14", then "₱33,000 expected · Electricity and MP2 due", then a **Plan ahead** link to that period's plan.

## 4. Empty and first-day state

Shown when the period has no transactions and no plan items, usually right after onboarding (`DashboardEmpty`).

- **Header line:** "Your first payday period · Day 1 of 15". Desktop h1: "Welcome to your first payday".
- **Safe to spend:** the starting balance (₱5,000), with "Your starting balance. Nothing planned yet."
- **Pay prompt:** while an income source's payday has come but its pay isn't logged, a Forest panel inside the hero card says "₱25,000 from Main job is due today." with a white **I got paid** button (40px, 10px radius). It opens Add income pre-filled with the source and amount.
- **Get started checklist:** a sticker card titled "Get started" with "1 of 5 done" and an 8px progress bar. Desktop subtitle: "A few minutes now makes every payday easier." The steps:
  1. Set up your budget, with the detail "Twice a month · 15th & 30th" (always done)
  2. Confirm today's pay, with the detail "₱25,000 from Main job"
  3. Add your bills
  4. Create a savings pot, with the detail "Start with an emergency fund"
  5. Log your first expense, with the detail "Takes about 10 seconds"
  - Each step is a link row with a 28px circle: solid `green-500` with a tick when done, a 2px dashed `line-dash` ring when not.
  - The card disappears once all five are done, or when the user dismisses it.
- **Empty sections:** dashed `line-dash` cards with the mascot (48–64px), a title, one sentence and a soft button.

| Section | Title | Sentence | Button |
| --- | --- | --- | --- |
| Due this period | No bills or debts yet | Add them once and Chiwawallet reminds you each payday. | Add a bill |
| Savings pots (desktop) | No pots yet | Most people start with an emergency fund of 3 to 6 months of needs. | Create a pot |
| Recent activity | Nothing logged yet | Tap the + button below to log your first expense. (Desktop: Your income and expenses will show up here.) | Log an expense |

Hide Spending, 50/30/20 and Next period until there's data for them.

## 5. 50/30/20 check

- A 14px stacked bar: Needs #157A41, Wants #F4C430, Savings & debt payoff #7FD3A3, in that order. Show a gap or white line between segments.
- Under it, one row per group: a 10px colour square, the name, the actual % (bold) and a comparison with the budget's target (`needs_pct`, `wants_pct`, `savings_debt_pct`).
  - **Mobile:** "Target 50%".
  - **Desktop:** "11 pts over 50%", "target 30%", "above 20%".
- **Base:** money out so far this period. Expenses count by their category's group, transfers to pots count as Savings & debt payoff, and debt payments count by the rule below.
- **Footnote:** "Share of money out so far this period. Extra debt payments count as savings & debt payoff."
- **Debt rule:** a debt payment that pays a planned item counts as Needs; any payment beyond the plan counts as Savings & debt payoff.
- Over-target is shown in words, never by colour alone. Don't scold: the numbers speak for themselves.
- Hide the card until money out is at least ₱1,000, so a single coffee doesn't show "100% Wants".

## 6. Accessibility

- [ ] The Safe to spend card is a `<section aria-label="Safe to spend">`, and its amount is in an `aria-live="polite"` region so it's announced after Mark paid.
- [ ] Progress bars have `role="progressbar"` with values, or text right next to them that says the same thing ("43% of ₱30,000").
- [ ] Action pills name their item: `aria-label="Mark Subscriptions paid"`.
- [ ] The desktop activity table has `<th scope="col">` headers; amounts are right-aligned and use a real minus sign (−).
- [ ] The checklist is an `<ol>`, and done steps have visually hidden "Done" text.

## 7. Fix before building

1. **Date format:** "Nov 15 – Nov 29" should be **Nov 15 – 29**.
2. **Notification dot:** #E0533D isn't a token. Use `danger`.
3. **Placeholder links:** "See all", "Manage", "Plan ahead" and several checklist rows point to `#`. Wire them to Plan, Savings, the next period's plan, and the Bills and Savings add sheets.
4. **Spending card:** mobile shows three categories with no rule for which three. Use the three with the biggest planned amounts and link to Plan for the rest.
5. **Mobile "Next period"** isn't on mobile. Optional: add it as a small link under Recent activity.
