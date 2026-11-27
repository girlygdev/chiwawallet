# Week 8 tasks

The Week 8 checklist in `mvp-brief.md` broken into one-session tasks. Tick tasks here as they're done; tick the brief's checkbox when its whole group is done.

**Week 8 is done when:** the app installs on both your phones and the two-user RLS test passes.

The rest of Week 8 (privacy pages, Export and Delete account, the RLS sweep, Turnstile and Resend, the demo account, the Supabase ping) gets planned here after credit cards.

## Tasks

- [ ] **8a. Install as an app (PWA).** Brief item 1. Built early, Nov 27:
  - [x] Manifest and a 1024px Apple icon, for sharp launch screens (`e661a3d`).
  - [x] Serwist service worker (static files only, never pages or data), the `/offline` page, and the iPhone install hint on the Dashboard (`d19612c`).
  - [ ] **Your check on both phones:** reinstall; the icons are sharp; airplane mode shows "You're offline"; Safari on the iPhone shows the hint. Then tick the brief's first Week 8 item.
- [ ] **8b. Credit cards as revolving debts (owner, Nov 27).** Not in the brief's checklist; added because a card's balance grows with every purchase, which the other debt types can't show. Decisions:
  - Purchases are **expenses "paid with" the card**: spending (budgets, 50/30/20) the day you buy, no cash leaves, the card's balance goes up.
  - The card's **payment** is cash leaving but not spending again.
  - The plan's card payment defaults to the **full balance** (today's, no statement cut-off) and Mark paid asks how much ("it varies").
  - A card with charges or payments can't be deleted, only closed. No card numbers, limits or bank details.
  - [x] **8b-1. Data and math.** Done Nov 27; migration pushed live. Migration `20261127100000_credit_cards.sql`: `debts.payment_type` `card` (with `due_day`, `pay_slot`; may start at ₱0; can't change type), `transactions.card_id` (on expenses; filled in by the database on payments to a card; only points to a card). `cardBalance()` in `lib/debts.ts`; `signedAmount()`, `periodTotals().cashOut`, `dashboardNumbers()`, `carryOver()` and `spentSplit()` count cards. No screens yet; the Debts page leaves cards out until 8b-2.
  - [x] **8b-2. Add a card and see it.** Done Nov 27 (checked in a browser on local Supabase, 390 and 1280px). `card-form.tsx` with `cardSchema`, `addCard`/`updateCard`; the Kind choice in the debt sheet; `CreditCard` on Debts; `lib/cards.ts` (`cardNextPayment()`, `cardCharged()`, `cardOwedText()`), `lib/card-charges.ts`; `isPaidOff()`, `debtLeft()` and `debtsSummary()` know cards. Spec: debts.md §8. New debt → Credit card (name, balance today, due day, which payday pays it); the card on the Debts page ("₱8,400 owed · Next payment Dec 5 · ₱3,200 charged this period"); Edit card; Close card instead of Delete once it has history. Also handle cards in: `debtsSummary()` (Total owed), the More page's debts line, Plan a debt payment and Give leftover a job.
  - [x] **8b-3. Paid with card.** "Paid with" in the add sheet's Expense tab (cash or a card), its impact line, a "· BPI card" tag in Activity and Recent activity, editing it. Done Nov 27 (checked in a browser on local Supabase, 390 and 1280px). `cardId` in `transactionSchemaFor()`, `checkCard()` in the save, `cards` in the sheet's data, `cardImpactLine()`, `displayAmount()`, the card tag in `rowLabels()`. Spec: debts.md §8.
  - [x] **8b-4. Paying it.** The card payment on the Plan in the payday that pays it (full balance, kept in step until edited), Mark paid asking how much, Due this period, Safe to spend and the Paydays overview. Done Nov 27 (checked in a browser on local Supabase, 390 and 1280px). `generatePlan()` plans cards (`cardDueInPeriod()`, `cardNextDue()`, `PlanSources.today`); `planSummary()` leaves card payments out of the 50/30/20 split (owner: option A); Mark paid on the Debts card. Spec: debts.md §8.
