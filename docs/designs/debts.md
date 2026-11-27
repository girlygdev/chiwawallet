# Chiwawallet Debts Spec

Nov 19, 2026 · Girly Gado

Loans, credit cards, BNPL (SPayLater and the like) and money owed to people, with payments spread across paydays. Canvas files: `Debts`, `DebtsDesktop` and `NewDebt` (on the **Savings, debts, bills & income** page). Extra payments come from Give leftover a job ([`plan.md`](plan.md)); deleting is in [`delete-pattern.md`](delete-pattern.md).

Routes: `/debts`, `/debts/[debtId]`, `/debts/new`.

**Tone:** no dog puns or jokes on debt screens. Keep it plain and encouraging.

## 1. The numbers

| Value | Formula | Example |
| --- | --- | --- |
| Left (per debt) | `total_amount` − debt payments logged | ₱12,000 − ₱4,000 = ₱8,000 |
| Total owed | the sum of "left" across active debts | ₱8,000 |
| Due this period | unpaid debt plan items in the current period | ₱4,000 |
| Debt-free by | the last due date in the schedule, if every payment is made | Dec 25 |
| Paid off so far | all debt payments ever, including finished debts | ₱4,000 + ₱10,000 = ₱14,000 |

- **Payment schedule:** for installments, `num_payments` payments of `payment_amount`, monthly from `first_due_date`. A one-time debt has one payment of the full amount.
- **Which payday pays it:** the period that **contains the due date**. Nov 25 → the Nov 15 payday; Dec 5 → the Nov 30 payday.
- **Status per payment:** Paid, Due (in the current period), Planned (future), or Late (past due and unpaid; danger tag, "Late · 3 days").
- **When "left" reaches ₱0,** set `paid_off_at` and move the debt to Paid off.
- **Interest rate** is display-only in the MVP. It doesn't change any number.

## 2. Mobile list

- **Header:** a back arrow to More, the h1 "Debts", and a 44px **+** sticker button (`aria-label="Add debt"`).
- **Summary card,** the hero: Deep Green, 22px radius, sticker border, `4px 4px 0` shadow.
  - "Total owed", then ₱8,000 in Fredoka.
  - "Debt-free by Dec 25 if you keep the plan".
  - A progress bar with "₱4,000 of ₱12,000 paid".
- **ACTIVE** (with a count, "1 debt"): one card per debt.
  - Header: a red tile, the name, a detail line ("3 payments · 0% interest"), and "₱8,000 left of ₱12,000" on the right.
  - **Next payment strip:** "Next: ₱4,000 due Nov 25" with a soft **Mark paid** pill.
  - **Schedule list:** one row per payment. Each row has a status circle (ticked when paid), "Payment 1 of 3", the date and payday ("Oct 25 · paid from Oct 15 payday", "Nov 25 · planned in Nov 15 payday"), and the amount. The next one adds "· due in 5 days".
- **PAID OFF:** compact rows, for example "Shoes installment · ₱10,000 · paid off Oct 30", with a positive "Paid off" tag. Collapse it after three rows.

## 3. Desktop

- **Header:** "₱8,000 left · debt-free by Dec 25", the h1 "Debts", and an **Add debt** button.
- **Four stat cards:**
  - Total owed: ₱8,000, "1 active debt".
  - Due this period: ₱4,000, "SPayLater · Nov 25".
  - Debt-free by: Dec 25, "if you keep the plan".
  - Paid off so far: ₱14,000, "incl. 1 finished debt".
- **Left column:**
  - ACTIVE debt rows: name, "Next ₱4,000 · Nov 25" and an "On track" tag. The selected row has a `green-600` border.
  - PAID OFF rows.
  - A note: "Extra payments count toward **Savings & debt payoff** in your 50/30/20 split."
- **Right column, debt details:**
  - The name, the subtitle "Needs · planned payments", and a big "₱8,000 left of ₱12,000" with a bar.
  - Facts: Interest "0% (optional)", Payments "1 of 3 made", Last due "Dec 25".
  - Buttons: **Mark Nov 25 paid** (primary) and **Pay extra** (secondary; opens a small sheet for the amount, saved as an extra payment).
  - A **Payment schedule** table.

## 4. New debt

> **Added Nov 24 (owner): "When I can".** "How will you pay it?" has a third option for debts with no schedule (family, friends): pay whenever there's extra. It hides Number of payments, the due date and Each payment, and shows an optional **Aim to pay off by** month with "To be debt-free by Jun 2027, pay about ₱900 a month." The card shows "When I can", the paid bar and the target instead of a schedule. It's never Due or Late, counts in Total owed, and only sets Debt-free by when it has a target. Payments on it count as extra payments (Savings & debt payoff).

A bottom sheet on mobile, a dialog or side panel on desktop. Title "New debt", subtitle "Loans, credit cards, BNPL or money you owe someone."

| Field | Control | Example | Saves to |
| --- | --- | --- | --- |
| Debt name | 50px text input, focused | Credit card | `name` |
| Lender (optional) | Text input, placeholder "e.g. bank or app" | — | `lender` |
| Total amount owed | ₱ money input | 15,000 | `total_amount` |
| How will you pay it? | Segmented: In installments, One payment | In installments | `payment_type` |
| Number of payments | Number stepper or select, 2–60 (installments only) | 3 | `num_payments` |
| First due date | Date button | Dec 5 | `first_due_date` |
| Each payment | ₱ money input; fills in total ÷ number, still editable | 5,000 | `payment_amount` |
| Interest rate % (optional) | Decimal input | 0 | `interest_rate` |

- **One payment** hides "Number of payments" and "Each payment", and the label becomes "Due date".
- **Payment schedule preview** (live, `mint` box): "PAYMENT SCHEDULE", then numbered rows ("1 · Dec 5 · Paid from Nov 30 payday · ₱5,000"), then "Debt-free by Feb 5."
- **Group note** (13px `text-3`): "Planned payments count as Needs; anything extra counts as Savings & debt payoff."
- **Check:** if number × each payment doesn't equal the total, show a yellow line, "Payments add up to ₱14,000, ₱1,000 less than the total. The last payment will be ₱6,000." Put the difference in the last payment.
- **Button:** **Add debt** (hero).
- **After saving,** create a debt plan item in each period that contains a due date (open or future periods).

## 5. Mark paid and pay extra

- **Mark paid** creates a `transactions` row (type `debt_payment`, `debt_id`, `plan_item_id`) for the planned amount, dated today, then shows an Undo toast. It counts as **Needs**.
- **Pay extra** (and Give leftover a job) creates a payment with no plan item, or one with origin `assigned`. It counts as **Savings & debt payoff** and lowers the last payments first, so the debt-free date can move earlier.

## 6. Accessibility

- [ ] Payment status is in words ("Paid", "Due in 5 days", "Late"), not only the circle.
- [ ] Mark paid buttons name the payment: "Mark SPayLater payment 2 paid".
- [ ] The schedule is an ordered list (`<ol>`) on mobile and a table with headers on desktop.
- [ ] The schedule preview in New debt is `aria-live="polite"`.

## 7. Fix before building

1. **Hero card colour (optional):** the mobile summary card is Deep Green, the "good news" style, while the desktop details card is white. Consider white on mobile too: the green progress bar can carry the good news (amount paid), and the amount owed stays neutral.
2. **Desktop subtitle** "Needs · planned payments": fine, but add "Extra payments: Savings & debt payoff" on the same line so both rules are visible.
3. **Placeholder links:** debt rows point to `#`. Wire them to `/debts/[debtId]`.
4. **Mobile debt details page** isn't designed. The mobile card already holds the schedule, so the card can expand in place instead of opening a page.
5. **Payments due on the 29th–31st** need the same short-month rule as paydays: use the month's last day.

## 8. Credit cards (added Nov 27, owner; Week 8 task 8b)

A card is a revolving debt: what's owed goes up with every purchase and down with every payment. There's no schedule and no "Debt-free by".

- **New debt** has a **Kind** choice at the top: *Loan or money owed* | *Credit card* (`/debts?add=card` opens on Credit card). A card asks for:
  - Card name and bank (optional).
  - **Owed on it today** (₱0 is fine).
  - **Payment due each month** (1st–31st; a short month uses its last day).
  - **Paid from:** the 15th or 30th payday. It defaults to the payday right before the due day, like bills, and is hidden on one-payday budgets.
  - Interest (optional, display only).
  - Preview: "Your Nov 30 payday pays the Dec 5 payment."
- **On the Debts page:** "BPI card · Credit card · ₱8,400 owed" (or "₱200 credit"), "Next payment due Dec 5 · from the Nov 30 payday", "₱3,200 charged this period", **Edit** and **Pay**.
- **Totals:** Total owed and the active count include cards. The paid bar and Debt-free by don't.
- **Owed** = what was owed when added + purchases (expenses "paid with" the card) − payments. Never stored.
- **Close card** instead of Delete once it has purchases or payments (the database refuses the delete). A closed card is listed under Paid off as "Closed", and Edit can reopen it. A card with no history deletes normally.
- **Money rules:** a purchase on a card is spending (budgets, 50/30/20) but no cash leaves; paying the card takes the cash but isn't spending again.
- **Still to come:** "Paid with" in the add sheet (8b-3), and the card's payment on the Plan (8b-4).
