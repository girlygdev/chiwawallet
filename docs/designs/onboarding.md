# Chiwawallet Onboarding Style Guide

Nov 19, 2026 · Girly Gado

How to build first-time setup: three steps that create the user's first budget, then a "You're all set" screen. This guide adds to [`style-guide.md`](style-guide.md) and uses its token names. The **Onboarding** page on the [design canvas](https://claude.ai/artifact/Cj6taSLB1R4SoTxvbm8Hnd) shows every screen.

## 1. Screens and flow

| Step | Screen | Canvas file (mobile / desktop) | Route (suggested) | Saves |
| --- | --- | --- | --- | --- |
| 1 | Your budget | `OnbBudget` / `OnbBudgetDesktop` | `/onboarding/budget` | `budgets` row; `profiles.week_start` |
| 2 | Income | `OnbIncome` / `OnbIncomeDesktop` | `/onboarding/income` | `income_sources` rows |
| 3 | Starting point | `OnbStart` / `OnbStartDesktop` | `/onboarding/start` | `budgets.opening_balance`; first `budget_periods` row and its plan |
| Done | You're all set | `OnbDone` (mobile only) | `/onboarding/done` | Nothing |

```
Email confirmed / Google sign-in ──► 1 Your budget ──► 2 Income ──► 3 Starting point ──► Done ──► Empty dashboard
                                                                        └── Skip, I'll add these later ──┘
```

- **Who sees it:** any logged-in user with no budget yet. Middleware sends them to `/onboarding/budget`, and they can't reach app pages until a budget exists. No extra "onboarded" field is needed.
- **Each step saves when you press Continue.** If someone closes the app, they come back to the first unfinished step: no budget → step 1, a budget but no income → step 2, no opening balance → step 3.
- **Back** goes to the previous step with its values filled in. Step 1 has no Back; it shows the logo instead.

## 2. Layout

### Mobile (under 768px)

- Full screen on `bg`, no bottom navigation. Padding `16px 20px 24px`, 18px between blocks.
- **Top bar, 44px tall:** the logo (step 1) or a Back arrow (steps 2–3) on the left, "Step N of 3" on the right (13px weight 800 `text-3`).
- **Progress bar** under the top bar: three 6px pill segments with 6px gaps. Done and current steps are `green-500`; later steps are `line`.
- **Title block:** Fredoka 600 26px title, 15px `text-3` subtitle, 4px gap.
- **Main button** pinned to the bottom with `margin-top: auto`. Designed at 390 × 844px; the page scrolls if content is taller, and the button must never be hidden.

### Desktop (1024px and up)

A two-part screen that wraps into one column on narrow screens.

- **Left rail** (`flex: 1 1 280px`, `mint` background, padding `32px 28px`): logo and wordmark, then the step list, then "You can change any of this later in Settings." at the bottom (13px `text-3`).
- **Main area** (`flex: 999 1 560px`, `bg`, padding `48px clamp(20px, 4vw, 64px)`, 32px gaps):
  - **Header:** "STEP N OF 3" label (13px weight 800 caps, `text-3`), Fredoka 600 36px title, 17px `text-3` subtitle, max 720px wide.
  - **Body:** a form column (max 640–680px) next to a **preview card** (280–380px) that shows the result of what's being entered. The two wrap with a 32px gap.
  - **Footer:** Back (secondary) on the left, Continue (primary) on the right, max 1104px wide.

### Step list (desktop rail)

Each step is a row with a 30px circle, a 12px gap, a name (weight 800) and a 13px `text-3` detail line, padding `12px 14px`, 14px radius.

| State | Circle | Row | Detail line |
| --- | --- | --- | --- |
| Done | `green-500` with a white tick | Plain, a link back to that step | What was chosen: "Twice a month · 15th & 30th", "2 sources · ₱58,000 a month" |
| Current | `green-600` with the white number | White, 2px `ink` border | What the step covers |
| Later | `line` with a `text-2` number | Plain, name in `text-2` | What the step covers |

Mark the current step with `aria-current="step"`.

## 3. Step 1: Your budget

**Title:** "Hi {name}! Let's set up your budget." `{name}` is `profiles.display_name`; if empty, use "Let's set up your budget."
**Subtitle:** "We'll plan around the days you get paid." (Desktop adds: "…not the calendar month.")

| Field | Control | Default | Saves to |
| --- | --- | --- | --- |
| Budget name | Text input, 48px | "My budget" | `budgets.name` |
| How often do you get paid? | Radio cards: Weekly, Twice a month, Monthly | Twice a month | `budgets.frequency` |
| Your paydays | Depends on frequency (below) | 15th and 30th | `pay_day_1`, `pay_day_2`, `pay_weekday` |
| Week starts on | Segmented control: Monday, Sunday | Monday | `profiles.week_start` |

**Radio cards:**
- **Mobile:** stacked rows with `12px 14px` padding and a 14px radius.
- **Desktop:** an auto-fit grid of 170px-minimum cards with 16px padding and a 16px radius.
- Each card has a 20px radio (`accent-color: #177A42`), a 15–16px weight 800 name and a 13px hint: "Same day every week", "Two paydays, like the 15th and 30th", "One payday a month".
- **Selected:** 2px `green-600` border, `mint` fill, hint in `text-2`. The cards sit in a `<fieldset>` with a `<legend>`.

**Payday fields change with frequency.** Only Twice a month is drawn. Build the others the same way:

| Frequency | Fields |
| --- | --- |
| Twice a month | Two selects side by side: "1st payday" and "2nd payday", days 1–31. The second must be later than the first. |
| Monthly | One select: "Payday", days 1–31. |
| Weekly | A 7-option segmented control or select: "Payday" (Mon–Sun). Saves `pay_weekday`. |

- Field sub-labels are 12px weight 700 `text-3`, and the selects are 48px tall.
- Show the hint "Short month? We'll use its last day, like Feb 28." (12px `text-3`) whenever a payday is 29, 30 or 31.
- **Week starts on:** a `track` segmented control with 4px padding and 40px options. The selected option is white, weight 800, with the soft lift shadow. Use `role="radiogroup"`, with `role="radio"` and `aria-checked` on each option.

**Desktop preview card, "YOUR NEXT PAYDAY PERIODS":** a sticker card (2px ink border, 6px shadow, 20px radius) listing the next four periods.
- **Rows:** each has a 12px radius and `10px 12px` padding. The first row is `mint` with weight 800 text; the rest are `bg`. A small pay-slot tag ("15th", "30th") sits on the right.
- **Footnote:** "Each period runs from one payday to the day before the next."
- Build it with the same `getPeriod()` function the app uses, so the preview can never disagree with the real periods. It updates live as the fields change.

**Button:** Continue (mobile), Continue to income (desktop).

## 4. Step 2: Income

**Title:** "Where does your money come from?"
**Subtitle:** "Add each income and the payday it lands on." (Desktop adds: "Different amounts on each payday are fine.")

**Income list:**
- **Mobile:** one card per income (white, 1.5px `line`, 16px radius, 14px padding). The top line has the name (16px weight 800) and an edit button (44px tap area, `aria-label="Edit {name}"`). The bottom line has the amount (Fredoka 24px) and a "lands on" tag.
- **Desktop:** a table in a white box with an 18px radius and these columns: INCOME, AMOUNT (right-aligned), LANDS ON, and an edit button. The headers are 12px weight 800 caps `text-3`, and the box scrolls sideways if it gets too narrow.

**"Lands on" tags** come from `income_sources.pay_slot` and the payday dates:

| `pay_slot` | Tag | Colors |
| --- | --- | --- |
| `every` | Every payday | Positive (`mint` / Forest) |
| `payday_1` | 15th only (uses the real date) | Heads-up (yellow) |
| `payday_2` | 30th only (uses the real date) | Heads-up (yellow) |

For weekly and monthly budgets there's only one payday, so hide the "Lands on" choice and save `every`.

**Adding income:**
- **Mobile:** a dashed "+ Add another income" button (52px, 16px radius, dashed `line-dash`, `green-600` text) opens the New income sheet (`NewIncome` on the canvas).
- **Desktop:** an inline form in a dashed box: Income name, Amount (₱), Lands on and a soft "Add income" button, all 46px tall and wrapping on narrow widths.

**Preview, "EXPECTED PER PAYDAY":** a sticker card with the total for each payday.
- **Mobile:** two numbers side by side (Fredoka 22px).
- **Desktop:** each payday has a Fredoka 24px total and a 10px progress bar scaled to the biggest payday, then a divider and "Per month" in `green-600`.
- **Per month** is payday 1 + payday 2 for twice a month. For weekly, use the weekly total × 52 ÷ 12 and label it "About … a month".
- The totals sit in an `aria-live="polite"` region.

**Rules:**
- Continue needs at least one income. If there isn't one, show it disabled with the line "Add at least one income to continue."
- An income with "Amount changes" on (`amount_varies`) still needs a typical amount for planning.

**Buttons:** Continue (mobile); Back and Continue to starting point (desktop).

## 5. Step 3: Starting point

**Title:** "Where are you starting from?"
**Subtitle:** "Total money you have right now: bank, cash and e-wallets."

**Starting balance:** a big money input, 64px tall on mobile and 68px on desktop, with a 16px radius and a 2px `green-600` border (it starts focused).
- A `text-3` ₱ prefix, and the amount in Fredoka 600 at 28–30px.
- `inputmode="decimal"`. Centavos show while typing ("5,000.00") and the value saves as `bigint` centavos.
- ₱0 is allowed, and so is a negative amount, with a minus sign, for people who start out overdrawn.

**"Add these now, or later" (optional):** three entry points with an "Optional" tag on the right.

| Item | Icon tile | Mobile hint | Desktop hint | Opens |
| --- | --- | --- | --- | --- |
| Recurring bills | Yellow | Electricity, internet, rent, subscriptions | + "Pick which payday pays each one." | New bill sheet |
| Savings pots | Green | Emergency fund, travel, MP2 | + "Set a target and how much to save each payday." | New pot sheet |
| Debts | Red | Credit cards, SPayLater, installments | + "Add the amount and due date." | New debt sheet |

- **Mobile:** link rows (white, 16px radius, 14px padding, 44px icon tile, chevron on the right).
- **Desktop:** an auto-fit grid of 190px-minimum cards (18px padding, 48px icon tile, 14px hint, soft "Add …" button at the bottom).
- Each one opens the same add sheet the app uses and comes back here when saved. Once something is added, show a count instead of the hint, for example "2 bills · ₱3,450".

**Desktop preview, "YOUR FIRST PERIOD":** a sticker card with a status tag, the period dates (Fredoka 26px), then these rows:
- Expected income (15th)
- Starting balance
- a divider, then **Ready to plan** in `green-600`
- the footnote "Bills, savings and debt payments you add will appear here as planned items."

**Buttons:**
- **Mobile:** Finish setup (primary), with a text link under it: "Skip, I'll add these later."
- **Desktop:** Back on the left; the skip link and Finish setup on the right.
- Both Finish and Skip save the starting balance. Skip only means the optional items were skipped.

**On finish:** save `opening_balance`, create the first `budget_periods` row and run `generatePlan()` for it, all in one server action so a half-finished setup can't happen.

## 6. Done: You're all set

Mobile only for now (see Fix before building).

- A 176px `mint` circle with a 140px mascot, the Fredoka 32px title "You're all set!", and "Your budget is ready. Here's your first payday period."
- **First period card:** a sticker card with a 5px shadow and the same rows as the desktop preview. The tag says "FIRST PERIOD".
- **Tip:** a yellow heads-up note: "Tip: tap the + button anytime to log an expense in seconds."
- **Button:** "Go to my dashboard" opens the empty dashboard, which then suggests the starter 50/30/20 plan.

## 7. Words

| Spot | Copy |
| --- | --- |
| Rail footer | You can change any of this later in Settings. |
| Short-month hint | Short month? We'll use its last day, like Feb 28. |
| Period footnote | Each period runs from one payday to the day before the next. |
| Skip link | Skip, I'll add these later |
| Finish | Finish setup |
| Success | You're all set! |

- Say "payday" and "period", never "month" or "cycle".
- Keep it warm and short. Setup should take about two minutes.

## 8. Accessibility

- [ ] One `<h1>` per step. On desktop, "Add these now, or later" is an `<h2>`.
- [ ] The progress bar has `role="progressbar"` with `aria-valuenow`, `aria-valuemin="1"`, `aria-valuemax="3"` and `aria-label="Setup progress"`, or is hidden with `aria-hidden` if "Step N of 3" text is always shown.
- [ ] Radio cards use real radio inputs inside `<label>`s, grouped in a `<fieldset>` with a `<legend>`.
- [ ] Payday selects each have their own `<label>` ("1st payday", "2nd payday").
- [ ] Preview totals and period lists update in an `aria-live="polite"` region.
- [ ] When moving to the next step, focus goes to the new `<h1>`.
- [ ] Edit buttons name the item: "Edit Main job".

## 9. Fix before building

1. **First period may already have started.** The screens show "Starts tomorrow · Nov 15 – Nov 29", but most people sign up mid-period. Use the period that contains today, and set the tag to "Started Nov 15" or "Starts tomorrow" depending on the date. If today's period has started, ask one question on step 3: "Has your Nov 15 pay already arrived?" If yes, it's already in the starting balance, so mark that income as received instead of adding it again. Otherwise income gets counted twice.
   **Decided Nov 19:** ask the question in Week 2 and save the answer as `budget_periods.first_pay_received`. Week 3 turns it into a received income transaction.
2. **Weekly and monthly payday fields** aren't drawn. Build them from section 3.
3. **No desktop Done screen.** Desktop goes straight to the empty dashboard. Either add a desktop version of `OnbDone` (centered card on `mint`, like Set new password), or show the same message as a one-time banner on the desktop dashboard. Pick one so both devices end the same way.
   **Decided Nov 19:** a desktop Done card on `mint`.
4. **Date format:** "Nov 15 – Nov 29" should be **Nov 15 – 29** per the style guide. Keep the month on both sides only when it changes ("Nov 30 – Dec 14").
5. **Placeholder links:** the three optional items on mobile step 3 point to `#`. Connect them to the New bill, New pot and New debt sheets.
6. **Field heights:** onboarding uses 48px inputs and selects, auth uses 52px. Use **48px inside the app** (onboarding and sheets) and keep 52px for auth only. Write that rule into `style-guide.md` once you decide.
   **Decided Nov 19:** 48px in the app, 52px for auth only; now in `style-guide.md`.
7. **Sample name:** "Hi Reggie!" is canvas sample data. In code it comes from `display_name`.
