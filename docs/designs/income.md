# Chiwawallet Income Spec

Nov 19, 2026 · Girly Gado

Regular income sources (a job, a side gig, an allowance) and the payday each one lands on. Canvas files: `Income`, `IncomeDesktop` and `NewIncome` (on the **Savings, debts, bills & income** page). Logging money that actually arrived uses the Income tab of the add sheet ([`activity.md`](activity.md)). The first sources are created in onboarding step 2 ([`onboarding.md`](onboarding.md)).

Routes: `/income`, `/income/new`, `/income/[sourceId]/edit`.

## 1. The numbers

| Value | Formula | Example |
| --- | --- | --- |
| Per payday | the sources whose pay slot matches that payday | 15th ₱25,000 · 30th ₱25,000 + ₱8,000 = ₱33,000 |
| Expected each month | the sum of the per-payday totals (weekly: × 52 ÷ 12) | ₱58,000 |
| Per source, per month | amount × the number of paydays it lands on | Main job ₱50,000 · Freelance ₱8,000 |
| Expected vs received | for each period: the expected amount, then the logged income for that source | "₱500 less than expected" |

## 2. Mobile list

- **Header:** a back arrow to More, the h1 "Income", and a 44px **+** sticker button (`aria-label="Add income source"`).
- **Summary card,** the hero: "Expected each month", ₱58,000, "2 sources". Then two small stats: "15th payday ₱25,000" and "30th payday ₱33,000".
- **SOURCES:** one card per source, each a link to edit.
  - Top row: the name, the schedule line ("Every payday · ₱50,000 a month", "30th only · ₱8,000 a month"), and the amount per payday on the right.
  - Status lines, one per payday this period: "15th: Received Nov 15" (positive) and "30th: Expected Nov 30" (neutral).
- **RECENTLY RECEIVED:** the last four income transactions from sources. Each row shows a result line, "date · source", and the amount (+₱25,000, green).

| Result | When |
| --- | --- |
| Received as expected | amount = expected |
| ₱500 less than expected | amount < expected (heads-up colour) |
| ₱500 more than expected | amount > expected (positive) |

- **Bottom button:** **Log one-time income** (secondary) opens the add sheet on the Income tab with "One-time income" selected.

## 3. Desktop

- **Header:** "Twice a month · 15th & 30th", the h1 "Income sources", and an **Add income source** button.
- **Stat cards:** Expected each month ₱58,000 ("Main job + Freelance"), plus the 15th and 30th payday totals.
- **Left column:** the source cards (links to edit).
- **Right column:**
  - **Upcoming paydays** ("Next 2 months"): a list of the next four paydays. Each row has the date (NOV 15), the expected total, and a tag: "Received" (positive) or "Expected" (neutral).
  - **Recently received,** as on mobile.

## 4. New income source

A bottom sheet on mobile, a dialog or side panel on desktop. Title "New income source", subtitle "Money you expect regularly, like a job, side gig or allowance."

| Field | Control | Example | Saves to |
| --- | --- | --- | --- |
| Income name | 50px text input, focused | Online selling | `name` |
| Amount each time | ₱ money input | 3,000 | `amount` |
| Starts | Date button | Dec 15 | `start_date` |
| Amount is | Segmented: Fixed, Varies | Varies | `amount_varies` |
| Lands on | Segmented: 15th, 30th, Every payday (uses the real dates) | 15th | `pay_slot` |

- **Varies hint:** "Varies: we plan with ₱3,000 and show what actually came in."
- **Impact box** (`mint`): "15th payday: ₱25,000 → ₱28,000" and "Each month: ₱58,000 → ₱61,000".
- **One-time note:** "For a one-time amount like a bonus or 13th month, log it as income instead." Under it, a **Log one-time income** link.
- **Button:** **Add income source** (hero).
- **After saving,** the source counts as expected income in every period from its start date on.
- **Weekly and monthly budgets** hide "Lands on" and save `every`.

## 5. Accessibility

- [ ] Source cards are links named with the source and amount.
- [ ] "Received" and "Expected" are words, not only colours.
- [ ] The impact box is `aria-live="polite"`.

## 6. Fix before building

1. **Placeholder links:** source cards point to `#`. Wire them to Edit income source.
2. **Edit income source** isn't designed. Reuse the New income source sheet with the title "Edit income source", a **Save changes** button, and a **Delete source** link (level 2 delete: past income stays, future expected amounts are removed).
3. **Ending a source:** a job that stops needs an end date, which isn't in the data model. Add `end_date` (optional) to `income_sources`, or treat "Delete source" as ending it.
4. **Payday labels** ("15th", "30th") must come from the budget's real pay days.
