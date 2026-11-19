# Chiwawallet Docs

Nov 19, 2026 · Girly Gado

Start with the brief and the style guide, then open the spec for the page you're building. Each page spec ends with a **Fix before building** list of things the canvas leaves open.

## Foundations

| File | What's in it |
| --- | --- |
| [`mvp-brief.md`](../mvp-brief.md) | Scope, risks, stack, data model, 9-week build plan |
| [`style-guide.md`](style-guide.md) | Colours, type, spacing, components, voice, accessibility, Tailwind tokens |
| [`app-shell.md`](app-shell.md) | Bottom bar, sidebar, page header, period switcher |
| [`brand.md`](brand.md) | Logo lockups, app icons, favicon, manifest |
| [`delete-pattern.md`](delete-pattern.md) | The three delete levels and their rules |

## Pages

| File | Screens | Build week |
| --- | --- | --- |
| [`auth-screens.md`](auth-screens.md) | Log in, sign up, forgot password, check email, set password | 1, 8 |
| [`onboarding.md`](onboarding.md) | Budget, income, starting point, all set | 2 |
| [`dashboard.md`](dashboard.md) | Home, first-day state, 50/30/20 check | 2–7 |
| [`activity.md`](activity.md) | Transaction list, add expense/income/savings, category picker | 3 |
| [`more-and-categories.md`](more-and-categories.md) | Mobile More hub, new category, default categories | 3 |
| [`bills.md`](bills.md) | Bills list, new bill, mark paid | 4 |
| [`savings.md`](savings.md) | Savings pots, new pot, locked pots | 4, 7 |
| [`debts.md`](debts.md) | Debts, payment schedule, new debt | 4, 7 |
| [`income.md`](income.md) | Income sources, new source | 2 |
| [`plan.md`](plan.md) | Plan, starter plan, one-off items, give leftover a job | 5–6 |
| [`payday-rollover.md`](payday-rollover.md) | Closing a period and opening the next | 6 |
| [`settings.md`](settings.md) | Settings, budget settings, export, delete account | 8 |
| [`system-pages.md`](system-pages.md) | Demo mode, offline, 404, error | 8–9 |
| [`legal.md`](legal.md) | Privacy Notice and Terms | 8 |

## Sample data used in the specs

Every example number comes from the canvas, and they all agree:

- **Budget:** twice a month, on the 15th and 30th. Today is Nov 20, in the Nov 15 – 29 period.
- **Income:** Main job ₱25,000 every payday; Freelance ₱8,000 on the 30th.
- **This period:** ₱25,000 income + ₱5,000 carried in = ₱30,000. Planned ₱21,200; not assigned ₱8,800.
- **Out so far:** ₱9,450 (₱6,450 spending incl. ₱1,700 bills, + ₱3,000 to savings).
- **Safe to spend:** ₱20,550 cash − ₱7,000 still due = ₱13,550.
- **Pots:** Emergency ₱13,000 of ₱30,000; Travel ₱6,000 of ₱20,000; MP2 ₱48,500 (locked).
- **Debt:** SPayLater ₱12,000 in 3 × ₱4,000; ₱8,000 left.
- **Bills:** Internet ₱1,700 (15th), Subscriptions ₱1,000 (22nd, from the 15th), Electricity ₱2,500 (30th).
- **Next period:** Nov 30 – Dec 14: ₱33,000 + ₱9,200 carried in = ₱42,200.

These make good Vitest fixtures: if the functions reproduce these numbers, they match the designs.
