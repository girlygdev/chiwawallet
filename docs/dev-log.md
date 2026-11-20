# Dev log

Newest entry first.

## 2026-11-20 · Week 2 (extra) · Mint sticker border in dark mode
- **What:** In dark mode the sticker outline and offset shadow are now mid mint (#7FD3A3) instead of black, which disappeared on the dark background. Light mode is unchanged.
- **Files:** `src/app/globals.css`, `docs/designs/style-guide.md`.
- **Decisions:**
  - A new `--sticker` variable (black in `:root`, mint in `.dark`) feeds `border-sticker` and all three `shadow-sticker*` sizes, so no component changed.
  - The style guide said stickers "stay black in dark mode"; the owner changed that rule.
- **Tests:** Lint and typecheck pass; 187 unit tests pass. The compiled CSS has both values. The owner checked the screens.
- **AI notes:**
  - The dev server missed the last CSS edit and needed a restart.
  - Vitest must run from `C:\Projects\...` (uppercase drive); from `c:\` every suite crashes (the known Windows path bug).
- **Open:** The dimmer behind sheets and delete dialogs uses `bg-sticker/50`, so in dark mode it's now a mint wash. Suggested fix: a fixed `scrim` token. Waiting on the owner.
- **Also:** The Google consent live test passed on the owner's phone (Nov 19 night), and the live screens check out.

## 2026-11-19 · Week 2 (extra) · More › Money links on mobile
- **What:**
  - Phones had no way to reach Income. More now has the spec's MONEY section, with Income, Bills, Savings pots and Debts.
  - Income shows a live "2 sources · ₱58,000 a month".
  - The Appearance toggle moved into the spec's section style.
- **Files:** `src/app/(app)/more/money-section.tsx` (new), `src/app/(app)/more/page.tsx`.
- **Decisions:**
  - Built ahead of More's Week 3 task, from `more-and-categories.md` §1.
  - Bills, Savings pots and Debts open their placeholder pages until those features exist; their detail lines come with them.
  - The Income detail streams in after the rows appear.
- **Tests:** Lint, typecheck and the build pass. With a test user, More shows all four links, "2 sources · ₱58,000 a month", Appearance and Log out.
- **AI notes:** The Income screen (2e-1) went in without a mobile way to reach it. The owner found it.
- **Next:** Push, then check Week 2's "done when" on live.

## 2026-11-19 · Week 2 · Week 2 complete (end of day)
- **What:** All six Week 2 boxes are ticked in `mvp-brief.md` (owner's call), and every task in `week-2-tasks.md` is done.
- **Open for next session:**
  - Open the live dashboard after this push and confirm the "done when": the right period, plus expected income that differs on the 15th and 30th.
  - Plan Week 3 (transactions). First settle plan review 3.4–3.6 (system categories, pot withdrawals, what happens to history when something is deleted), then write `week-3-tasks.md`.
  - Still open from before:
    - plan review 4.4–4.9 and 5.1–5.7
    - starting `V1.1.md`
    - the Google consent live test
    - a dark-mode readability pass across screens
    - trying Vitest 5.1.1 after Dec 2 for the Windows path bug

## 2026-11-19 · Week 2 · 2f Dashboard header
- **What:**
  - The dashboard shows this period's dates ("Nov 15 – 29") and "15th payday · 10 days left".
  - A hero card with this period's expected income and the sources landing on this payday.
  - "Already in your starting balance" when onboarding said the pay had arrived.
  - Opening the dashboard creates the period row on first open (`getOrCreatePeriod`).
- **Files:** `src/app/(app)/dashboard/page.tsx`, `src/lib/periods.ts` (`daysLeft`, `periodStatusLine`), `tests/lib/periods.test.ts`, `docs/week-2-tasks.md`.
- **Decisions:**
  - Days left counts today, using Manila calendar dates (dashboard.md §1).
  - Future periods say "Starts Nov 30"; past ones say "Ended Nov 14".
  - The period switcher's arrows wait for Plan (Week 5), because moving periods opens that period's plan.
  - Safe to spend and the other dashboard sections need transactions and plans (Weeks 3–5).
- **Tests:**
  - Written first and failing. 187 unit tests pass; lint, typecheck and the build pass.
  - Locally with a test user:
    - On the 15th period: ₱25,000, with the 30th-only source left out.
    - On payday 2: ₱33,000 with it included.
    - Two opens make one period row.
- **AI notes:** None.
- **Next:** The owner checks it, then a push, and Week 2's "done when" is checked on live.

## 2026-11-19 · Week 2 · 2e-2 Delete income source
- **What:**
  - Edit income source now has a "Delete income source" link. It opens "Delete Main job?" with the item, its effect in pesos (for example "Each month: ₱58,000 → ₱8,000"), and Keep it, which is focused first.
  - The red "Delete income source" button.
  - "Stopped getting this? End it instead" opens Edit with the Ends field focused.
- **Files:**
  - New: `src/components/confirm-delete.tsx`, a reusable delete confirmation for later deletes.
  - Changed: `src/app/(app)/income/income-sheet.tsx` (the `?delete=` address and the dialog), `src/app/(app)/income/actions.ts` (`deleteIncomeSource`), `src/components/income/income-form.tsx` (`onDeleteRequest`, `focusEnd`), `src/lib/income.ts` (`removalImpact`).
  - Tests: `tests/lib/income.test.ts`.
- **Decisions:**
  - Built on Base UI's AlertDialog, so screen readers announce it as a warning. Focus starts on Keep it, and Esc keeps the item.
  - On phones, a bottom sheet with red on top; on desktop, a centered dialog with red on the right.
  - A source that isn't paying now says expected income doesn't change.
  - Deleting something that's already gone shows "no longer exists".
  - There's no choice step yet, because nothing points at income sources until Week 3 (plan review 3.6).
- **Tests:**
  - Written first and failing. 178 unit tests pass; lint, typecheck and the build pass.
  - The Income page loads with the delete, end and unknown-id addresses.
  - The dialog and the delete itself need the owner's check by eye.
- **AI notes:** None.
- **Next:** 2f, the dashboard header. It completes Week 2's "done when".

## 2026-11-19 · Week 2 (extra) · Theme toggle
- **What:**
  - Dark mode actually turns on now. Before this, nothing added the `.dark` class.
  - Light / Dark / Match device: a three-icon switch in the desktop sidebar, and an Appearance section on More.
  - A choice applies instantly and is saved on the device and to `profiles.theme`.
  - On app pages the profile's theme wins, so it follows you to other devices.
  - "Match device" follows the device's setting live; tabs stay in step.
- **Files:**
  - New: `src/lib/theme.ts`, `src/components/theme/*` (toggle, sync, watcher, `applyTheme`, `saveThemeToProfile`), `tests/lib/theme.test.ts`.
  - Changed: `src/app/layout.tsx` (head script, `suppressHydrationWarning` on `<html>`), `src/app/(app)/layout.tsx` (profile sync), `src/components/shell/sidebar.tsx`, `src/components/shell/placeholder-page.tsx` (`children`), `src/app/(app)/more/page.tsx`.
- **Decisions:**
  - No `next-themes`: about 30 lines of our own, with no new dependency.
  - A head script sets the class before the page draws, so there's no flash.
  - On desktop, an icon switch instead of a button that opens a menu: one tap, no popup.
  - The profile wins over the device on app pages (owner's go).
  - The toggle reads the device's choice with `useSyncExternalStore`, so the server and browser renders don't disagree.
- **Tests:**
  - 10 theme tests, including running the head script against a fake page. 176 unit tests pass; lint, typecheck and the build pass.
  - Checked with a throwaway local user: the script is on every page, the toggles render on More and in the sidebar, and `profiles.theme` updates.
- **AI notes:**
  - The theme code and its tests were written together, not test-first.
  - The first toggle set state inside an effect. The React lint rule flagged it, and it was rewritten with `useSyncExternalStore`.
- **Next:** A quick dark-mode pass over the main screens, now that real users can switch. Then 2e-2.

## 2026-11-19 · Week 2 · 2e-1 Income screen: list, add and edit
- **What:**
  - `/income` shows a hero "Expected each month" card, per-payday stats, and source cards (active, starting later, ended), each opening Edit.
  - Desktop adds the schedule line, "Income sources", "+ Add income source" and an Upcoming paydays column.
  - Add and edit happen in the sheet, with Starts and an optional Ends.
- **Files:**
  - New: `src/app/(app)/income/page.tsx`, `income-sheet.tsx`, `actions.ts`.
  - Moved: the income form, from `src/app/onboarding/income/` to `src/components/income/income-form.tsx`. It now takes `onSave`, an optional `onRemove`, and an optional `withDates`.
  - Changed:
    - `src/components/shell/page-header.tsx`: `desktopTitle`, `eyebrow`, `mobileAction`, `desktopAction`, `HeaderStickerLink`.
    - `src/lib/income.ts`: `isActiveOn`, `expectedForPeriod`, `upcomingPaydays`, `monthlyAmount`, `sourceScheduleLine`.
    - `src/lib/validation/income.ts`: optional start and end dates, required on the Income screen.
    - `src/app/onboarding/income/income-step.tsx`.
  - Tests: `tests/lib/income.test.ts`, `tests/lib/validation/income.test.ts`.
- **Decisions** (the owner accepted all recommendations):
  - Split into 2e-1 and 2e-2.
  - Received parts wait for Week 3.
  - The sheet, not separate pages.
  - Deleting is a simple confirmation for now, with "End it instead".
  - Deleting the last source is allowed, with an empty state.
  - Pages can swap the header button.
  - The sheet opens from the page address, so the header button and cards are plain links (income.md §5: cards are links).
  - A source counts in a period when it's active on that period's payday.
  - The before-and-after box compares against active sources only.
- **Tests:**
  - Written first and failing. 166 unit tests pass; lint, typecheck and the build pass.
  - The Income screen rendered with a throwaway local user: empty state; ₱58,000, ₱25,000 and ₱33,000; schedule lines; the Varies and Ends tags; the Starting later and Ended groups; Upcoming paydays; the header; add and edit links.
  - Onboarding step 2 rechecked after the form move.
- **AI notes:** The first test script inserted several rows with different columns. supabase-js fills missing ones with null, so `amount_varies` failed. The script was fixed; the app was fine.
- **Next:** 2e-2, Delete income source.

## 2026-11-19 · Week 2 · 2d-3 Onboarding step 3 and Done
- **What:**
  - Step 3 "Starting point": a big starting-balance input (₱0 and negatives allowed), and "Has your Nov 15 pay already arrived?" with Yes or Not yet, no default.
  - The live "Your first period" card on desktop, and a "Ready to plan" line on mobile.
  - Finish setup creates the period, saves the answer, then saves the opening balance last.
  - The Done screen: full screen on mobile, a centered card on mint from 1024px.
  - The step placeholders are gone.
- **Files:**
  - New: `src/lib/validation/start.ts`, `src/lib/onboarding-data.ts`, `src/components/onboarding/first-period-card.tsx`, `src/app/onboarding/start/*`, `src/app/onboarding/done/page.tsx`.
  - Changed: `src/lib/income.ts` (`expectedForSlot`, `describeIncome`), `src/lib/onboarding.ts` (`firstPeriodSummary`, `periodTag`), `src/lib/periods.ts` (`formatShortDate`), `src/app/onboarding/actions.ts` (`finishOnboarding`), `src/components/segmented.tsx`.
  - Deleted: `src/components/onboarding/step-placeholder.tsx`.
  - Tests: `tests/lib/validation/start.test.ts`, plus additions to the income, onboarding and periods tests.
- **Decisions:**
  - The pay question has no default, because a wrong guess counts pay twice or not at all.
  - If the pay has arrived, the card shows "Already in balance", and Ready to plan is just the balance (`firstPeriodSummary`).
  - The "Skip, I'll add these later" link is left out for now: the optional bills, pots and debts items it skips are hidden until Weeks 4–6, so Skip would do the same as Finish.
  - Done only opens for users who finished setup.
- **Tests:**
  - Written first and failing. 155 unit tests pass; lint, typecheck and the build pass.
  - A throwaway local user was checked through step 3, then the same writes as Finish, then Done, then the dashboard. All correct.
  - The Finish button itself needs the owner's click test.
- **AI notes:** Claude's first mobile "Ready to plan" line added the numbers inside the component. Moved to `firstPeriodSummary()`, since UI never does money math.
- **Owner's decisions:**
  - Negative balances on iPhone (no minus key on the decimal keypad): leave as is for the MVP.
  - The Skip link waits for bills, pots and debts.
  - The starting balance is everything the user has now, including pay that already arrived. The app never adds it on top. The owner asked whether pay plus the extra ₱4,000 should be added; it shouldn't, because the app can't know what was spent. The field hint and the "Yes" hint now say to include it.
- **Next:** 2e, the Income screen.

## 2026-11-19 · Week 2 · 2d-2 Onboarding step 2 Income
- **What:**
  - Step 2 lists income as cards on mobile and a table on desktop.
  - Adding uses the bottom sheet on mobile and a dashed inline form on desktop. Editing opens the sheet, and Remove asks "Keep it / Remove".
  - "Expected per payday" preview; a mint before-and-after box in the form.
  - Continue is disabled until there's one income.
  - A note when a frequency change moved income to Every payday.
- **Files:**
  - New shared components: `src/components/sheet.tsx` (reusable), `money-input.tsx`, `segmented.tsx`.
  - New: `src/lib/income.ts` (`expectedIncome`, `incomeImpact`), `src/lib/validation/income.ts`.
  - Changed: `src/lib/money.ts` (`formatPesoInput`), `src/components/auth/submit-button.tsx` (`className` prop), `src/app/onboarding/actions.ts` (add, update and remove income; `saveBudget` reports moved income).
  - Step 2: `src/app/onboarding/income/*`.
  - Tests: `tests/lib/income.test.ts`, `tests/lib/validation/income.test.ts`, `tests/lib/money.test.ts`.
- **Decisions:**
  - The Sheet is built on Base UI's Dialog (already installed): a bottom sheet under 768px, a centered sticker dialog from 768px. Base UI handles the focus trap, Esc and returning focus.
  - Amounts travel as typed text and are parsed by the same Zod schema in the browser and on the server.
  - In onboarding, removing income is a plain delete, since nothing has been logged against it yet. The Income screen's delete (2e) follows the level 2 pattern.
  - A new source's start date is the current period's start (3.3).
  - The one-time-income note and the "Starts" date field are left out of onboarding; they belong to the Income screen and Week 3.
- **Tests:**
  - Written first and failing. 141 unit tests pass; lint, typecheck and the build pass.
  - Step 2 rendered with a throwaway local user: empty state, totals (15th ₱25,000, 30th ₱33,000, ₱58,000 a month), the Continue link, edit labels and the frequency note.
  - The sheet and the add, edit and remove clicks need the owner's check by eye.
- **AI notes:** Claude first had the money input tidy its text on blur by setting the input directly. That can leave the form library with the old value, so it was removed.
- **Next:** 2d-3, Step 3 and Done. Still don't deploy until it's done.

## 2026-11-19 · Week 2 · 2d-1 Onboarding frame and step 1
- **What:** The first part of onboarding:
  - `/onboarding` resumes at the first unfinished step.
  - The frame has a mobile top bar and progress bar, plus a desktop mint step rail.
  - Step 1 "Your budget" has frequency radio cards, payday fields for all three frequencies, the short-month hint, and Week starts on.
  - A live "Your next payday periods" preview built on `getPeriod()`.
  - Every app page now sends users who haven't finished setup to onboarding.
  - Steps 2 and 3 are placeholders.
- **Files:**
  - New: `src/lib/money.ts`, `src/lib/onboarding.ts`, `src/lib/current-budget.ts`, `src/lib/validation/budget.ts`, `src/lib/validation/field-errors.ts`.
  - Changed: `src/lib/periods.ts` (`nextPeriods`, `ordinal`, `paydayLabel`, `describeSchedule`), `src/lib/require-app-user.ts` (`requireConsentedUser` split out, plus the budget check), `src/proxy.ts` (`/onboarding`).
  - Onboarding: `src/components/onboarding/*`, `src/app/onboarding/*`.
  - Tests: `tests/lib/money.test.ts`, `tests/lib/onboarding.test.ts`, `tests/lib/validation/budget.test.ts`, `tests/lib/periods.test.ts`.
- **Decisions:**
  - Setup counts as finished once the budget has an opening balance, which is saved last. No extra column is needed.
  - The "not finished" check lives in `requireAppUser()` (plan review 4.1).
  - The form keeps all three payday fields while you switch frequency; `toBudgetRow()` saves only the ones used.
  - Both payday menus offer 1st–31st, as the spec says, and the schema explains bad picks.
  - Fields are 48px.
  - Money parsing works on the typed text, never through a float.
  - Owner's decisions: build a reusable sheet in 2d-2; keep all three previews; frequency changes move one-payday income to "Every payday"; the oldest budget is "yours"; always ask the mid-period question.
- **Tests:**
  - Written first and failing. 124 unit tests now pass; lint, typecheck and the production build pass.
  - A throwaway local user was checked at each stage (no budget, budget only, income, finished with ₱0). Every page redirected correctly, and logged-out `/onboarding/budget` goes to `/login`.
  - The step 1 form itself still needs the owner's check by eye.
- **AI notes:**
  - At first Claude limited the 1st payday menu to 1–27, but switching frequency could leave a saved day the menu can't show. Changed to 1–31 with the schema's error messages.
  - Don't deploy until 2d-3: live users without a budget would land on placeholder steps 2–3 and couldn't finish setup.
- **Next:** 2d-2, Step 2 Income and the reusable bottom sheet.

## 2026-11-19 · Week 2 · 2c Create a period the first time it's opened
- **What:**
  - `getOrCreatePeriod(supabase, budget, date)` returns the budget's period for a date, creating the row on first open.
  - `scheduleFromBudget()` turns a budget row into a `PaySchedule`.
- **Files:** `src/lib/budget-periods.ts` (new), `src/lib/periods.ts`, `tests/lib/periods.test.ts`, `tests/db/budget-periods.test.ts` (new), `docs/week-2-tasks.md`.
- **Decisions:**
  - Written in TypeScript with the user's own client, not as a database function. `getPeriod()` is the single source of period math.
  - The insert is `ON CONFLICT DO NOTHING` on (budget_id, start_date), then the row is read back. Repeat opens and two tabs at once give one row.
  - `carried_in` stays 0 until carry-over is built.
  - Nothing calls it yet; onboarding (2d) and the dashboard header (2f) will.
- **Tests:**
  - Written first and failing.
  - 4 new unit tests and 6 new database tests, including 5 calls at once making one row, and refusing another user's budget.
  - 66 unit and 68 database tests pass; lint and typecheck pass.
- **AI notes:** The owner said "go" before seeing the plan. Claude posted a short plan before writing code because nothing in it needed a decision (no migration or dependency).
- **Next:** 2d onboarding. Likely split into steps 1–2, then step 3 and Done.

## 2026-11-19 · Week 2 · 2b budgets, income_sources, budget_periods
- **What:** A migration for the three Week 2 tables, with RLS on all of them, plus 36 database tests. Applied to local Supabase only.
- **Files:** `supabase/migrations/20261119111038_budgets.sql`, `tests/db/budgets.test.ts`, `src/lib/supabase/types.ts` (regenerated), `docs/week-2-tasks.md`.
- **Decisions:**
  - `user_id` defaults to `auth.uid()`.
  - Income sources and periods point at their budget with `(budget_id, user_id)`. RLS alone wouldn't stop someone attaching rows to another user's budget id.
  - The payday check matches `getPeriod()`, including "payday 1 ≤ 27".
  - Users can update only the listed columns: never ids, owners, timestamps or a period's dates.
  - Deleting a budget deletes its income sources and periods.
  - Income amount must be above ₱0, even when it varies (owner).
  - Whether a pay slot fits the budget's frequency is checked with Zod in the app, not in the database (owner).
- **Tests:**
  - 62 database tests and 62 unit tests pass; lint and typecheck pass.
  - With RLS turned off locally, the four A-vs-B tests failed (plus two owner tests); RLS is back on.
  - The live dry run listed only this migration. Pushed live after the owner's go.
  - On live: RLS is on all three tables, with 4 policies each, no `anon` read access and all 5 key constraints. Migration history matches local.
- **AI notes:**
  - Claude's first draft let a missing payday pass the check: in Postgres, a check that comes out null counts as passing. Fixed with `coalesce(..., false)`, and covered by tests.
  - The first RLS-off check sent several statements in one `db query` call, and they silently didn't run. Redone one statement at a time.
- **Next:** 2c, creating a period the first time it's opened.

## 2026-11-19 · Week 2 · 2a getPeriod()
- **What:** Pure period math in `src/lib/periods.ts`:
  - `getPeriod(date, schedule)` covers semi-monthly, monthly and weekly.
  - `formatPeriodRange()` gives "Nov 15 – 29", "Nov 30 – Dec 14" and "Dec 30, 2026 – Jan 14, 2027".
  - `todayInManila()`.
- **Files:** `src/lib/periods.ts`, `tests/lib/periods.test.ts`, `package.json` and `package-lock.json` (`date-fns` 4.4.0), `docs/week-2-tasks.md`.
- **Decisions:**
  - Dates are "YYYY-MM-DD" strings in and out, so a time zone can't shift a day.
  - A payday missing from a month falls on its last day.
  - `payWeekday` numbering is 0 = Sunday, matching Postgres `extract(dow)`.
  - Semi-monthly payday 1 must be the 27th or earlier, so it can't land on the same day as payday 2 in February.
  - Ranges across years show both years (owner's choice).
- **Tests:** Written first and failing. Now 30 period tests pass, also under `TZ=America/New_York`, `Pacific/Auckland` and `UTC`. 62 unit tests in total; lint and typecheck pass.
- **AI notes:** The payday 1 ≤ 27 rule is Claude's addition; the onboarding form needs to match it.
- **Next:** 2b, the migration for `budgets`, `budget_periods` and `income_sources`.

## 2026-11-19 · Week 2 · Plan and decisions
- **What:** Settled the Week 2 items in the plan review and wrote `docs/week-2-tasks.md`, with tasks 2a–2f. The owner also turned on Vercel Deployment Checks, so production waits for the GitHub `check` job.
- **Files:** `docs/plan-review-2026-11-19.md`, `docs/week-2-tasks.md` (new), `docs/mvp-brief.md` (data model, Week 2 test cases), `docs/designs/onboarding.md`, `income.md`, `dashboard.md`, `style-guide.md`.
- **Decisions:**
  - 3.2: `income_sources.end_date` is optional. 3.3: income start date defaults to the first period's start.
  - 3.11: hiding the Get started checklist is remembered in the browser only.
  - 3.13: weekly periods follow `pay_weekday`; `week_start` only sets how calendars display.
  - 3.14: `budget_periods.first_pay_received`.
  - 4.1: the "no budget yet" check is in the `(app)` layout. 4.2: `/onboarding` goes in the proxy. 4.3: `lib/money.ts` stays one file.
  - 4.10: a desktop Done card. 4.11: fields are 48px in the app and 52px on auth.
  - 4.12: CI blocks production deploys.
- **AI notes:**
  - Claude first told the owner to look for "Deployment Checks" as its own menu item. It's a section inside Settings → Build and Deployment.
  - Claude recommended a required `opening_balance`. That conflicts with onboarding saving the budget at step 1 and the balance at step 3. The owner then chose nullable (3.1).
- **Next:** 2a `getPeriod()`, tests first.

## 2026-11-19 · Week 1 · GitHub Actions CI
- **What:** Every push and pull request runs these on Node 22: `npm ci`, lint, typecheck and the unit tests.
- **Files:** `.github/workflows/ci.yml`, `docs/week-1-tasks.md`, `docs/mvp-brief.md`. Also ticks the app shell, which the owner checked on mobile and desktop.
- **Decisions:**
  - Included unit tests, as the brief's stack table says.
  - Left out `test:db` (needs Docker) and `next build` (Vercel builds every push).
  - No secrets. A newer push to the same branch cancels the older run.
  - A failing run does not block Vercel deploys yet.
- **Tests:**
  - The same steps pass locally: `npm ci` in a clean folder (594 packages), lint, typecheck, 32 tests.
  - The first GitHub run is checked after pushing.
- **AI notes:** None.
- **Next:** Week 1 is done. Before Week 2: settle plan review sections 3–5, update the brief's data model, start `V1.1.md` and write `week-2-tasks.md`.
- **Open:** Should a failed CI run block deploys (branch protection or Vercel setting)? Decide later.

## 2026-11-19 · Week 1 · Dev server uses local Supabase
- **What:** `npm run dev` now uses local Supabase (Docker) instead of the live project. Before this, signing up or clicking around on localhost wrote real rows to the live database.
- **Files:** `.env.development.local` (new, gitignored, local URL and publishable key), `.env.example` (comment explaining the override).
- **Decisions:**
  - Used Next.js's own env file order: `.env.development.local` is loaded before `.env.local`, and only by `next dev`. Builds and Vercel still use live.
  - To test against live, delete or rename the file and restart the dev server.
- **Tests:**
  - `@next/env` resolves dev to `127.0.0.1:54321` and build to the live URL.
  - The dev server lists `.env.development.local` first.
  - lint, typecheck and `npm run test` (32) pass.
- **AI notes:**
  - The owner asked whether local and live share data. Claude checked the env files: the databases are separate, but the dev server pointed at live.
  - The old dev server's node process survived a stop, so Claude killed it by its process ID before restarting.
- **Decided:** `supabase/config.toml` stays as it is. Local sign-up skips the confirmation email and logs in at once, so go to `/dashboard` after the Check your email page. Turning confirmation on would break the database tests, which need a session straight from sign-up, and sign-up confirmation was already tested on live. Password-reset links may open on `127.0.0.1` instead of `localhost`. Google sign-in is off locally; test it on live.
- **Next:** GitHub Actions (lint and type check on every push).

## 2026-11-19 · Week 1 · App shell frame
- **What:** Every app page now sits in a shared frame (`src/app/(app)/layout.tsx`):
  - Under 768px, a bottom bar: Home, Plan, a raised + button, Activity, More.
  - From 768px, a 240px sidebar with the main links, Settings and a profile chip.
  - A page header with three mobile styles (greeting, title, or back arrow + title) and a desktop greeting, title and Add transaction button.
  - A Manila-time greeting.
  - Placeholder pages for Plan, Activity, More, Income, Bills, Savings, Debts and Settings, each checking the login.
  - Log out moved from the dashboard to More and Settings.
- **Files:** src/app/(app)/layout.tsx, src/app/(app)/{plan,activity,more,income,bills,savings,debts,settings}/page.tsx, src/app/(app)/dashboard/page.tsx, src/app/layout.tsx (viewport-fit), src/components/shell/ (nav-items, bottom-bar, sidebar, sidebar-nav, profile-chip, page-header, page-shell, placeholder-page, log-out-button), src/lib/greeting.ts, src/lib/current-profile.ts, src/lib/require-app-user.ts, src/proxy.ts (`/more`), tests/lib/greeting.test.ts, docs/week-1-tasks.md, docs/mvp-brief.md
- **Decisions:**
  - The owner chose (a): the + button and Add transaction link to `/activity` until the add sheet exists (Week 3).
  - Mobile Activity and desktop Transactions share `/activity`.
  - Each page checks login and consent itself with `requireAppUser()`, because a layout doesn't re-run between pages. The profile query is cached per request, so the chip, greeting and check share one call.
  - Current links use the theme-aware `link` and `link-hover` tokens, because Forest text on `mint` is unreadable in dark mode.
  - Left out for now: the period switcher, the budget name, the bell, hiding the bar on sheets, and the desktop `/more` → `/settings` redirect.
  - Placeholders use a new `PlaceholderPage`, not `ComingSoon` (which has its own `<main>` and a "Back to home" link).
- **Tests:** `npm run lint`, `npm run typecheck`, `npm run test` (32, including 8 for the greeting) and `npm run build` pass. Logged out, all 9 app routes redirect to `/login`. Logged-in pages need a real session, so the owner checks them by eye.
- **AI notes:** The first build failed because the server-side sidebar passed icon components to a client component; the client component now imports the nav lists itself.
- **Brief:** Ticked auth, middleware and profiles in the Week 1 list. The app shell waits for the owner's check. GitHub Actions (lint and type check on push) is still open. It was missing from `week-1-tasks.md` and is now added there.
- **Next:** The owner checks the shell by eye; then GitHub Actions, the last Week 1 task.

## 2026-11-19 · Week 1 · Fix the Vercel build: @types/node 22
- **What:** Vercel's build failed at `npm install` with `ERESOLVE`: Vitest 5.1.0 expects `@types/node` `^22 || >=24`, and the project had `^20`. Moved `@types/node` to `^22` (22.20.5), matching local Node 22.16, and regenerated the lockfile with a normal `npm install`.
- **Files:** package.json, package-lock.json, README.md (Node 22 or later)
- **Decisions:** Fixed the real conflict instead of adding `legacy-peer-deps` to `.npmrc`. The same conflict caused npm's `edgesOut` crash on the Vitest and Supabase CLI installs, so `--legacy-peer-deps` is no longer needed (the earlier note about future installs no longer applies). Vercel's Node.js version should be 22.x to match the types.
- **Tests:** A clean install from the new lockfile in an empty folder worked (594 packages, no conflict). `npm run lint`, `npm run typecheck`, `npm run test` (24), `npm run test:db` (26) and `npm run build` pass.
- **AI notes:** Claude installed with `--legacy-peer-deps` to get past the crash instead of finding its cause, which hid the conflict until Vercel's normal install hit it.
- **Deployed:** The Vercel build passed. The owner logged in on the live URL with an existing account and went straight to the dashboard (consent now read from `profiles`).
- **Live tests:** A new email sign-up with a plus address worked (owner, Nov 19). A new Google sign-in (`/consent` → `record_consent` → dashboard) is **not tested on live yet**: waiting for a second Google test user or the published consent screen.
- **Next:** The app shell frame.

## 2026-11-19 · Week 1 · `profiles` part 2: the app reads and writes profiles
- **What:** A new `record_consent(name, version)` database function records consent from the one-time Google consent step. Sign-up sends `consent_version`. The dashboard, the consent page and `/auth/callback` check `profiles.consent_at`, and the greeting reads `profiles.display_name`. The Supabase clients are typed with the generated schema. The consent checkbox now says "I'm 18 or older and agree to…".
- **Files:** supabase/migrations/20261119065318_record_consent.sql, src/lib/legal.ts, src/lib/profiles.ts, src/lib/auth/consent.ts, src/lib/supabase/client.ts, src/lib/supabase/server.ts, src/lib/supabase/proxy.ts, src/lib/supabase/types.ts, src/proxy.ts, src/app/(auth)/actions.ts, src/app/(auth)/consent/page.tsx, src/app/auth/callback/route.ts, src/app/(app)/dashboard/page.tsx, src/components/auth/consent-checkbox.tsx, src/lib/validation/auth.ts, src/app/globals.css (comment), tests/db/record-consent.test.ts, tests/lib/validation/auth.test.ts, docs/designs/auth-screens.md, docs/designs/index.md, CLAUDE.md, docs/week-1-tasks.md, docs/plan-review-2026-11-19.md
- **Decisions:** Option (a): consent goes through a `security definer` function that only updates the caller's row and uses the database's clock. `CONSENT_VERSION = "2026-11-14"` (legal.md's "Last updated"), kept in `src/lib/legal.ts` for the legal pages to share. `profiles.consent_at` is now the record; the login data still gets a copy so the proxy's quick check passes without a query. When that quick check fails, the proxy now checks `profiles`, not the login data again, so a failed copy can't cause a `/consent` ↔ `/dashboard` loop. Fixed plan review section 2 (paths after the style guide move).
- **Tests:** `npm run test:db` (26, including 6 for `record_consent`), `npm run test` (24), `npm run lint`, `npm run typecheck` and `npm run build` pass. A dry run shows only `record_consent` would go to live.
- **Deploy order:** push the migration to live **before** pushing this code, or the consent step calls a function that doesn't exist yet. The migration went live Nov 19 after the owner's go; checked on live that logged-out visitors can't call `record_consent` and logged-in users can.
- **Next:** Push the migration, then the code; the owner tests sign-up and Google consent on the live URL. Then the app shell frame.

## 2026-11-19 · Week 1 · `profiles` migration applied to the live project
- **What:** Linked the repo to the live Supabase project and pushed `20261119061715_profiles.sql` after the owner's go.
- **Files:** docs/week-1-tasks.md, docs/plan-review-2026-11-19.md (no code changes; `supabase/.temp`, where the link is stored, is gitignored)
- **Decisions:** Before pushing, local Supabase was switched to the live versions recorded by `link` (Postgres 17.12, PostgREST 14.18, Auth 2.198; local had been on PostgREST 16.5 and Auth 2.197), and all 20 database tests passed there. A dry run showed only this migration would be applied.
- **Tests:** Read-only checks on live: the migration is in the history; 2 accounts and 2 profiles (both test users backfilled, both with consent); RLS is on; the sign-up trigger exists.
- **Correction:** The live project is in **Tokyo (`ap-northeast-1`)**, not Singapore as the Nov 18 entry says (confirmed by the owner). The Privacy Notice must say so (plan review 4.9).
- **Next:** Profiles part 2: the app reads and writes `profiles`, records `consent_version`, and adds "I'm 18 or older" to the consent text.

## 2026-11-19 · Week 1 · Plan review against the design specs
- **What:** The owner added every page spec to `docs/designs/` and moved the style guide there. Claude checked them all against the brief's data model and 9-week plan, and the findings are tracked in `docs/plan-review-2026-11-19.md`.
- **Files:** docs/plan-review-2026-11-19.md
- **Found:** 2 decisions before the profiles migration goes live (`consent_version`, 18+ consent text), 3 broken references after the move, 12 data model gaps (Weeks 2–8), 8 architecture decisions, and more scope than 9 weeks allow, with 7 candidates for `V1.1.md`.
- **Decided:** 1.1, add `consent_version` to `profiles` (done in the profiles migration, which wasn't live yet, so the file was edited instead of adding a second one). 1.2, add "I'm 18 or older" to the consent text in profiles part 2.
- **Next:** Apply the profiles migration to the live project.

## 2026-11-19 · Week 1 · `profiles` table with RLS (part 1, local)
- **What:** Migration for `profiles`. A trigger on `auth.users` creates the profile at sign-up and copies the display name. Existing accounts are backfilled. Added local Supabase (Docker) and 20 database tests, including that user A can't read or change user B's profile. Later the same day, `consent_version` was added (plan review 1.1). The trigger keeps it only with consent and only if it looks like a date, and users can't change it. Generated `src/lib/supabase/types.ts` from the local database.
- **Files:** supabase/config.toml, supabase/.gitignore, supabase/migrations/20261119061715_profiles.sql, vitest.db.config.ts, vitest.config.ts, tests/db/helpers.ts, tests/db/profiles.test.ts, src/lib/supabase/types.ts, package.json, package-lock.json, .env.example, README.md, docs/week-1-tasks.md
- **Decisions:** `week_start` is `monday` or `sunday`, default `monday`. Users can't change `is_demo`, `consent_at`, `user_id`, `id` or the timestamps, even on their own row (column permissions, owner's call). There are no insert or delete policies: the trigger creates profiles, and deleting the account removes them. At sign-up the trigger records the database's time for `consent_at` when the form sent consent, rather than trusting the time sent. It also trims and shortens the name, because anyone can call the sign-up API directly. Added a shared `set_updated_at()` trigger function for later tables. New dev dependency: `supabase` CLI 2.122.1 (3.0 is a brand-new major version), installed with `--legacy-peer-deps`. Database tests run with `npm run test:db`, kept out of `npm run test` so unit tests and CI don't need Docker. They refuse to run against anything but a localhost URL.
- **Tests:** `npm run lint`, `npm run typecheck`, `npm run test` (24) and `npm run test:db` (20) pass. With RLS turned off on the local database, 7 tests failed, including all three cross-user checks, so the tests do catch a missing policy; RLS was turned back on.
- **AI notes:** Docker Desktop installed per-user, and VS Code's terminal didn't have it on PATH until restarted; Claude added the path for its own commands. PowerShell 5.1 garbled the generated types file, so it was generated through Bash instead.
- **Also:** The owner tested the logged-in proxy cases (Log in and Sign up go to the dashboard, the reset link, and the Google consent step).
- **Not done yet:** The migration isn't on the live project. Google users' `consent_at` stays empty in `profiles` until Part 2. Onboarding (`docs/designs/onboarding.md`) was reviewed; its impact on Weeks 2–6 is in the reply and should go into a Week 2 task split.
- **Next:** Apply the migration to the live project, then Part 2.

## 2026-11-19 · Week 1 · Vitest set up
- **What:** Added `npm run test` (`vitest run`) and `npm run test:watch`. Added the first unit tests: `passwordStrength` (8 tests) and the auth Zod schemas (16 tests). All 24 pass.
- **Files:** vitest.config.ts, tests/lib/auth/password-strength.test.ts, tests/lib/validation/auth.test.ts, package.json, package-lock.json, README.md, docs/week-1-tasks.md
- **Decisions:** New dev deps `vitest` 5.1.0 and `vite` 8.3.5 (Vitest's required peer), the newest versions at least two weeks old. Both were installed with `--legacy-peer-deps` because npm 10.9.2 crashes (`Cannot read properties of null (reading 'edgesOut')`) on a normal install, even for Vitest 4.1.12. That flag skips peers, which is why `vite` had to be added by hand. Tests run in Node, live in `tests/` mirroring `src/lib`, and use the same `@/` alias as the app. The `profiles` RLS test will use local Supabase, not the hosted project (owner's call).
- **Tests:** `npm run test` (24 passed), `npm run lint` and `npm run typecheck` pass.
- **AI notes:** On Windows, Vitest 5.1.0 fails every test file (`Cannot read properties of undefined (reading 'config')`) when started from a lowercase `c:\` path, which is how VS Code opened the project; from `C:\` everything passes. Claude tried changing directory in the config, setting `root` to the uppercase path, and other pool modes; none worked, so they were removed. Owner chose to run tests from `C:\` (noted in the README) for now.
- **Open questions:** Try Vitest 5.1.1 after Dec 2 (two weeks old) in case it fixes the Windows path bug. Any future `npm install` may need `--legacy-peer-deps` until npm is updated. The README's env table still lists `NEXT_PUBLIC_SUPABASE_ANON_KEY`, but the app uses `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
- **Next:** `profiles` table with RLS, plus local Supabase for its RLS test.

## 2026-11-19 · Week 1 · Proxy: session refresh and page redirects
- **What:** Added `src/proxy.ts`. On every page request it refreshes the Supabase session cookie, sends logged-out users from app pages (`/dashboard`, `/plan`, `/activity`, `/savings`, `/debts`, `/bills`, `/income`, `/settings` and below) to `/login`, sends logged-in users from `/login` and `/signup` to `/dashboard`, and sends users without consent from app pages to `/consent`.
- **Files:** src/proxy.ts, src/lib/supabase/proxy.ts, src/lib/supabase/server.ts (comment), src/app/(app)/dashboard/page.tsx (comments), docs/week-1-tasks.md
- **Decisions:** Logged-in users on Log in or Sign up go to the dashboard. Forgot password, Set new password and Check your email stay open because the reset flow uses them while logged in. No `?next=` return-to-page yet; everyone lands on `/dashboard`. Uses `getClaims()` (checks the token locally when possible) instead of `getUser()` on every request. The token's metadata only updates on refresh, so when it says "no consent" the proxy asks Supabase with `getUser()` before redirecting, so the user doesn't loop between `/consent` and `/dashboard` right after consenting. Redirects copy any refreshed cookies. Pages keep their own guards because the proxy is only a fast first check.
- **Tests:** `npm run lint`, `npm run typecheck` and `npm run build` pass. Logged out on localhost: `/dashboard`, `/dashboard/x` and `/settings` → `/login`; the auth pages, `/privacy`, `/`, the `/auth/*` routes, icons and CSS work as before. Logged-in cases not yet tested.
- **Owner decided:** `?next=` return-to-page comes later as its own task, once there are more app pages. Set up Vitest as a small task before the `profiles` table.
- **Next:** Owner tests the logged-in cases. Then Vitest setup, then the `profiles` table.

## 2026-11-18 · Week 1 · Google sign-in and consent step (3f)
- **What:** Both Google buttons start Google sign-in through Supabase. `/auth/callback` finishes it. A first-time Google user goes to `/consent` ("One last thing"): a name pre-filled with their first name from Google, plus the same unticked consent checkbox. The dashboard sends anyone without consent there. Cancelling on Google's screen goes back to Log in with a note.
- **Files:** src/app/(auth)/actions.ts, src/app/auth/callback/route.ts, src/app/(auth)/consent/ (page, consent-form), src/components/auth/google-button.tsx, src/components/auth/consent-checkbox.tsx (moved out of the sign-up form), src/app/(auth)/signup/signup-form.tsx, src/app/(auth)/login/page.tsx, src/app/(auth)/login/login-form.tsx, src/app/(app)/dashboard/page.tsx, src/lib/auth/consent.ts, src/lib/validation/auth.ts, docs/week-1-tasks.md
- **Decisions:** Owner chose a one-time consent step over an "By continuing you agree" notice, so Google users give the same explicit consent as email users. The step also asks for a name, so both kinds of users choose what to be called. Until the proxy task, only the dashboard enforces consent. The Google client secret lives only in Supabase, not in the app.
- **Tests:** `npm run lint`, `npm run typecheck` and `npm run build` pass. Checked `/auth/callback` without a code → `/login?error=google` with the note, and `/consent` logged out → `/login`. The owner set up the Google OAuth client (consent screen in Testing mode) and tested Google sign-in on localhost.
- **Next:** Publish the Google consent screen before public launch. Then the proxy task.


## 2026-11-18 · Week 1 · Forgot password and Set new password (3e)
- **What:** `/forgot-password` sends a reset email and always goes to Check your email (now worded for reset). `/auth/reset` opens the link and logs the user in for the reset. `/reset-password` shows the email, the strength panel, "Passwords match" and "Log out on other devices" (ticked). After saving, the user is signed out and `/login` says "Password updated."
- **Files:** src/app/(auth)/forgot-password/ (page, forgot-password-form), src/app/(auth)/reset-password/ (page, set-password-form), src/app/auth/reset/route.ts, src/app/(auth)/actions.ts, src/app/(auth)/check-email/ (page, resend-button), src/app/(auth)/login/page.tsx, src/lib/auth/pending-email.ts, src/lib/auth/password-strength.ts, src/lib/validation/auth.ts, src/components/auth/auth-card-layout.tsx, src/components/auth/password-field.tsx
- **Decisions:** The pending-email cookie also stores what the email was for (sign-up or reset), so Check your email and Resend handle both. Reset requests never reveal whether the email has an account. Strength levels: Weak below the rules, Strong with 12+ characters and mixed case or a symbol, Okay in between. "Not the same as your old password" can't be checked in the browser, so it stays unticked and Supabase's `same_password` error shows under the field. Ticked "Log out on other devices" signs out every session; unticked signs out only this one. Both then go to Log in, as the design doc says. Fixed `PasswordField` replacing its own classes when given a `className`.
- **Tests:** `npm run lint`, `npm run typecheck` and `npm run build` pass. Checked `/auth/reset` with a bad code goes to `/forgot-password?error=link-expired`, and `/login?password=updated` shows the note. Screenshots of Forgot password at 390px and 1280px. The owner tested the full reset flow, including the error for reusing the old password. Like sign-up, the reset link only works in the browser that asked for it until custom SMTP lets us edit templates.
- **AI notes:** The dev server served a stale module (`TileMascot` undefined, a 500 error) until the file was edited again; the production build was fine.
- **Next:** Owner tests the reset flow; then 3f, Google sign-in.

## 2026-11-18 · Week 1 · Log in and log out (3d), sign-up privacy fix
- **What:** `/login` now logs in with Supabase (React Hook Form + Zod, server-side check too). The dashboard placeholder has a Log out button. Sign-up with an email that already has an account now shows Check your email like any other sign-up.
- **Files:** src/app/(auth)/actions.ts, src/app/(auth)/login/login-form.tsx, src/app/(app)/dashboard/page.tsx, src/lib/validation/auth.ts, docs/week-1-tasks.md
- **Decisions:** Owner chose privacy over the design doc's "There's already an account" message, so nobody can use sign-up to check whether an email is registered; Resend also reports success for an already-confirmed email (the error is logged on the server). Wrong email or password gives one message that never says which was wrong. "Email not confirmed" (only returned after a correct password) goes to Check your email. Log out signs out this device only.
- **Tests:** `npm run lint`, `npm run typecheck` and `npm run build` pass. Owner tested log out, wrong password, log in, and signing up again with an existing email on localhost.
- **Confirmed:** the first test user's metadata has both `display_name` and `consent_at`.
- **Docs:** `docs/designs/auth-screens.md` now says never to reveal whether an email has an account (the "Email already used" message is removed).
- **Next:** 3e, Forgot password and Set new password, or 3f, Google sign-in.

## 2026-11-18 · Week 1 · Sign up and Check your email (3c)
- **What:** `/signup` creates a Supabase user with React Hook Form + Zod; `/check-email` shows the email with Open email app, a 45-second Resend and the spam note; `/auth/confirm` verifies the email link, logs the user in and goes to a placeholder `/dashboard`. Added the centered-card layout.
- **Files:** src/lib/validation/auth.ts, src/lib/auth/pending-email.ts, src/lib/auth/email-app.ts, src/app/(auth)/actions.ts, src/app/(auth)/signup/ (page, signup-form), src/app/(auth)/check-email/ (page, resend-button), src/app/auth/confirm/route.ts, src/app/(app)/dashboard/page.tsx, src/components/auth/auth-card-layout.tsx, src/components/auth/auth-split-layout.tsx, package.json, package-lock.json
- **Decisions:** New deps `zod` 4.6, `react-hook-form` 7.92, `@hookform/resolvers` 7.0. Display name and consent time are saved in the Supabase user's metadata for the profiles task to copy. The pending email lives in a 1-hour httpOnly cookie, not the URL, and Resend reads it from there, so it can't email other addresses. The email link uses `token_hash` + `verifyOtp` (works across devices), with a `?code=` fallback. "Open email app" only shows for Gmail, Yahoo, Outlook and iCloud addresses. Session reads are inside `<Suspense>` because Cache Components is on.
- **Tests:** `npm run lint`, `npm run typecheck` and `npm run build` pass. Checked redirects: `/check-email` with no pending email → `/signup`; `/dashboard` logged out → `/login`; a bad confirm link → `/check-email?error=link-expired`. Screenshots at 390px and 1280px. The owner signed up with a real email on localhost, clicked the link in the same browser and reached the dashboard.
- **Email template:** Supabase only allows template edits with custom SMTP, so the `token_hash` template change is skipped for now. The default `?code=` link works through the fallback in `/auth/confirm`, but only in the browser used to sign up; elsewhere the email still gets confirmed and the user is asked to log in. Switch the template when SMTP is set up.
- **Open questions:** Resend's free plan needs a verified domain you own before it can email other people, and `*.vercel.app` can't be verified. Week 8 needs a custom domain or another free SMTP option. "Email already used" tells people that an account exists (the design doc asks for it), while Forgot password hides this. Keep it? Supabase's built-in email sender allows only a few emails per hour, so testing may hit "Too many tries" until Resend SMTP (Week 8).
- **Next:** Owner updates the Supabase email template and tests sign-up end to end; then 3d, Log in and log out.

## 2026-11-18 · Week 1 · Auth building blocks and Log in screen (3b)
- **What:** Built `/login` (UI only) from `docs/designs/auth-screens.md`: mobile layout with a centered logo, desktop split screen with the mint pitch panel and a sticker Safe to spend example card, and dark mode. Added shared auth components.
- **Files:** src/app/(auth)/login/page.tsx, src/app/(auth)/login/login-form.tsx, src/components/auth/ (logo, auth-split-layout, text-field, password-field, google-button, or-divider, submit-button, form-error), src/app/globals.css, docs/week-1-tasks.md
- **Decisions:** New tokens: `link` and `link-hover` (switch in dark mode), `placeholder` (#7A8A80), `logo-backdrop` (light mint behind the logo in dark mode). Focus and error borders use a 1.5px border plus a 0.5px inset shadow so text doesn't shift. Field errors use `bad-fg` (#9B2C2C), not `danger`, which stays reserved for deletes. The form's submit is blocked until 3d so the browser can't GET the password into the URL. Demo button hidden; the Turnstile spot is marked with a comment. The centered-card layout moved to 3c.
- **Tests:** `npm run lint` and `npm run typecheck` pass. Screenshots in headless Edge at 390px (via an iframe, since headless windows can't go below ~500px) and 1280px, in light and dark mode (by adding `dark` to `<html>` temporarily, then reverting).
- **AI notes:** The design canvas couldn't be read (it loads with JavaScript), so this is built from the design doc only. The pitch panel's three feature rows aren't in the doc; Claude wrote placeholder copy. The running dev server served stale CSS without the dark link colour until globals.css was edited again.
- **Next:** 3c, Sign up and Check your email.

## 2026-11-18 · Week 1 · Supabase clients, auth task split, placeholder pages
- **What:** Added the browser and server Supabase clients (task 3a). Split the auth task into 3a–3f in `docs/week-1-tasks.md` after reviewing `docs/designs/auth-screens.md`. Added "coming soon" placeholders at `/privacy` and `/terms`. Changed `profiles` in the brief to use `user_id`.
- **Files:** src/lib/supabase/env.ts, src/lib/supabase/client.ts, src/lib/supabase/server.ts, src/components/coming-soon.tsx, src/app/privacy/page.tsx, src/app/terms/page.tsx, docs/week-1-tasks.md, docs/mvp-brief.md, package.json, package-lock.json
- **Decisions:** New deps `@supabase/supabase-js` 2.119 and `@supabase/ssr` 0.12. The server client swallows the cookie write error in Server Components; the proxy task will refresh sessions. `profiles` gets its own `id` plus a unique `user_id`, per CLAUDE.md. Turnstile, the demo button and real Privacy/Terms pages wait for Week 8; sign-up goes to the dashboard until onboarding exists.
- **Tests:** `npm run lint` and `npm run typecheck` pass. A throwaway script with `.env.local` got HTTP 200 from Supabase Auth settings: email on, confirm email on, Google off (expected until 3f). Vitest isn't set up yet, so there is no `npm run test`.
- **AI notes:** `npm audit` reports existing moderate and high issues in `minimatch` and `picomatch`, pulled in by shadcn's tooling rather than the Supabase packages. Not fixed: `--force` would make breaking changes.
- **Next:** 3b, the shared auth building blocks and the Log in screen (UI only).

## 2026-11-18 · Week 1 · Supabase project and env vars
- **What:** Created the Supabase project (free plan, Singapore region, automatic RLS on). Added `.env.local` and Vercel env vars, and listed the variable names in `.env.example`.
- **Files:** .env.example, docs/mvp-brief.md (ticked the task)
- **Decisions:** Used the new publishable key (`sb_publishable_…`) instead of the legacy anon key. Both vars are plain config in Vercel, not secrets, because `NEXT_PUBLIC_` values ship to the browser anyway. No service_role key is used. Migrations will still enable RLS explicitly, because auto-RLS is a setting on the hosted project and doesn't carry over to other databases.
- **Tests:** Checked `.env.local` is gitignored and the URL has no `/rest/v1` suffix. Env vars added in Vercel and redeployed. Supabase isn't called from code yet.
- **Also done:** Auth redirect URLs (localhost and the Vercel URL) added in Supabase. The empty `.env` file stays (owner's call).
- **Next:** Supabase Auth with email + password and Google; login, sign-up and logout pages.

## 2026-11-17 · Week 1 · Pushed to GitHub and deployed on Vercel
- **What:** Pushed the scaffold to GitHub and connected the repo to Vercel; the app is live. Ticked the first Week 1 task in `docs/mvp-brief.md`.
- **Files:** docs/mvp-brief.md
- **Decisions:** The GitHub repo was renamed to `chiwawallet`; the local remote still uses the old name and works through GitHub's redirect.
- **Tests:** Deployed by the owner on Vercel.
- **Live URL:** https://chiwawallet.vercel.app/ (added to the README).
- **Open questions:** Update the local remote to the new repo name. The README's clone command still has a `[YOUR GITHUB USERNAME]` placeholder.
- **Next:** Create the Supabase project; add `.env.local`, `.env.example` values and Vercel env vars.

## 2026-11-17 · Week 1 · Sticker shadow back to fixed black
- **What:** Reverted the sticker shadow to the style guide's original fixed #1C1C1E in both themes. Added a `sticker` color token (also #1C1C1E) for the sticker border, so the border stays black in dark mode too instead of turning light with `ink`.
- **Files:** src/app/globals.css, src/app/page.tsx, docs/style-guide.md
- **Decisions:** Sticker elements use `border-sticker`, not `border-ink`. `ink` is now for text only.
- **Tests:** `npm run lint`, `npm run typecheck` and `npm run build` pass. Not yet re-checked by eye in dark mode.
- **Open questions:** On the dark background (#0F1A14) the black border and shadow are close to invisible, so the hero card may look flat. The ₱ on the hero card may be falling back to another font if Fredoka has no peso glyph.
- **Next:** Push to GitHub and connect Vercel.

## 2026-11-17 · Week 1 · Icon folder cleanup
- **What:** Moved the icon README and `preview.png` out of `public/` so they aren't served on the live site, and deleted the three unused `favicon-*.png` sizes. Updated the icon README to show where each file lives now.
- **Files:** docs/icons/README.md, docs/icons/preview.png, public/icons/ (only the four PWA icons remain)
- **Decisions:** `favicon.ico` already covers the small sizes, so the separate PNGs weren't needed.
- **Tests:** No code changed; file moves only.
- **Next:** Push to GitHub and connect Vercel.

## 2026-11-17 · Week 1 · Sticker shadow in dark mode, docs as source of truth
- **What:** The sticker shadow now follows `ink`, so it turns light in dark mode. `CLAUDE.md` points at `docs/mvp-brief.md` and `docs/style-guide.md` as the source of truth, replacing the online links.
- **Files:** src/app/globals.css, docs/style-guide.md, CLAUDE.md
- **Decisions:** Updated the style guide (sections 4 and 10) to match the code, so the two don't disagree.
- **Tests:** `npm run lint`, `npm run typecheck` and `npm run build` pass; the built CSS uses `var(--ink)` for the shadow. Not yet checked by eye in dark mode.
- **Open questions:** Leftover files in `public/icons/` (README, preview, extra favicon sizes) still need a decision.
- **Next:** Push to GitHub and connect Vercel.

## 2026-11-17 · Week 1 · App icons and logo in place
- **What:** Moved the icon set from `public/icons/` to where Next.js picks it up: favicon, SVG tab icon, Apple touch icon and the logo mark. The Chiwawallet favicon replaces the Next.js starter one.
- **Files:** src/app/favicon.ico, src/app/icon.svg, src/app/apple-icon.png, public/logo-mark.svg, public/icons/ (PWA icons stay here)
- **Decisions:** Followed the mapping in `public/icons/README.md`. Left the PWA icons in `public/icons/` for the Week 8 manifest.
- **Tests:** `npm run lint`, `npm run typecheck` and `npm run build` pass; the build lists `/icon.svg` and `/apple-icon.png`. Not yet checked in a browser tab.
- **Open questions:** `public/icons/README.md`, `preview.png` and the three `favicon-*.png` files are not used by the app but would be served publicly; move them to `docs/` or delete them?
- **Next:** `app/manifest.ts` in Week 8 uses the PWA icons.

## 2026-11-17 · Week 1 · Next.js app, shadcn/ui and theme tokens
- **What:** Scaffolded the Next.js app (TypeScript strict, App Router, Tailwind v4), installed shadcn/ui with one Button, added the style guide's theme tokens and fonts, and replaced the starter page with a temporary token check page. Also renamed `.env.sample` to `.env.example`, tightened `.gitignore` to `.env*`, and switched the brief to Needs / Wants / Savings & debt payoff (`needs / wants / savings_debt`).
- **Files:** package.json, package-lock.json, tsconfig.json, next.config.ts, eslint.config.mjs, components.json, AGENTS.md, src/app/layout.tsx, src/app/page.tsx, src/app/globals.css, src/app/favicon.ico, src/components/ui/button.tsx, src/lib/utils.ts, .gitignore, .env.example, docs/mvp-brief.md, docs/dev-log.md
- **Decisions:**
  - Kept the Next.js 16.4 defaults: Cache Components and Partial Prefetching on, Tailwind through `@tailwindcss/turbopack` (no PostCSS config), and the generated `AGENTS.md`.
  - shadcn's default preset (`base-nova`) builds on Base UI (`@base-ui/react`), not Radix.
  - `typecheck` runs `next typegen` before `tsc --noEmit`, because `LayoutProps` comes from generated route types.
  - Fonts load the `latin-ext` subset as well as `latin`, because the peso sign (₱) is not in `latin`.
  - Tokens that point at another variable sit in `@theme inline` so they follow `.dark`; fixed values sit in `@theme`.
  - `rounded-sm/md/lg/xl` use the style guide's radii (10, 14, 18, 24px), replacing shadcn's computed ones.
- **Tests:** `npm run lint`, `npm run typecheck` and `npm run build` pass. Not yet checked by eye in a browser. No Vitest yet (comes with `getPeriod` in Week 2).
- **AI notes:** Claude couldn't read the online brief and style guide, so they were copied into `docs/`. The scaffold differed from Claude's first plan (AGENTS.md, Turbopack Tailwind, Cache Components), so it paused for approval before copying files in.
- **Open questions:**
  - Sticker shadow in dark mode: the shadow is fixed at #1C1C1E while `ink` turns light, so it nearly disappears on the dark background.
  - The online brief still says Essentials / Non-essentials; `docs/mvp-brief.md` is updated.
  - Nothing switches the `.dark` class on yet (needs a theme switcher tied to `profiles.theme`).
- **Next:** Push to GitHub and connect Vercel; restyle Button into the guide's variants (Hero, Primary, Secondary, Soft, Dashed, Destructive); then the Supabase project and env variables.
