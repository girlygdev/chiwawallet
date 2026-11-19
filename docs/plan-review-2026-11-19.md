# Plan review: design specs vs brief and 9-week plan

Nov 19, 2026 · after adding every page spec to `docs/designs/`

Every spec in `docs/designs/` (see its `index.md`) was checked against the data model and 9-week plan in `mvp-brief.md`. This file tracks what needs deciding. Tick an item and note the decision when it's settled; move anything cut to `V1.1.md`.

**Status:** `open` until decided. Decisions also go in `docs/dev-log.md`.

## 1. Decide before the `profiles` migration goes live

| # | Item | Source | Suggestion | Status |
| --- | --- | --- | --- | --- |
| 1.1 | Store which Privacy Notice version each person agreed to: `profiles.consent_version` | `legal.md` §4 | Add it to the current (unpushed) profiles migration | **Decided Nov 19:** added to the profiles migration |
| 1.2 | Add "I'm 18 or older" to the consent checkbox text (the Terms require it) | `legal.md` fix #2 | Do it with profiles part 2, or in Week 8 | **Decided Nov 19:** add it in profiles part 2 |

## 2. Broken references after moving the style guide

| # | File | Fix | Status |
| --- | --- | --- | --- |
| 2.1 | `CLAUDE.md` | Point to `docs/designs/style-guide.md`, and list `docs/designs/` as a source of truth | open |
| 2.2 | `docs/designs/index.md` | Link to `../mvp-brief.md` | open |
| 2.3 | `src/app/globals.css` (line 9 comment) | Point to `docs/designs/style-guide.md` | open |

## 3. Data model gaps

Changes to the brief's data model need the owner's OK (CLAUDE.md).

| # | Week | Table | Gap | Suggestion | Status |
| --- | --- | --- | --- | --- | --- |
| 3.1 | 2 | `budgets` | Onboarding resumes at step 3 when there's "no opening balance", but ₱0 is a valid answer; negative amounts are allowed too | `opening_balance` nullable, no `>= 0` check | open |
| 3.2 | 2 | `income_sources` | A job that stops has no end date (`income.md` fix #3) | Optional `end_date` | open |
| 3.3 | 2 | `income_sources` | Onboarding doesn't ask for `start_date` | Default to the first period's start date | open |
| 3.4 | 3 | `categories` | "Savings pot" and "Extra debt payment" are system categories: assigned automatically, hidden from the expense picker, can't be deleted | A `system_key` column | open |
| 3.5 | 3 | `transactions` | Pot withdrawals: negative amount or a `direction` field (`activity.md` §3) | Negative `savings` amount; a check that only savings rows can be negative | open |
| 3.6 | 3–4 | links to pots, bills, debts, income sources | Level 2 deletes are hard deletes, but past history stays (`delete-pattern.md`) | Foreign keys `on delete set null`; history rows fall back to the category name | open |
| 3.7 | 4 | `recurring_bills` | Quarterly and yearly bills need a first due month (`bills.md` §4) | `first_due_month` | open |
| 3.8 | 4 | `savings_pots` | `pay_slot = split` for pots | Drop split for pots (`savings.md` fix #5) | open |
| 3.9 | 5 | `plan_items` | Starter plan items (Needs, Wants, Savings & debt) have no category | A `group` column on `plan_items` | open |
| 3.10 | 5 | `plan_items` | Origin for copies of `categories.default_budget` | `recurring` (`plan.md` fix #3) | open |
| 3.11 | 2 or 7 | — | Dismissing the dashboard's Get started checklist | Browser storage; no column | open |
| 3.12 | 8 | — | Storing "Why are you leaving?" after account deletion (`settings.md` fix #1) | Drop the field | open |

## 4. Architecture decisions

| # | Week | Item | Suggestion | Status |
| --- | --- | --- | --- | --- |
| 4.1 | 2 | Sending users with no budget to onboarding: the spec says the proxy, but that's a database query on every request | Check in the `(app)` layout instead | open |
| 4.2 | 2+ | The proxy's app-page list | Add `/more`, `/onboarding` and `/payday` when those pages are built | open |
| 4.3 | 2 | `lib/money/` folder (`dashboard.md`) vs `lib/money.ts` (CLAUDE.md) | Pick one and update the other doc | open |
| 4.4 | 8 | Delete account deletes the auth user, which normally needs the `service_role` key | A `security definer` function `delete_my_account()` that deletes only `auth.uid()` | open |
| 4.5 | 8 | Deletion confirmation and auth emails need Resend, which needs a domain you own | Get a custom domain, or another free SMTP | open |
| 4.6 | 8 | Export as a .zip needs a zip library (new dependency) | Add one, or export one CSV per click | open |
| 4.7 | 8 | Purging soft-deleted rows after 30 days | `pg_cron` (free plan) | open |
| 4.8 | 8 | Changing paydays rebuilds future periods and moves one-off items (`settings.md` §2) | Keep it simple for the MVP: the new schedule starts at the next period | open |

## 5. Scope

The specs cover about 25 screens in mobile and desktop versions, plus empty states, and add features the brief doesn't list: Give leftover a job, the payday rollover screen, the Get started checklist, search, swipe actions, a keyboard shortcut, Copy last period's plan, pot goal dates, debt payment schedules, and a category list and editor that aren't designed yet. Heaviest weeks: 2 (onboarding, income), 3 (activity, add sheet, categories, More, undo) and 8 (settings, export, delete account, demo, offline, legal).

**Candidates for `V1.1.md`:**

| # | Feature | Source | Status |
| --- | --- | --- | --- |
| 5.1 | "Search all periods" and the "N" keyboard shortcut | `activity.md` | open |
| 5.2 | Swipe gestures on transaction rows (Edit and Delete buttons stay) | `activity.md` | open |
| 5.3 | Copy last period's plan | `plan.md` fix #5 | open |
| 5.4 | "Wins" on the rollover screen (show the plain numbers) | `payday-rollover.md` | open |
| 5.5 | Desktop-only live previews (onboarding, New debt schedule) | `onboarding.md`, `debts.md` | open |
| 5.6 | Rebuilding future periods when paydays change (see 4.8) | `settings.md` | open |
| 5.7 | "Why are you leaving?" (see 3.12) | `settings.md` | open |

**Week 1 app shell:** build only the frame (bottom bar, sidebar, header, More link). The greeting needs profiles part 2, the sidebar's budget name and the period switcher need Week 2, and the bell needs Week 7, so leave placeholders for those.

## 6. Next steps

1. Decide 1.1 and 1.2; update the profiles migration and re-run its tests.
2. Apply the migration to the live project (owner runs `supabase login`).
3. Profiles part 2, the fixes in section 2, then the app shell frame.
4. Before Week 2: settle sections 3–5, update the brief's data model and 9-week plan, and start `V1.1.md`.
