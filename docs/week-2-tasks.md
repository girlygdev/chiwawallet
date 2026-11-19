# Week 2 tasks

The Week 2 checklist in `mvp-brief.md` broken into one-session tasks. Tick tasks here as they're done; tick the brief's checkbox when its whole group is done.

**Week 2 is done when:** all period tests pass, and the dashboard shows the right period and its expected income (your 15th and 30th amounts differ).

Specs: `docs/designs/onboarding.md`, `income.md`, `dashboard.md` (header only), `app-shell.md`. Decisions: `docs/plan-review-2026-11-19.md` (3.1–3.3, 3.11, 3.13, 3.14, 4.1–4.3, 4.10, 4.11).

## Tasks

- [x] **2a. `getPeriod()`, tests first.** *(Done Nov 19: 30 tests, also run in New York, Auckland and UTC time zones. Added `date-fns`. Cross-year ranges show both years.)* Pure function in `src/lib/periods.ts`: given a date and a budget's schedule, return the period's start date, end date and pay slot.
  - Write the Vitest cases first: semi-monthly 10th/25th; 15th/30th in February (30th becomes Feb 28, or 29 in a leap year); payday 31 in a 30-day month; weekly with Monday and Sunday paydays; monthly; the last day of a period; a period that crosses into a new year.
  - Dates are plain `date` values in Asia/Manila; no database yet.
  - Also a "Nov 15 – 29" range formatter (month on both sides only when it changes).
  - Done when: every case passes.
- [x] **2b. Migration: `budgets`, `budget_periods`, `income_sources`.** *(Pushed live Nov 19 after the owner's go; RLS, policies and constraints checked on live.)*
  - Columns from the brief's data model, plus `income_sources.end_date` (3.2) and `budget_periods.first_pay_received` (3.14).
  - Enums or check constraints for frequency and pay_slot; the 50/30/20 percentages must add up to 100.
  - RLS on all three, with A-can't-read-B tests on local Supabase.
  - Applied to live only after a dry run and the owner's go, before any code that uses it is deployed.
  - Done when: `npm run test:db` passes, and types are regenerated.
- [x] **2c. Create a period the first time it's opened.** *(Done Nov 19: `getOrCreatePeriod()` in `src/lib/budget-periods.ts` and `scheduleFromBudget()` in `periods.ts`. Not called from any page yet; 2d and 2f use it.)* Uses `getPeriod()` to find today's period and creates its `budget_periods` row if it doesn't exist yet, without duplicates (unique budget + start date).
  - Done when: opening the app twice creates one row, with tests.
- [ ] **2d. Onboarding.** Steps 1–3 and the Done screen (mobile and desktop), at `/onboarding/...`. Split Nov 19:
  - [x] **2d-1. Frame and step 1.** *(Built Nov 19; owner checked the screens and flow Nov 19.)*
    - `lib/money.ts`, the onboarding frame (top bar and progress, desktop rail), and resuming at the first unfinished step.
    - The redirect for users who haven't finished setup.
    - Step 1 with the live "Your next payday periods" preview.
    - Steps 2 and 3 are placeholders.
  - [x] **2d-2. Step 2 Income.** *(Built Nov 19; owner checked it Nov 19.)* A reusable bottom sheet (owner, Nov 19: build it now; later features reuse it), the income list, add, edit and remove, `expectedIncome()`, and the "Expected per payday" preview. Shows a note when a frequency change moved income to "Every payday".
  - [ ] **2d-3. Step 3 and Done.** Starting balance, the mid-period question (always asked; tag "Started Nov 15", or "Starts today" on payday), finish (period, then answer, then opening balance last), Done on mobile and desktop, and the "Your first period" preview.
  - Decided Nov 19:
    - All three live previews are kept (plan review 5.5).
    - Changing frequency moves one-payday income to "Every payday".
    - "Your budget" means the oldest budget until budget switching.
  - Each step saves on Continue; coming back resumes at the first unfinished step.
  - The `(app)` layout sends users with no budget to onboarding (4.1). Add `/onboarding` to the proxy (4.2).
  - Mid-period sign-up: the "Has your pay already arrived?" question saves `first_pay_received` (3.14).
  - Fields are 48px (4.11). Optional bill, pot and debt links on step 3 stay hidden until those sheets exist (Weeks 4–6).
  - Likely split in two: steps 1–2, then step 3 and Done.
  - Done when: a new user can finish onboarding on phone and desktop and land on the dashboard.
- [ ] **2e. Income screen.** List, New and Edit income source (reusing the onboarding form), Delete as a level 2 delete, an optional end date. Expected income per period by pay slot, as a pure function with tests.
  - Done when: adding, editing and ending a source changes the expected income for the right paydays.
- [ ] **2f. Dashboard header.** Period dates ("Nov 15 – 29"), days left and expected income for this period.
  - Done when: it matches Week 2's "done when" on live.

## Decisions

- `budgets.opening_balance` is nullable: empty means onboarding step 3 isn't done. ₱0 and negative amounts are valid (3.1).
- Weekly periods follow `budgets.pay_weekday`; `profiles.week_start` only sets how calendars display (3.13).
- The Get started checklist's "hide" is remembered in the browser only (3.11). The checklist itself is built later.
- `generatePlan()` is Week 5. In Week 2, finishing onboarding creates the first period but no plan items yet.
