# Chiwawallet Payday Rollover Spec

Nov 19, 2026 · Girly Gado

The screen that appears on payday: it closes the last period, asks what to do with the leftover, and opens the new one. Canvas files: `Rollover` and `RolloverDesktop` (on the **Payday & empty states** page). It uses the carry-over rules from the brief and the leftover choices from Give leftover a job ([`plan.md`](plan.md)).

Route: `/payday/[periodId]`. It's shown automatically, not linked from the navigation.

## 1. When it shows

- The first time the user opens the app on or after a payday, if the previous period isn't closed (`budget_periods.closed_at` is empty).
- Only when `budgets.ask_on_payday` is on (the default). When it's off, the period closes silently and the leftover is carried in.
- Also after **Start my next period now** (Nov 28, Task D; dashboard.md): the old period ends yesterday, so it shows right away, before the payday itself. Its numbers count from the old period's first day to yesterday; today's transactions are in the new period.
- If several periods were missed (for example, no visits for a month), close them in order with the default **Carry** choice and show this screen only for the most recent one.
- The user can leave with **Go to dashboard** without choosing. In that case the default (Carry) is applied, so the numbers are never left half-done.

## 2. The numbers

| Value | Formula | Example |
| --- | --- | --- |
| Left over | the closing period's money − everything used | ₱30,000 − ₱20,800 = ₱9,200 |
| Planned payments made | the closing period's bill, debt and savings items that were paid | 5 of 5 |
| Under / over spending plan | spending budgets planned − spent | ₱400 under |
| Saved | savings transfers in the closing period | ₱5,000 |
| Money for the new period | the new period's expected income + carried in | ₱25,000 + ₱8,000 + ₱9,200 = ₱42,200 |
| Not assigned yet | money for the new period − already planned | ₱42,200 − ₱19,000 = ₱23,200 |

**If the left over is negative** (overspent): the title becomes "₱1,200 over", and the only choices are **Carry it into this period** (it reduces the new period's money) or **Cover it from a pot** (pick a pot). Say it plainly, with no scolding: "That's okay. It'll come out of this payday."

## 3. Layout

### Mobile

A single page on `bg`, 32px top padding, sections 16px apart:

1. **Header:** the mascot on a 112px `mint` circle, "IT'S PAYDAY" (13px weight 800, `green-600`, 1px letter spacing), and the h1 "Nov 30 – Dec 14 has started" (Fredoka 30px).
2. **"How Nov 15 – 29 went"** (a plain card, 20px radius) with a "CLOSED" tag.
   - "Left over: ₱9,200" in Fredoka, then a bar for "₱20,800 used of ₱30,000".
   - **Three wins,** each with a tick tile: "All 5 planned payments · made on time", "₱400 under · your spending plan", "₱5,000 saved · to Emergency and Travel".
   - Show only true, positive facts. If none apply, show the plain numbers.
3. **"What should happen to the ₱9,200?"** (a sticker card): four radio cards, each with a live effect line.

| Choice | Effect line | Saves `leftover_choice` |
| --- | --- | --- |
| Carry it into this period (default) | This period gets ₱42,200 to work with | `carry` |
| Move it to Emergency pot | Emergency would be ₱22,200 of ₱30,000 (74%) | `pot` |
| Pay off SPayLater early | Clears the last ₱4,000; ₱5,200 still carries over | `debt` |
| Split it myself | Choose how much goes where | `split` (opens Give leftover a job) |

   The pot and debt options show the user's first pot with a target that isn't full, and their earliest active debt. Hide an option if there's no such pot or debt.
4. **"Your new period is ready"** (a plain card) with a "30th payday" tag:
   - Money in: "Main job · expected today ₱25,000", "Freelance · expected today ₱8,000", "Carried in ₱9,200", then "Money for this period ₱42,200" in bold.
   - "ALREADY PLANNED FROM YOUR REPEATS": rows for each generated plan item (Electricity · Bill · due Nov 30 · ₱2,500; MP2 · Savings · every 30th · ₱5,000; the spending budgets…).
   - "Not assigned yet ₱23,200" in a yellow heads-up strip (#FFF6D6 / #5C4600).
   - The Carried in, Money for this period and Not assigned numbers update when the choice above changes.
5. **Buttons:** **Review my plan** (hero), then **Go to dashboard** (text link).

### Desktop

A `mint` page, centered, max 1080px wide, with padding `40px clamp(16px, 4vw, 56px)`. The header is centered on top, then two columns (`flex: 1 1 420px` each): "How it went" plus the choice card on the left, "Your new period is ready" on the right. The buttons sit side by side under the right column: **Review my plan** (hero) and **Go to dashboard** (secondary, 56px).

## 4. What happens on confirm

All in one server action:

1. Close the old period: set `closed_at` and `leftover_choice`.
2. Apply the choice:
   - **Carry:** set the new period's `carried_in`.
   - **Pot:** create a savings transaction dated the last day of the old period.
   - **Debt:** create a debt payment (extra, counted as Savings & debt payoff), and carry the remainder.
   - **Split:** open Give leftover a job for the old period, then carry whatever is kept.
3. Make sure the new period exists and has run `generatePlan()`.

Pressing **Review my plan** or **Go to dashboard** confirms the current choice.

## 5. Accessibility

- [ ] The choices are a radio group (`role="radiogroup"` with an `aria-labelledby` heading), and each effect line is part of its option's description.
- [ ] Totals in "Your new period is ready" are `aria-live="polite"`.
- [ ] Focus starts on the h1, so screen readers hear "It's payday" first.

## 6. Fix before building

1. **"Travel pot · Savings · split":** show it as "Every payday", as on the Savings page (`savings.md`).
2. **"expected today" income** isn't money in hand yet. Keep the wording "expected", and keep the **I got paid** prompt on the Dashboard until it's logged.
3. **Overspent version** isn't designed. Use the copy in section 2.
