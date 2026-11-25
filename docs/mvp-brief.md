# Chiwawallet MVP Brief (Refined)

Nov 14, 2026 · Girly Gado

## 1. Scope: what to cut or shrink

The core is right: budgets that follow your pay schedule are the only thing that sets Chiwawallet apart, so build that first and well. Everything else should ship in its smallest useful form.

| Feature | Keep in MVP as | Defer to v1.1+ |
| --- | --- | --- |
| Pay-period budgets | Weekly, semi-monthly, monthly; user picks pay dates (e.g. 10th and 25th) and week start (Mon/Sun); frequency set per budget | Bi-weekly, irregular/freelance income |
| Income sources | Each source has an amount and the payday it lands on (payday 1, payday 2 or every payday); expected vs actual per period | Variable or commission income |
| Pay-from paydays | Bills and planned items are assigned to payday 1, payday 2, or split half on each | Custom split ratios |
| Plan ahead | Open and plan any future period; recurring items fill in automatically; add one-off items (gifts, events, fees) by hand; new users can start from a one-tap 50/30/20 starter plan | Projections: savings by a date, debt-free date |
| Carry-over | Opening balance for the first period; leftover or overspend of the whole budget rolls into the next period | Per-category rollover |
| Recurring bills | Bill shows as due in the period it's paid from; you tap Mark paid, which logs the expense | Auto-posting on a schedule, push reminders |
| Savings pots | Named pots with target, starting balance, planned contribution per payday and a locked flag (e.g. Pag-IBIG MP2); add or withdraw | Auto-transfers, dividends |
| Debts | Amount, due date, planned payments spread across paydays, paid tick, status (on time or late); interest rate optional and display-only | Amortization, interest accrual, payoff strategies |
| 50/30/20 split | Each category belongs to Needs, Wants or Savings & debt payoff. Planned debt payments count as Needs; extra payments count as Savings & debt payoff. Dashboard shows actual split vs target | Pick a budgeting model per budget (50/30/20, 70/20/10, 80/20 pay-yourself-first, zero-based) or set custom targets |
| Reports | One chart: spending by category for the current period (only if week 9 has time) | Trends across periods, PDF exports |
| Accounts | Cut. One opening balance per budget | Separate bank, cash and e-wallet accounts with transfers |
| Event budgets | Cut. Use one-off plan items or a savings pot (e.g. Christmas 2026) | Event budgets that group items |
| Platform admin | Cut. Use the Supabase dashboard as your admin tool | Admin panel with aggregated stats only |
| Google Sheets import | Cut. Your current Sheets are only a reference for designing the app | CSV or Excel import for all users |
| PWA | Installable, responsive, fast | Offline logging with background sync |
| AI insights | Deferred (your call) | Monthly spending summary, cut-down suggestions |
| Currency | PHP only | Multi-currency |

The two biggest time sinks to avoid are debt interest math and offline sync. Each could eat two weeks alone, and neither is needed to replace your Google Sheet.

## 2. Security, privacy and safety risks you missed

The biggest risk is one user seeing another user's finances. With Supabase, that comes down to Row Level Security (RLS) on every table.

### Security

- **RLS on every table.** Turn it on before any data goes in. Every table carries `user_id`, and every policy checks `user_id = auth.uid()`. Write a test that logs in as user A and tries to read user B's rows.
- **Never expose the service role key.** Only the anon key may use the `NEXT_PUBLIC_` prefix. Keep the service key server-side, if you need it at all.
- **Secrets.** `.env.local` stays in `.gitignore`. Commit a `.env.example` with blank values, store real values in Vercel's environment settings, and turn on GitHub secret scanning and push protection.
- **Public signups attract bots.** Require email confirmation and add Cloudflare Turnstile (free) to sign-up and login through Supabase Auth's CAPTCHA setting.
- **Auth emails.** Supabase's built-in email sender is rate-limited and meant for testing. Connect a free SMTP provider such as Resend before public launch.
- **Demo account abuse.** The password is public, so reviewers can change or delete its data. Seed it with a script and reset it on a schedule. Block email and password changes for that account.
- **Money as floats.** Store amounts as integer centavos (`bigint`), never `float`. ₱0.10 + ₱0.20 must equal ₱0.30.
- **Dates and time zones.** Store transaction dates as `date`, not timestamps, and compute periods in Asia/Manila time. Otherwise an 11 p.m. expense can land in the wrong period.
- **Admin access.** "Admin sees everything" means you can read everyone's finances. Drop the admin role from the MVP and say in the privacy notice who can access data.

### Privacy (Philippine Data Privacy Act, RA 10173)

You become a personal information controller as soon as strangers sign up. Income, debts and spending are personal information, and a leak would seriously harm people, so treat it as high-risk. I'm not a lawyer; check anything that matters with one or with the NPC.

- **Privacy notice** before sign-up: what you collect, why, where it's stored (Supabase and Vercel, likely outside the Philippines), how long, and how to contact you.
- **Consent checkbox** at sign-up, linked to the notice and terms. Record when it was given.
- **Data subject rights:** an Export my data (CSV) button and a Delete my account button that removes all rows.
- **Collect less.** Email and display name only. No birthdays, phone numbers, IDs or bank account numbers. Leave transaction notes optional.
- **Breach plan.** Write one page on what to do if data leaks. The DPA rules require notifying the NPC and affected users within 72 hours of learning of a breach involving sensitive or identity-fraud-prone data.
- **NPC registration.** Mandatory registration kicks in at 250+ employees, sensitive personal information of 1,000+ people, high-risk processing, or automated decision-making and profiling. Your MVP is likely below this. The future AI insights feature could count as profiling, so check again before you add it.
- **Backups.** The free Supabase plan has no daily backups. Export manually every month and keep the file somewhere private and encrypted, never in the Git repo.

### AI safety (for later, when AI insights return)

- Send only aggregated totals per category to the model, never names, emails or notes.
- Ask consent before the first AI use and let users turn it off.
- The AI must not give investment, loan or tax advice, or tell people to borrow money. Add a "not financial advice" line.
- Cap requests per user per day so one user can't run up your Claude API bill.

## 3. Tech stack (₱0 to run)

Keep Next.js, Tailwind, shadcn/ui and Vercel. Two choices change: use **Supabase** for the database and **Supabase Auth instead of NextAuth + JWT**. Supabase gives you Postgres, login and RLS in one free service, and its RLS reads the logged-in user directly, so you write one fewer integration.

| Layer | Choice | Reason |
| --- | --- | --- |
| Frontend | Next.js (App Router, TypeScript) + Tailwind + shadcn/ui | You already know it, and shadcn includes the forms, sheets and charts you need |
| PWA | Next.js built-in `app/manifest.ts` + Serwist for the service worker | Built-in manifest makes it installable; Serwist is the maintained successor to next-pwa |
| Backend | Next.js Server Actions + Route Handlers | No separate API server to host or pay for |
| Database | Supabase Postgres (free plan) | 500 MB is years of transactions for a few users |
| Auth | Supabase Auth: email + password, Google sign-in | RLS policies use `auth.uid()` with no extra glue |
| Data access | `@supabase/ssr` + types from `supabase gen types` | Queries are typed and still go through RLS |
| Validation | Zod + React Hook Form | One schema checks forms in the browser and data on the server |
| Dates | date-fns | Small and handles the pay-period math cleanly |
| Charts | shadcn charts (Recharts) | Already matches your UI kit |
| Bot protection | Cloudflare Turnstile via Supabase Auth | Free, built into Supabase |
| Auth email | Resend free tier as custom SMTP | Supabase's default sender is for testing only |
| Tests | Vitest for logic, Playwright for one end-to-end flow | Period and carry-over math must be correct; one e2e test protects the main flow |
| CI | GitHub Actions | Free lint, type check and tests on every push, plus the keep-alive ping |
| Hosting | Vercel Hobby | Free, one-click Next.js deploys |
| AI (later) | Claude API, smallest model that does the job | Not free, so it waits until the core works |

Two free-tier catches to plan around:

- **Supabase pauses free projects after 7 days without activity**, and you must restore them by hand. Daily use by you two prevents it; add a GitHub Actions cron that pings the database as a backup.
- **Vercel Hobby is for personal, non-commercial use only.** A free portfolio app fits. If you ever charge money or run ads, move to Pro.

The only optional cost is a custom domain. The free `*.vercel.app` address works fine for an MVP.

## 4. Refined brief

### Overview

**Chiwawallet: Sit. Stay. Save.** A free budgeting PWA for Filipino earners that plans spending around each payday, whether you're paid weekly, twice a month or monthly.

**Problem:** Most budgeting apps budget by calendar month. People paid twice a month or weekly end up tracking in spreadsheets instead.

**Success:** You and your boyfriend use Chiwawallet for two full pay periods instead of your Google Sheets, and a reviewer can try the demo account without signing up.

### Users

| User | Goal | MVP access |
| --- | --- | --- |
| You and your boyfriend (primary) | Plan each payday's budget, log spending, save and pay down debt | Own account, own data only |
| Public sign-ups | Same as above | Own account, own data only |
| Portfolio reviewers | See a working, polished app | Shared demo account with sample data, reset on a schedule |

### Must-have features

1. **Pay-period budgets:** choose weekly, semi-monthly or monthly per budget, plus pay dates, week start and an opening balance.
2. **Income sources:** each with an amount and the payday it lands on; expected vs actual per period.
3. **Plan ahead:** plan the current or any future period. Income, bills, savings contributions and debt payments fill in from their payday; add one-off items by hand. New users can start from a one-tap 50/30/20 starter plan that creates Needs, Wants and Savings & debt payoff budget lines from their pay.
4. **Transactions:** log income and expenses in under 10 seconds on a phone.
5. **Carry-over:** leftover or overspent money rolls into the next period.
6. **Recurring bills:** paid from payday 1, payday 2 or split; Mark paid logs the expense.
7. **Savings pots:** target, starting balance, planned contribution per payday, locked flag; add or withdraw.
8. **Debts:** amount, due date, planned payments across paydays, paid status; interest optional.
9. **50/30/20 view:** categories grouped as Needs, Wants or Savings & debt payoff, compared with target percentages.
10. **Account basics:** privacy notice and consent, CSV export, delete account, demo login.

### User stories

| As a… | I want to… | So that… |
| --- | --- | --- |
| semi-monthly earner | set my budget to my actual pay dates (e.g. 10th and 25th) | each period matches when money arrives |
| earner with more than one job | record each income source and which payday it lands on | each period shows what I'll actually receive |
| planner | plan paydays months ahead, including one-off items like gifts | I see expensive periods coming and prepare |
| user | assign each bill to the paycheck that pays it, or split it | no single payday gets overloaded |
| user | log an expense in a few taps on my phone | I actually keep tracking |
| user | see leftover or overspend carry into the next period | my numbers stay honest across paydays |
| user | see which bills are due this period and mark them paid | I don't miss my electric or internet bill |
| saver | put money into pots like Emergency or Travel, including locked ones like MP2 | I see progress toward each goal and my full savings |
| borrower | spread a debt's payments across paydays and tick them off | I clear it before the due date |
| user | see my spending split into needs, wants and savings & debt payoff | I can keep to 50/30/20 |
| reviewer | open a demo with one tap | I can judge the app without signing up |

### MVP success criteria

- You can rebuild your Oct 2026 – Apr 2027 paycheck plan in the app, and the totals per payday match your Sheet.
- Logging an expense takes 10 seconds or less on a phone.
- Period dates are correct for every frequency, including February and 31st pay dates (covered by automated tests).
- Carry-over is correct across three periods in a row.
- User A cannot read or change user B's data (automated test).
- The app installs to a phone home screen on Android and iOS.
- You and your boyfriend stop updating your Google Sheets.

### Main flow

1. Sign up (email or Google), accept the privacy notice.
2. Onboarding: name the budget, pick frequency, pay dates and week start, enter the opening balance.
3. Add income sources and the payday each lands on.
4. Add recurring bills, savings pots (with starting balances) and debts, each assigned to a payday.
5. Plan: open the current or a future period; recurring items are already filled in; add one-off items and adjust.
6. Daily: tap + to log income or expenses.
7. Payday: the new period opens with the carry-over; mark bills, contributions and debt payments as paid.

### Screens

| Screen | Purpose | Key elements |
| --- | --- | --- |
| Sign up / Login | Get in | Email, Google, Turnstile, consent checkbox, Try demo button |
| Onboarding | First budget | Frequency, pay dates, week start, opening balance |
| Dashboard | This period at a glance | Days left, available to spend, planned vs spent, bills and debts due, pot progress, 50/30/20 split |
| Plan | Plan any period, now or ahead | Period picker, expected vs actual income, planned items by group, add one-off item, Mark paid |
| Add transaction | Fast logging | Bottom sheet: amount, category, date, note; floating + button |
| Transactions | History | List by period, filter by category, edit and delete |
| Income | Income sources | Name, amount, payday |
| Bills | Recurring bills | Amount, due day, paid from payday 1, 2 or split |
| Savings | Pots | Progress bars, locked badge, planned contribution, add or withdraw |
| Debts | Debts | Amount, due date, planned payments, remaining, status |
| Settings | Account | Profile, categories and groups, budgets, export CSV, delete account |
| Privacy and Terms | Legal pages | Privacy notice, terms |

### Data model

Every table has `user_id` and an RLS policy. Amounts are `bigint` centavos.

| Entity | Key fields | Related to |
| --- | --- | --- |
| profiles | user_id (= auth user, unique; own `id` like every table), display_name, week_start, consent_at, theme (light / dark / system), bill_reminders (on), payday_summary (on), mid_period_checkin (off), is_demo (false) | everything |
| budgets | name, frequency (weekly / semi_monthly / monthly), pay_day_1, pay_day_2, pay_weekday, opening_balance (empty until onboarding step 3; ₱0 and negatives allowed), carry_over (on), ask_on_payday (on), budget_model (50_30_20), needs_pct (50), wants_pct (30), savings_debt_pct (20) | periods, income sources, bills |
| income_sources | budget_id, name, amount, amount_varies (false), pay_slot (payday_1 / payday_2 / every), start_date (defaults to the first period's start), end_date (optional, for a job that stops) | plan items, transactions |
| budget_periods | budget_id, start_date, end_date, pay_slot, carried_in, leftover_choice (carry / pot / debt / split), first_pay_received (false; set in onboarding when today's pay already arrived), closed_at | plan items, transactions |
| categories | name (unique per user, ignoring case), kind (income / expense), budget_group (needs / wants / savings_debt; empty for income; named `budget_group` because `group` is reserved in SQL), icon, color, default_budget (optional, copied into each period's plan), system_key (optional: income / savings_pot / extra_debt / debt_payment; one each per user, can't be renamed or deleted, hidden from the expense picker; `debt_payment` is "Debt payment", Needs, for planned debt payments, decided Nov 24) | plan items, transactions |
| recurring_bills | budget_id, name, amount, amount_varies (false), category_id, frequency (monthly / quarterly / yearly), due_day, first_due_month (1–12, quarterly and yearly only; decided Nov 24), pay_slot (payday_1 / payday_2 / split), remind (on) | plan items, transactions |
| savings_pots | name, icon, color, target_amount (optional), target_date (optional), starting_balance, planned_contribution, pay_slot (payday_1 / payday_2 / every; no split, decided Nov 24), is_locked | plan items, transactions |
| debts | name, lender (optional), total_amount, payment_type (installments / one_time / flexible, "When I can", added Nov 24), num_payments, payment_amount, first_due_date (all three empty for flexible), target_date (optional, flexible only: "Aim to pay off by", 1st of the month), interest_rate (optional, display only), paid_off_at | plan items, transactions |
| plan_items | period_id, name, category_id (empty only for starter items), budget_group (needs / wants / savings_debt; only when there's no category, decided Nov 25), planned_amount, origin (recurring / one_off / starter / assigned), needed_by (optional), income_source_id, bill_id, pot_id, debt_id, paid_at, deleted_at | period, transactions |
| transactions | period_id, category_id, type (income / expense / savings / debt_payment), amount (above zero; only savings can be negative, meaning a pot withdrawal), date, note, income_source_id, plan_item_id, pot_id, debt_id, deleted_at | period, plan item |

Opening a period, current or future, generates its plan items from income sources, bills (split ones become two halves), pot contributions for that payday, installment and one-time debt payments due in it (decided Nov 25; never "When I can" debts) and spending budgets from `categories.default_budget` (origin `recurring`). You then add one-off items and extra debt payments. Pot and debt balances are calculated from transactions, not stored, so they can't drift out of sync. The three target percentages live on each budget and must add up to 100 (enforce with a database check). The MVP hides them and always uses 50/30/20; in v1.1, picking a model just fills in those numbers.

**Baseline rules for every table** (frozen Nov 17, 2026; change only when building proves a field is missing):

- Every table also has `id` (uuid), `user_id`, `created_at` and `updated_at`, with an RLS policy of `user_id = auth.uid()`.
- Amounts are `bigint` centavos; dates are `date` values in Asia/Manila time.
- Choice fields (frequency, pay_slot, budget_group, origin, type and so on) are Postgres enums or `text` with a check constraint, never free text.
- **Soft delete** (level 1 of the delete pattern): `transactions` and `plan_items` set `deleted_at`, all queries filter `deleted_at is null`, and a daily job purges rows older than 30 days.
- **Hard delete with a choice** (level 2): pots, debts, bills, income sources and categories. Past transactions keep their history; only future plan items are removed.
  - Links from transactions and plan items to pots, debts, bills and income sources are `on delete set null`; those rows then show their category name.
  - Links to categories are `on delete restrict`: deleting a category first moves its transactions and plan items to another one.
- **Categories:** every user gets their own copy of the default categories at sign-up, which they can edit. Three system categories are locked: Income, Savings pot and Extra debt payment. Custom categories are per user too.
- **Account deletion** (level 3): deleting the auth user cascades to every table.
- **Starter plan:** creates three `plan_items` with origin `starter`, using the budget's three percentages. **Assign leftover** creates items with origin `assigned`.

**Sensitive data:** income, spending, savings and debts. No IDs, card numbers or bank account numbers are ever collected.

### Testing and definition of done

- Vitest unit tests for period dates and carry-over math.
- One Playwright test: sign up, create budget, log expense, see dashboard update.
- RLS test with two users.
- Your boyfriend tests on his phone each week.

**MVP is done when:**

- [ ] Main flow works end to end
- [ ] Deployed with a live link
- [ ] Privacy notice, consent, export and delete account work
- [ ] Demo account works and resets
- [ ] README with screenshots, setup steps and a section on how AI helped build it
- [ ] Short demo video recorded
- [ ] You and your boyfriend have moved off your Google Sheets

## 5. Build plan: 9 weeks at 2–3 hours a day

Each task fits in one session and ends with something you can check. Deploy from day one so every week ends on the live link. Your current Sheets are the acceptance test: by week 7 the app must reproduce your paycheck plan.

### Week 1: Setup and login

**Done when:** you can sign up on the live URL and land on an empty dashboard.

- [x] Create the Next.js app (TypeScript, Tailwind, shadcn/ui), push to GitHub, connect to Vercel
- [x] Create the Supabase project; add `.env.local`, `.env.example` and Vercel env vars
- [x] Supabase Auth with email + password and Google; login, sign-up and logout pages
- [x] Middleware that redirects logged-out users away from app pages
- [x] `profiles` table with RLS, created automatically on sign-up
- [x] App shell: bottom nav on mobile, sidebar on desktop
- [x] GitHub Actions: lint and type check on every push

### Week 2: Pay-period engine and income

**Done when:** all period tests pass, and the dashboard shows the right period and its expected income (your 15th and 30th amounts differ).

- [x] `budgets` table + RLS; onboarding form (frequency, pay dates, week start, opening balance)
- [x] Pure function `getPeriod(date, budget)` returning start date, end date and pay slot
- [x] Vitest cases: semi-monthly 10th/25th, 15th/30th in February (30th becomes Feb 28), pay day 31 in a 30-day month, weekly with Monday and Sunday paydays (weekly periods follow `pay_weekday`; `profiles.week_start` only sets how calendars display), monthly
- [x] `budget_periods` table; create a period the first time it's opened
- [x] `income_sources` table; Income screen; expected income per period by pay slot
- [x] Dashboard header: period dates, days left, expected income

### Week 3: Categories and transactions

**Done when:** you log a real expense on your phone in under 10 seconds.

- [x] `categories` table with group (Needs, Wants, Savings & debt payoff) and default Filipino-friendly categories (Food, Transport, Load/Internet, Bills, Rent, Padala, etc.)
- [x] `transactions` table + RLS; amounts in centavos; PHP formatting helper (`formatPeso()` already exists)
- [x] Add transaction bottom sheet with Zod validation (Expense and Income; the Savings tab moves to Week 4 with pots)
- [x] Transaction list for the current period; edit and delete
- [x] Dashboard: expected vs actual income, spent and available

### Week 4: Bills, savings pots and debts setup

**Done when:** you can enter all your current bills, pots and debts and they list correctly.

- [x] `recurring_bills` table; Bills screen with due day and paid from payday 1, 2 or split
- [x] `savings_pots` table; Savings screen with target, starting balance, planned contribution, pay slot, locked flag; the add sheet's Savings tab (add to or withdraw from a pot)
- [x] `debts` table; Debts screen with amount, due date and optional interest rate
- [x] Zod schemas and RLS for all three tables

### Week 5: Plan generation

**Done when:** tests pass for generated 15th and 30th plans, and you can open and edit a period three months ahead.

- [ ] `plan_items` table + RLS
- [ ] Pure function `generatePlan(period, budget)` that builds items from income sources, bills (split = two halves), pot contributions for that pay slot, scheduled debt payments due in the period and spending budgets (decided Nov 25)
- [ ] Vitest cases: a 15th period, a 30th period, a split bill, a pot that only contributes on the 30th
- [ ] Plan screen with a period picker (one previous, current, and future periods up to 3 months ahead)
- [ ] Add, edit and delete one-off items; plan debt payments in any period; one-tap 50/30/20 starter plan for new users (uses the budget's needs_pct, wants_pct and savings_debt_pct)

### Week 6: Plan vs actual and carry-over

**Done when:** test data across three periods gives correct carry-over, and marking an item paid updates the dashboard.

- [ ] Mark paid on a plan item creates the matching transaction
- [ ] The add sheet's Savings tab becomes **Transfer** (decided Nov 24): To a pot, From a pot, Pot to pot (net ₱0 to cash), and To a debt (a planned payment when one is due this period, otherwise an extra payment); plus Pay extra on Debts. Needs the locked "Debt payment" category (Needs) for planned payments; extra payments keep "Extra debt payment" (Savings & debt payoff)
- [ ] Planned vs actual per item and per group on the Plan screen
- [ ] Give leftover a job (`plan.md` §7): assign what's not assigned yet to pots and debts as `assigned` plan items (moved from Week 5, Nov 25)
- [ ] Pure function for carry-over, with Vitest cases for surplus, overspend and zero
- [ ] Close a period and carry the result into the next; first period starts from the opening balance

### Week 7: Savings, debts and dashboard

**Done when:** you rebuild your Oct 2026 – Apr 2027 paycheck plan in the app and every payday's totals match your Sheet.

- [ ] Pot balances (starting balance + contributions − withdrawals) and progress bars
- [ ] Debt remaining, planned vs paid, and status (on time or late after the due date)
- [ ] Dashboard: bills and debts due this period, pot progress, 50/30/20 split vs target
- [ ] Enter your real paycheck plan and compare it with your Sheet; fix any mismatch

### Week 8: PWA, privacy and hardening

**Done when:** the app installs on both your phones and the two-user RLS test passes.

- [ ] Manifest, icons and Serwist service worker; test install on Android and iOS; add an iPhone install hint
- [ ] Privacy notice and terms pages; consent checkbox saved with a timestamp
- [ ] Export my data (CSV) and Delete my account
- [ ] RLS test: user A cannot read or write user B's rows on any table
- [ ] Turnstile on sign-up and login; Resend SMTP for auth emails
- [ ] Demo account seed script (based on a made-up version of your plan), Try demo button, scheduled reset
- [ ] GitHub Actions cron that pings Supabase every few days

### Week 9: Polish and launch

**Done when:** every box in the MVP checklist is ticked.

- [ ] Empty states, loading states and error messages on every screen
- [ ] Switch between budgets, if a user has more than one
- [ ] Spending-by-category chart (only if time allows)
- [ ] Playwright test for the main flow
- [ ] README with screenshots, setup steps and how you used AI to build it
- [ ] Record a 2–3 minute demo video
- [ ] You and your boyfriend switch fully from Google Sheets

If a week runs over, cut the chart, the budget switcher and the 50/30/20 view, in that order. Don't cut tests, RLS, future planning or the privacy pages.

## 6. Assumptions to confirm

I made these calls to keep the MVP small. Change any that are wrong before week 2.

- [ ] Carry-over works at the whole-budget level, not per category.
- [ ] You and your boyfriend have separate accounts. A shared household budget comes later.
- [ ] Debt interest is optional and display-only, since your current debts are fixed amounts.
- [ ] Bills, contributions and debt payments are marked paid by hand, not posted automatically.
- [ ] One opening balance per budget; separate bank, cash and e-wallet accounts come later.
- [ ] 50/30/20 is the only model in the MVP. Choosing another model or custom targets comes in v1.1.
- [ ] No admin role in the MVP; you use the Supabase dashboard.

## Sources

- [Supabase free plan limits and pausing (Jetadmin, July 2026)](https://www.jetadmin.io/blog/supabase-pricing-2026-guide-to-plans-limits-and-real-world-costs/)
- [Vercel Hobby plan](https://vercel.com/docs/plans/hobby-plan)
- [NPC Circular 2022-04 registration thresholds (Respicio & Co.)](https://www.respicio.ph/commentaries/does-a-small-business-need-to-register-with-the-national-privacy-commission-1)
- [National Privacy Commission](https://privacy.gov.ph)
