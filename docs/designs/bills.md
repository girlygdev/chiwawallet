# Chiwawallet Bills Spec

Nov 19, 2026 · Girly Gado

Recurring bills (electricity, internet, rent, subscriptions), each assigned to the payday that pays it. Canvas files: `Bills`, `BillsDesktop` and `NewBill` (on the **Savings, debts, bills & income** page). Bills show up as plan items on Plan ([`plan.md`](plan.md)) and in "Due this period" on the Dashboard ([`dashboard.md`](dashboard.md)).

Routes: `/bills`, `/bills/new`, `/bills/[billId]/edit`.

## 1. The numbers

| Value | Formula | Example |
| --- | --- | --- |
| Bills each month | the sum of monthly bills, plus quarterly ÷ 3 and yearly ÷ 12 | ₱1,700 + ₱1,000 + ₱2,500 = ₱5,200 |
| Bills per payday | the bills assigned to each payday; split bills count half on each | 15th ₱2,700 · 30th ₱2,500 |
| Paid this period | bill plan items paid in the current period | ₱1,700 |
| Still due this period | unpaid bill plan items in the current period | ₱1,000 |

**Which payday pays a bill:** the user chooses, and the form suggests the last payday on or before the due day. Due the 10th → the 30th payday ("Suggested: the 30th comes right before the 10th."). Due the 22nd → the 15th payday.

**Balance message** under the per-payday bars:

| Situation | Message |
| --- | --- |
| Neither payday carries more than 60% | "Nicely balanced. Each payday covers about half." |
| One payday carries more than 60% | "The 15th carries most of your bills. Move one, or split it across both." (heads-up colour) |

For weekly and monthly budgets there's only one payday, so hide the per-payday section.

## 2. Mobile list

- **Header:** a back arrow to More, the h1 "Bills", and a 44px **+** sticker button (`aria-label="Add bill"`).
- **Summary card,** the hero: "Bills each month", ₱5,200, "3 recurring bills · ₱1,000 still due this period".
  - Then "BILLS PER PAYDAY": two bars labelled 15th ₱2,700 and 30th ₱2,500, plus the balance message.
- **One section per payday:** "PAID FROM 15TH PAYDAY ₱2,700", "PAID FROM 30TH PAYDAY ₱2,500".
  - Rows are links to edit: a yellow bill tile, the name, "Due every 15th", the amount, and a status tag.
  - Status tags: "Paid Nov 15" (positive), "Due Nov 22" (heads-up), "Next period" (neutral).
  - Split bills appear in both sections at half the amount, with a "Split" tag.
- **Variable bills** (`amount_varies`) show the amount with a "≈", for example "≈₱450".

## 3. Desktop

- **Header:** "₱5,200 a month · 3 recurring", the h1 "Bills", and an **Add bill** button.
- **Three stat cards:**
  - Bills each month: ₱5,200, "3 recurring".
  - Paid this period: ₱1,700.
  - Still due this period: ₱1,000, "Subscriptions · Nov 22".
- **Table:** BILL, AMOUNT, DUE, PAID FROM, THIS PERIOD, plus Actions (hidden header).
  - THIS PERIOD shows a status tag, or a **Mark paid** button for a bill due now.
  - Actions has an Edit button ("Edit Internet").
- **Side column:** the BILLS PER PAYDAY bars and balance message, plus the tip: "Tip: when one payday carries most bills, move one to the other payday, or pick **Split** to pay half from each."

## 4. New bill

A bottom sheet on mobile, a dialog or side panel on desktop. Title "New bill", subtitle "A bill that repeats, like utilities, rent or subscriptions."

| Field | Control | Example | Saves to |
| --- | --- | --- | --- |
| Bill name | 50px text input, focused | Water | `name` |
| Amount | ₱ money input | 450 | `amount` |
| Due every | Day picker (1st–31st), opens a select | 10th | `due_day` |
| Amount changes each month | Switch, with the hint "We'll treat ₱450 as an estimate" | On | `amount_varies` |
| How often? | Segmented: Monthly, Quarterly, Yearly | Monthly | `frequency` |
| Paid from | Segmented: 15th payday, 30th payday, Split (uses the real dates) | 30th payday | `pay_slot` |
| Remind me before it's due | Switch, with the hint "2 days before, as a notification" | On | `remind` |
| Paid with (added Nov 28) | Segmented: Cash and each open card (a dropdown past three), only once you have an open card | BPI card | `card_id` (empty = Cash) |

- **Category:** bills use the Bills category by default. Add a category row if you want electricity, rent and so on tracked separately.
- **Suggested payday:** the line under Paid from explains the default: "Suggested: the 30th comes right before the 10th."
- **Quarterly and yearly bills** also need a starting month. Show "First due" (month and day) instead of "Due every" when they're picked.
- **Impact box** (`mint`): "30th payday bills: ₱2,500 → ₱2,950", plus "15th payday bills stay at ₱2,700."
- **Button:** **Add bill** (hero).
- **After saving,** add the bill as a plan item in every open future period whose payday matches. For variable bills, the plan uses the estimate, and Mark paid asks for the real amount.

## 5. Mark paid

- **Fixed bills:** Mark paid creates the expense for the planned amount, today, in the Bills category, with an Undo toast.
- **Variable bills:** Mark paid opens a small sheet with the amount pre-filled: "Electricity came to…".
- **Bills on a card (added Nov 28, owner):** Mark paid records a card charge (an expense with `card_id`): the card's balance goes up and cash stays the same. The form says "Charged to BPI card when you mark it paid. Your cash stays the same until you pay the card." Rows read "Every 20th · BPI card". Unpaid card bills don't count against Safe to spend, but still count in Planned and their 50/30/20 group. Closing or deleting the card moves its bills back to Cash.
- **Reminders** (`remind = on`) use `profiles.bill_reminders`. In the MVP the "notification" is the dashboard bell dot and a line in Due this period. Real push notifications are v1.1.

## 6. Accessibility

- [ ] The per-payday bars have text values next to them (₱2,700, ₱2,500).
- [ ] Switches have `role="switch"` and `aria-checked`, and their hints are tied to them with `aria-describedby`.
- [ ] Status tags are words, not only colours.
- [ ] Mark paid buttons name the bill ("Mark Subscriptions paid").

## 7. Fix before building

1. **Placeholder links:** bill rows point to `#`. Wire them to Edit bill.
2. **Edit bill** isn't designed. Reuse New bill with the title "Edit bill", a **Save changes** button, and a **Delete bill** link (level 2 delete, `delete-pattern.md`).
3. **"Remind me" promises a notification** that the MVP can't send yet (push is v1.1). Change the hint to "Shows on your dashboard 2 days before", or build push.
4. **Payday labels** ("15th payday", "30th payday") must come from the budget's real pay days, not be hard-coded.
