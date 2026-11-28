# Chiwawallet Plan Spec

Nov 19, 2026 · Girly Gado

The Plan page is where each payday's money gets a job: income in, then bills, debt payments, savings, spending budgets and one-off items. Canvas files (on the **Plan** and **Payday & empty states** pages):

| Screen | Mobile | Desktop |
| --- | --- | --- |
| Plan | `Plan` | `PlanDesktop` |
| Empty plan | `PlanEmpty` | `PlanEmptyDesktop` |
| Add one-off item | `AddOneOff` (sheet) | `AddOneOffDesktop` (dialog) |
| Give leftover a job | `AssignLeftover` | `AssignLeftoverDesktop` |

The frame is in [`app-shell.md`](app-shell.md), tokens in [`style-guide.md`](style-guide.md), and the formulas Plan shares with the Dashboard in [`dashboard.md`](dashboard.md).

Routes: `/plan` (the current period), `/plan?start=2026-11-30` (any period, by its start date), `/plan/assign?start=…`. Query strings, not `[periodId]`: a dynamic segment breaks the build, and a future period doesn't need to exist before you open it.

> **Decided Nov 25 (owner):**
> - The picker shows one past period and future periods up to 3 months ahead (not just three).
> - Plan items have no note: tapping a row edits its name and amount (and "Needed by" for one-off items).
> - **Copy last period's plan** is v1.1 (`V1.1.md`): drop the desktop button and the menu item for now.
> - **Give leftover a job** (§7) and ticking items paid are Week 6. In Week 5 the tick circles are display only.
> - Installment and one-time debt payments due in the period are added automatically; "When I can" debts never are.
> - Starter items have no category: they carry a `budget_group` instead. Spending budgets are copied from `categories.default_budget` with origin `recurring`.

## 1. The numbers

| Name on screen | Formula | Example |
| --- | --- | --- |
| Money for this period | income (received, or expected if not yet in) + carried in | ₱25,000 + ₱5,000 = ₱30,000 |
| Planned | sum of all plan items | ₱2,700 + ₱4,000 + ₱5,000 + ₱9,500 = ₱21,200 |
| Not assigned yet | money for this period − planned | ₱8,800 |
| % planned (desktop) | planned ÷ money for this period | 71% |
| Paid or spent (desktop) | money out so far | ₱9,450, "45% of plan done" |

Group headers show their own progress, for example "₱1,700 of ₱2,700 paid", "₱3,000 of ₱5,000 saved" or "₱4,750 of ₱9,500 spent".

**Future periods** use expected income, carry-in is "—" until the period before closes, and "Paid or spent" is hidden.

## 2. Period picker

A sideways-scrolling row of period chips, inside `<nav aria-label="Payday periods">`. Each chip is `8px 14px`, 14px radius, with a caps label above the dates.

| Chip | Look | Mobile text | Desktop text |
| --- | --- | --- | --- |
| Past | White, 1.5px `line`, `text-3` | PAST · Oct 30 | PAST · Oct 30 – Nov 14 · "Closed · +₱5,000 left" |
| Now | Deep Green, 2px ink border, white text, `aria-current="true"` | NOW · Nov 15 – 29 | NOW · 15TH · "71% planned" |
| Next / Ahead | White, 1.5px **dashed** `line-dash` | NEXT · Nov 30 | NEXT · 30TH · Nov 30 – Dec 14 · "₱33,000 expected" |

- Show one past period and three future ones. The row scrolls to keep "Now" in view.
- Opening a future period for the first time creates it and runs `generatePlan()`.
- **Past periods are read-only** except for marking items paid. Show a small "Closed" tag in the summary.

## 3. Mobile layout

1. **Header:** the h1 "Plan" (Fredoka 28px), plus a 44px "Plan options" button with a menu: Edit spending budgets, Use starter plan, Period settings.
2. **Period picker.**
3. **Summary card**, a sticker card: white, 22px radius, 2px ink border, `5px 5px 0` shadow, 18px padding.
   - "Money for this period" and ₱30,000 in Fredoka 26px.
   - A 12px bar, filled `green-500` for planned and `mint` for the rest.
   - A two-row key: ■ Planned ₱21,200 and □ Not assigned yet ₱8,800.
   - When not-assigned is above ₱0, a soft 44px button: **Assign the ₱8,800**, which opens Give leftover a job.
4. **Group sections,** each with a 13px weight 800 caps `text-3` heading, a progress line on the right, and a list card:
   - **MONEY IN:** one row per income source ("Received Nov 15", "₱25,000", "of ₱25,000 expected") plus a "Carried in" row ("Left over from Oct 30 – Nov 14"). Income that hasn't arrived shows "Expected today" or "Expected Nov 30" with an **I got paid** pill.
   - **BILLS**, **DEBT PAYMENTS** and **SAVINGS:** tick rows (below).
   - **SPENDING BUDGETS:** one block per category with a planned amount: the name, "· Needs" or "· Wants" in `text-3`, "₱3,240 / ₱6,000", an 8px bar and "₱2,760 left".
   - **ONE-OFF ITEMS:** one-off rows, or a dashed empty card ("Gifts, events, fees or anything that only happens once. Plan them here so they don't surprise you.") with an **Add one-off item** button.

### Tick row

- A 28px circle on the left: unpaid is white with a 2px `line-dash` ring, and it's a button (`aria-label="Mark Subscriptions paid"`, or "Mark Travel pot added" for savings). Paid is solid `green-500` with a white tick.
- The name in weight 800, a 13px detail line and the amount on the right.
- **Detail lines:** "Recurring · Due Nov 22", "Recurring · Paid Nov 15", "Due Nov 25 · ₱4,000 left after", "Every 15th · Added Nov 15", "Split · half each payday".
- Tapping the circle marks the item paid (same behaviour as on the Dashboard). Tapping the row opens the item to edit its amount, date or note.

### Spending budget bar

- The bar is `green-500` under 90%, `gold` from 90% to 100%, and danger red (#B42318) over 100%.
- The text under it changes too: "₱2,760 left", "₱120 left", or "₱340 over" in #9B2C2C.

## 4. Desktop layout

> **Changed Nov 27 (owner, 7i):** the "Planned split of income" card is now **"Your 50/30/20 budget"**, on phones (under the summary) and desktop. Each group's budget is its percentage of this payday's pay; everything planned in the group counts against it: "Needs · ₱10,500 left · ₱2,000 of ₱12,500 planned", or "₱500 over" in the heads-up colour.

- **Header:** a `text-3` line with the budget's schedule ("Twice a month · 15th & 30th"), the h1 "Plan", and two buttons: **Copy last period's plan** (secondary) and **Add one-off item** (primary).
- **Period picker** with the longer chip text from section 2.
- **Four stat cards:**
  - Money in: ₱30,000, "₱25,000 income + ₱5,000 carried in".
  - Planned: ₱21,200, "9 items in 4 groups".
  - Not assigned yet: ₱8,800, "Give it a job below".
  - Paid or spent: ₱9,450, "45% of plan done".
- **Main column: one plan table** with the columns ITEM, DETAILS, PLANNED, ACTUAL, STATUS.
  - Groups are header rows (`<th scope="rowgroup">`) with the group total, for example "BILLS ₱2,700".
  - ACTUAL is "—" until something is paid. STATUS has a tick button or a "Paid" tag.
  - The spending rows show planned, actual and left. The one-off group shows the empty line with a "+ Add one-off item" link.
- **Side column:**
  - **Give ₱8,800 a job:** "Money without a plan tends to disappear. Put it somewhere useful." Three shortcut rows: Top up Emergency pot (43% full), Pay extra on SPayLater (₱8,000 owed), and Keep as buffer (carries over). Each opens Give leftover a job with that choice pre-filled.
  - **Planned split of income:** the 50/30/20 bar using **planned** amounts as a share of this payday's income. Needs 59% (target 50%), Wants 6% (target 30%), Savings & debt payoff 20% (target 20%), Not assigned 15%. Footnote: "Of this payday's ₱25,000 income. Planned debt payments count as needs; anything extra counts as savings & debt payoff."

The Dashboard's 50/30/20 card measures what was **spent**; this one measures what was **planned**. Keep both labels clear.

## 5. Empty plan and starter plan

> **Changed Nov 27 (owner, 7i):** "Use this starter plan" is gone (button and menu item); its Needs, Wants and Savings & debt lines confused people. The card is now a guide, "Your 50/30/20 budget", with the three groups in pesos and "Add bills, savings and spending budgets. Each one counts toward its group." Nothing is created. Existing starter lines stay until removed.

Shown when the period has no plan items (`PlanEmpty`).

- **Picker:** the first chip says "Now · first period".
- **Summary:** a plain card (no sticker). "Money for this period: ₱30,000, incl. ₱25,000 expected" and "Planned: ₱0, ₱30,000 not assigned".
- **Starter plan card,** a sticker card with the mascot (48px), h2 "Your plan is empty", and "Start with a 50/30/20 split of your ₱25,000 pay, then fine-tune."
  - Three tiles in a row: Needs ₱12,500 · 50% (`mint`), Wants ₱7,500 · 30% (yellow), Savings & debt ₱5,000 · 20% (blue).
  - Primary button **Use this starter plan**, with a hint under it: "Creates three budget lines you can split into categories later."
  - **What it does:** creates three `plan_items` with origin `starter`, each one the budget's percentage of this payday's **income** (not the carry-in).
- **MONEY IN:** the expected pay with an **I got paid** pill, plus "Starting balance · From setup · ₱5,000".
- **OR BUILD IT YOURSELF** (desktop: "OR BUILD YOUR PLAN PIECE BY PIECE"): a list of five rows, each with a tile, one sentence and a soft button:

| Row | Sentence | Button |
| --- | --- | --- |
| Bills | Electricity, internet, rent. Added once, planned every payday. | Add a bill |
| Debt payments | Cards, loans or SPayLater. We schedule each payment. | Add a debt |
| Savings | Pay yourself first. Start with an emergency fund. | Create a pot |
| Spending budgets | Limits for food, transport and fun. | Set a budget |
| One-off items | Gifts, events or fees happening once. | Add one-off |

## 6. Add one-off item

A bottom sheet on mobile, a centered dialog on desktop. `role="dialog"`, `aria-modal="true"`, titled "Add one-off item".

- **Subtitle:** "Something that happens once: a gift, event, fee or repair."

| Field | Control | Example |
| --- | --- | --- |
| What is it for? | Text input, 50px, focused first | Dad's birthday gift |
| Amount | ₱ money input, 50px, `inputmode="decimal"` | 2,500 |
| Needed by (optional) | Date button that opens a date picker | Dec 5 |
| Which payday pays for it? | A row of period radio cards (NOW, NEXT, AHEAD…) with their dates | Next: Nov 30 – Dec 14 |
| Category | Category chips: the four most used, plus **More**, which opens the category picker | Gifts |

- **Smart default:** when "Needed by" is set, pre-select the last period that starts on or before that date, and say so: "Suggested: the payday just before Dec 5."
- **Category group hint:** the line next to the Category label shows which group the category counts in ("Counts as Wants").
- **Impact box** (`mint`): "Nov 30 – Dec 14 not assigned: ₱23,200 → ₱20,700", plus "It'll show in that period's plan with a reminder before Dec 5." If the period would go below ₱0, use the yellow box and say "₱500 more than that period has left".
- **Button:** the hero sticker button **Add to plan** (56px). Desktop adds **Cancel**.
- **Saves:** a `plan_items` row with origin `one_off`, the chosen `period_id`, `needed_by` and `category_id`.

### Plan savings (added Nov 28, owner)

In the Plan options menu after **Plan a debt payment**, shown when you have at least one pot. Opens as `/plan?start=…&add=savings`. It works like Plan a debt payment, but for a pot.

- **Title:** "Plan savings", with the description "Money into one of your pots, from any payday."
- **Which pot?:** one radio row per pot, oldest first, showing "₱13,000 of ₱30,000" (or "₱13,000 saved" with no target). A pot whose target is already covered is greyed out with "Target covered" and can't be picked.
- **Amount:** the hint is "Up to ₱5,000 more fits in Emergency Fund's target. Savings count as Savings & debt payoff." or, with no target, "No target, so any amount works."
- **Cap:** the same rule as Give leftover a job: the target less the balance and less unpaid planned items for that pot in periods that haven't ended. Over it: "Only ₱5,000 more fits in Emergency Fund's target."
- **Payday cards and impact box:** as Add one-off item.
- **Saves:** a `plan_items` row with origin `one_off`, `pot_id` and the Savings pot category, so it shows under SAVINGS and counts as Savings & debt payoff. Mark paid turns it into a deposit. Toast: "Emergency Fund savings planned · Undo".

## 7. Give leftover a job

A full page on mobile; on desktop, the same content in a two-column page. Title "Give ₱8,800 a job", subtitle "Nov 15 – 29 · not assigned yet", plus a back arrow.

### Remaining card

A sticker card in an `aria-live="polite"` region. Its look follows the amount left:

| State | Background | Label | Big number | Hint |
| --- | --- | --- | --- | --- |
| Some left | Yellow #FFF6D6 / #5C4600 | LEFT TO ASSIGN | ₱1,800 | Tap + to give the rest a job, or keep it as a buffer. |
| All assigned | Deep Green / white | ALL ASSIGNED | ₱0 | Every peso has a job. |
| Too much | Danger bg #FBEBEB / #9B2C2C | TOO MUCH ASSIGNED | −₱500 | Lower one of the amounts below. |

Under the number, a 12px stacked bar shows each destination's share.

### Presets

38px pill buttons that fill in the amounts:
- **Save it all:** everything to the Emergency pot.
- **Debt first, then save:** pay the debt in full, then the rest to Emergency.
- **Keep it all:** everything to the buffer.
- **Start over:** clears everything. It has a dashed border.

### Destination rows

One row per pot and debt, plus **Keep as buffer**. Each row has:
- a 40px tile, the name and a detail line ("₱13,000 of ₱30,000", "₱4,000 left after Nov 25", "Carries over to Nov 30 – Dec 14")
- a stepper: 44px − and + buttons with an amount in Fredoka 24px between them
- an effect line under the stepper

| Rule | Detail |
| --- | --- |
| Step | ₱500 per tap; tapping the amount opens a keypad for an exact number |
| Max | A pot can't go past its target; a debt can't go past what's owed; the buffer can take everything |
| Selected row | 2px `green-600` border when its amount is above ₱0 |
| Effect line | "Emergency → ₱16,000 (53%)", "Debt-free after this!", "₱1,800 rolls into next period", or "No change" |
| Group line | Pots and debts say "Savings & debt payoff"; the buffer says "Stays unassigned" |

### Totals box and button

- **Totals box:** "Savings & debt payoff this period: ₱12,000" and "Carries over to Nov 30: ₱1,800".
- **Button:**
  - All assigned: hero button "Assign ₱8,800".
  - Some left: "Assign ₱7,000, keep ₱1,800".
  - Too much: a disabled grey button, "Remove ₱500 to continue".
- **Desktop footnote:** "Assigned amounts become plan items you can tick off, just like your bills and savings."

**Saves:** one `plan_items` row per destination above ₱0, with origin `assigned`, linked by `pot_id` or `debt_id`. Extra debt payments made this way count as **Savings & debt payoff**. The buffer creates no item; it just stays as leftover and carries over.

## 8. Accessibility

- [ ] Tick circles are real `<button>`s with names ("Mark Subscriptions paid"); after ticking, the name becomes "Subscriptions, paid".
- [ ] The period picker chips are links; the current one has `aria-current`.
- [ ] Steppers: the − and + buttons name the destination ("More to Emergency pot"), and the amount is `aria-live="polite"`. Disable the − button at ₱0 and the + button at the max.
- [ ] The remaining card is announced when it changes state ("All assigned").
- [ ] The desktop plan table uses `<th scope="rowgroup">` for group rows and `<th scope="row">` for item names.
- [ ] The sheet and dialog trap focus and close with Esc. Focus starts on the first field.

## 9. Fix before building

1. **Date format:** desktop chips say "Dec 15 – Dec 29". Use **Dec 15 – 29**.
2. **Placeholder links:** "Set a budget" and the period chips point to `#`. "Set a budget" needs a spending-budget editor, which isn't designed yet. A simple sheet will do: category, amount, and "every payday" or "this period only".
3. **Spending budgets in the data model:** they come from `categories.default_budget`, copied into each period as plan items. Confirm the origin to use for those copies; the brief only lists `recurring`, `one_off`, `starter` and `assigned`. Suggest `recurring`.
4. **The Plan options menu** (mobile) isn't designed. Keep it to the three items in section 3.
5. **Copy last period's plan** (desktop) has no mobile version and no defined behaviour. Suggest: copy the previous period's one-off and spending items into this period, skip anything already there, and show an Undo toast. Add it to the mobile Plan options menu too.
6. **Travel pot "Split · half each payday":** pots don't offer split in New pot, and Savings shows Travel as "₱2,000 each payday". Show it as **Every payday** here too, and keep `split` for bills only (see `savings.md`).
