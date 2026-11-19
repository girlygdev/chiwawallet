<p align="center">
  <img src="public/logo-mark.svg" alt="Chiwawallet logo: a white chihuahua with black patches peeking out of a green wallet" width="120">
</p>

<h1 align="center">Chiwawallet</h1>
<p align="center"><strong>Sit. Stay. Save.</strong><br>A budgeting app that plans your money by payday, not by calendar month.</p>

<p align="center">
  <a href="https://chiwawallet.vercel.app/">Live demo</a> ·
  <a href="docs/dev-log.md">Dev log</a> ·
  <a href="#how-ai-was-used">How AI was used</a>
</p>

> **Status:** In development (MVP, Nov 2026 – Jan 2027). Features below are the MVP scope; see the [dev log](docs/dev-log.md) for progress.

---

## Why Chiwawallet?

Most budgeting apps assume you budget once a month. Many Filipino earners are paid **twice a month** (often the 15th and 30th) or **weekly**, and end up tracking money in spreadsheets instead. Chiwawallet plans each payday on its own: what's coming in, which bills that paycheck covers, what goes to savings, and what's **safe to spend** until the next one.

## Features (MVP)

- **Pay-period budgets:** weekly, twice a month or monthly, on your actual pay dates
- **Income sources** tied to the payday they land on, with expected vs. actual
- **Plan ahead:** plan the current or any future payday; recurring items fill in automatically, plus one-off items like gifts or fees
- **One-tap 50/30/20 starter plan** for new users
- **Safe to spend:** cash on hand minus bills, savings and debt payments still due
- **Carry-over:** leftover or overspent money rolls into the next period, with a choice on payday
- **Recurring bills** paid from payday 1, payday 2 or split across both
- **Savings pots** with targets, planned contributions and locked pots (like Pag-IBIG MP2)
- **Debts** with installment schedules and a debt-free date
- **50/30/20 check:** Needs, Wants, and Savings & debt payoff
- **Fast logging:** add an expense in under 10 seconds
- **Installable PWA**, responsive from phone to desktop, with light and dark themes
- **Privacy built in:** export your data as CSV or delete your account at any time

## Screenshots

| Dashboard | Plan | Add transaction |
| --- | --- | --- |
| ![Dashboard](docs/screenshots/dashboard.png) | ![Plan](docs/screenshots/plan.png) | ![Add transaction](docs/screenshots/add-transaction.png) |

## Tech stack

| Layer | Choice |
| --- | --- |
| Framework | Next.js (App Router), TypeScript |
| UI | Tailwind CSS v4, shadcn/ui, Fredoka + Nunito |
| Data and auth | Supabase (Postgres, Auth, Row Level Security) |
| Forms and validation | React Hook Form, Zod |
| Dates | date-fns (Asia/Manila time) |
| Testing | Vitest, Playwright |
| PWA | Web app manifest, Serwist |
| Hosting | Vercel |
| Email and bot protection | Resend (SMTP), Cloudflare Turnstile |

Everything runs on free tiers.

## Getting started

### Prerequisites

- Node.js 22 or later
- A free [Supabase](https://supabase.com) project
- [Docker Desktop](https://www.docker.com/products/docker-desktop/), for local Supabase and the database tests (the Supabase CLI is installed with `npm install`)

### Setup

```bash
git clone https://github.com/[YOUR GITHUB USERNAME]/chiwawallet.git
cd chiwawallet
npm install
cp .env.example .env.local
```

Fill in `.env.local`:

| Variable | Where to find it |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Project Settings → API (the public anon key) |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Cloudflare dashboard → Turnstile |

> Never commit `.env.local` or use the Supabase `service_role` key in this app.

Apply the database schema, then start the dev server:

```bash
npx supabase db push        # applies supabase/migrations
npm run dev                 # http://localhost:3000
```

### Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the local dev server |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | Check TypeScript types |
| `npm run test` | Run unit tests (Vitest) |
| `npm run test:watch` | Re-run unit tests when files change |
| `npm run test:db` | Run database tests (RLS, triggers) against local Supabase |
| `npm run test:e2e` | Run the end-to-end flow (Playwright) |

### Database tests

The RLS and trigger tests run against a local Supabase in Docker, never the live project:

```bash
npx supabase start          # first run downloads the images; applies supabase/migrations
npx supabase status         # shows the local API URL and publishable key
```

Put those two values in `.env.test.local` as `SUPABASE_TEST_URL` and `SUPABASE_TEST_PUBLISHABLE_KEY` (see `.env.example`), then run `npm run test:db`. Stop the containers with `npx supabase stop`.

> **Windows:** run the tests from a path with an uppercase drive letter (`cd C:\path\to\chiwawallet`). From a lowercase `c:\…` path, such as the terminal VS Code sometimes opens, every test file fails with `Cannot read properties of undefined (reading 'config')`.

## Project structure

```
src/
  app/              routes: auth, dashboard, plan, activity, savings, debts, bills, income, settings
  components/       shared UI components (shadcn + app components)
  lib/              money, period and plan logic (pure, tested functions) + Supabase clients
supabase/migrations/  database schema and Row Level Security policies
tests/              unit tests for the money and period logic
docs/dev-log.md     task-by-task build log
CLAUDE.md           rules for the AI coding assistant
```

## How it works

- **Periods:** each period runs from one payday to the day before the next. If a payday doesn't exist in a month (like the 30th in February), the last day of the month is used.
- **Money** is stored as whole centavos to avoid rounding errors, and shown as ₱ with `Intl.NumberFormat('en-PH')`.
- **Security:** every table has Row Level Security, so each account can only ever read and change its own rows.

## How AI was used

This project is also an experiment in building a real product with AI as a pair programmer:

- **Planning:** the product brief, data model and 9-week build plan were refined with Claude.
- **Design:** the logo, design system and every screen were designed with Claude before coding started.
- **Building:** code is written with Claude Code in VS Code, guided by the rules in [`CLAUDE.md`](CLAUDE.md). Claude proposes a plan and waits for approval before changing files; every change is reviewed and tested before it's committed.
- **Honest notes:** each entry in the [dev log](docs/dev-log.md) records what the AI suggested, what I changed, and what it got wrong.

## Roadmap

- [ ] MVP launch (see the 9-week plan)
- [ ] Choose a budgeting model: 50/30/20, 70/20/10, pay-yourself-first or custom
- [ ] Projections: savings by a date, debt-free date across all debts
- [ ] CSV and Excel import
- [ ] AI-powered spending insights

## Privacy

Chiwawallet collects only what it needs to run your budget, never sells data or shows ads, and follows the Philippine Data Privacy Act of 2012. See the Privacy Notice in the app.

## License

**Copyright (c) 2026 Girly Gado. All rights reserved.**

This code is published for portfolio and viewing purposes only. No permission is granted to copy, modify, distribute, or use it, in whole or in part, without written permission from the author. See [LICENSE](LICENSE).

## Contact

Built by **Girly Gado**. [girlygado.dev@gmail.com]
