# CLAUDE.md — Chiwawallet

Chiwawallet ("Sit. Stay. Save.") is a free budgeting PWA for Filipino earners that plans money **by payday** (weekly, twice a month or monthly), not by calendar month. Solo portfolio project, built with AI assistance. Users: the owner, a few friends, public sign-ups, and portfolio reviewers using a demo account.

Source of truth (read these before big changes):
- Product brief, data model, 9-week plan: `docs/mvp-brief.md`
- Design style guide (colors, type, components, voice): `docs/designs/style-guide.md`
- Page and component specs (one per screen, each ending with "Fix before building"): `docs/designs/`, starting from `docs/designs/index.md`
- Screen designs (mobile + desktop): https://claude.ai/artifact/Cj6taSLB1R4SoTxvbm8Hnd

If the code and these documents disagree, stop and ask. Don't silently pick one.

## Stack

- Next.js (App Router) + TypeScript (strict) + Tailwind CSS v4 + shadcn/ui
- Supabase: Postgres, Auth (email + Google), Row Level Security. Use `@supabase/ssr`.
- Server Actions and Route Handlers. No separate API server.
- Zod + React Hook Form for every form; date-fns for dates
- Vitest (unit), Playwright (one end-to-end flow)
- PWA: `app/manifest.ts` + Serwist
- Hosting: Vercel Hobby. Auth email: Resend SMTP. Bot check: Cloudflare Turnstile.
- Everything must stay on free tiers. Ask before adding any paid service or new dependency.

## Commands

```bash
npm run dev          # local dev server
npm run lint         # ESLint
npm run typecheck    # tsc --noEmit
npm run test         # Vitest
npm run test:e2e     # Playwright
npx supabase gen types typescript --project-id <id> > src/lib/supabase/types.ts
```

Run `lint`, `typecheck` and `test` before saying a task is done.

## Folder structure

```
src/
  app/                 # routes: (auth), (app)/dashboard, plan, activity, savings, debts, bills, income, settings
  components/ui/       # shadcn components, themed per the style guide
  components/          # shared app components (MoneyInput, PeriodPicker, EmptyState, ConfirmDelete…)
  lib/
    supabase/          # server + browser clients, generated types
    money.ts           # centavos <-> pesos, formatPeso()
    periods.ts         # getPeriod(), period math (pure functions)
    plan.ts            # generatePlan(), carryOver() (pure functions)
    validation/        # Zod schemas, one file per entity
supabase/migrations/   # SQL migrations, one per change
docs/dev-log.md        # task log, newest entry first (see "How to work with me")
tests/                 # Vitest unit tests mirror src/lib
```

## Non-negotiable rules

### Money and dates
- Store money as **integer centavos** (`bigint`). Never use floats for money. Convert only at the edges via `lib/money.ts`.
- Display with `Intl.NumberFormat('en-PH')`: `₱12,450`, money out `−₱180`, money in `+₱25,000`.
- Dates are `date` values (not timestamps) computed in **Asia/Manila** time.
- Periods run from one payday to the day before the next. If a payday doesn't exist in a month (31st, Feb 30th), use the month's last day.

### Data and security
- Every table has `id`, `user_id`, `created_at`, `updated_at` and **RLS enabled** with `user_id = auth.uid()`. No table ships without RLS and a test that user A can't read user B's rows.
- Never expose the `service_role` key, never put it in a `NEXT_PUBLIC_` variable, and avoid using it at all unless asked.
- Never commit secrets. `.env*` is gitignored; update `.env.example` with empty values when adding a variable.
- Validate every input with Zod on the server, even when the client also validates.
- Choice fields (frequency, pay_slot, group, origin, type) are enums or check-constrained text.
- Soft delete only `transactions` and `plan_items` (`deleted_at`); every query filters `deleted_at is null`.
- Schema changes go in a new migration file. **Ask before changing the data model** in the brief.
- Collect only what the brief lists. No IDs, bank or card numbers, location or contacts (Data Privacy Act).

### Business logic
- Period, plan and carry-over math lives in pure functions in `lib/` with unit tests. UI components never do money math themselves.
- Write or update the tests first for `getPeriod`, `generatePlan` and `carryOver`, then the code.
- "Safe to spend" = cash on hand − planned bills, savings and debt payments still unpaid this period.
- 50/30/20 uses the budget's `needs_pct`, `wants_pct`, `savings_debt_pct`. Never hard-code 50/30/20. Planned debt payments count as Needs; extra payments count as Savings & debt payoff.

## UI rules (details in the style guide)

- Build mobile first at 390px, then scale to desktop.
- Use theme tokens (`bg-mint`, `text-ink`, `bg-green-600`, `shadow-sticker`), never raw hex values in components.
- Fonts: Fredoka for headings and big amounts, Nunito for everything else.
- The black sticker border and shadow go on one hero element per area only.
- Red (`danger`) is only for destructive actions. Deletes follow the 3-level pattern: undo toast, choice dialog, or type-to-confirm.
- Every form shows its effect in pesos before saving.
- Accessibility: real `<button>`, `<a>` and `<label>` elements, 44px tap targets, 4.5:1 contrast, `aria-label` on icon buttons, inputs at least 16px.
- Copy is short, friendly and specific, using the style guide's word list (payday, Safe to spend, Not assigned yet, Keep it).

## How to work with me

- **Confirm before touching code.** Before creating, editing or deleting any file, tell me:
  1. What you plan to change and why
  2. Which files you will create, edit or delete
  3. Any new dependency, migration or environment variable
  4. Risks or side effects (data, auth, RLS, money math)

  Then **wait for my "go"** before making changes. If the plan changes partway through, stop and confirm again. Reading files and running read-only commands (lint, typecheck, tests) don't need approval.
- One small task at a time, usually one checkbox from the 9-week plan. If a request is bigger, propose a split first.
- Keep changes focused. Don't refactor or restyle unrelated files.
- Explain non-obvious code in a short comment or in your reply. I want to understand every line I commit.
- When unsure about a product decision, ask instead of guessing. Note open questions at the end of your reply.
- After each task: list the files changed, how to test it, and a suggested commit message (Conventional Commits, e.g. `feat(plan): add generatePlan for semi-monthly periods`).
- **Log every finished task in `docs/dev-log.md`** (create it if missing). Add the newest entry at the top, using this format:

  ```markdown
  ## 2026-11-18 · Week 1 · Supabase Auth with email and Google
  - **What:** Added login, sign-up and logout pages using Supabase Auth.
  - **Files:** src/app/(auth)/login/page.tsx, src/lib/supabase/server.ts, …
  - **Decisions:** Used Supabase Auth instead of NextAuth so RLS can use auth.uid().
  - **Tests:** Signed up and logged in on localhost; `npm run test` passes.
  - **AI notes:** What Claude suggested, what I changed, anything it got wrong.
  - **Next:** Middleware to protect app pages.
  ```

  Keep entries short. Log open questions and skipped work too, so nothing gets lost between sessions.
- Never run destructive commands (dropping tables, `git push --force`, deleting branches) without asking.

## Out of scope for the MVP

AI insights, offline editing and sync, multi-currency, bank or e-wallet syncing, shared household budgets, an admin panel, custom budgeting models (stored, but hidden until v1.1). Add ideas to a `V1.1.md` list instead of building them.
