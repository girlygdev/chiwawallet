# Chiwawallet Settings Spec

Nov 19, 2026 · Girly Gado

Profile, budget setup, categories, reminders, appearance, privacy and the account. Canvas files: `BudgetSettings` and `SettingsDesktop` (on the **Settings** page), plus `ExportData` and `DeleteAccount` (on the **Demo, offline, 404 & legal** page). On mobile, settings are split into pages reached from **More** ([`more-and-categories.md`](more-and-categories.md)); on desktop they're one page with a section menu.

Routes: `/settings` (desktop, one page with anchors), `/settings/budget`, `/settings/export`, `/settings/delete-account`.

## 1. Desktop layout

- **Left:** a sticky section menu (`<nav aria-label="Settings sections">`): Profile, Budget, Categories, Reminders, Appearance, Privacy & data, Account. Each link goes to an anchor (`#profile` and so on), and the section in view gets `aria-current="true"` and the `mint` current style.
- **Right:** one card per section, stacked, each with an h2. Every section saves on its own; there's no single save for the whole page.

| Section | Contents |
| --- | --- |
| Profile | "What should we call you?" (display name) · Email with a "Verified" tag · **Change password** link · "Signed in with email · Google not connected" |
| Budget | The same fields as mobile Budget settings (section 2), with **Cancel** and **Save budget settings** |
| Categories | The three group lists (NEEDS 50% target, WANTS 30% target, SAVINGS & DEBT PAYOFF 20% target) as chips, plus **Manage categories** and **+ New category** links |
| Reminders | Three switches: **Bill and debt reminders** ("2 days before each due date"), **Payday summary** ("How your last period went and what is planned next"), **Mid-period check-in** ("A nudge halfway through each period"). Note: "On iPhone, reminders work after you add Chiwawallet to your home screen." |
| Appearance | Theme: Light, Dark, Match device |
| Privacy & data | **Download CSV** ("Every budget, transaction, pot and debt as CSV files") · the consent line · links to the Privacy Notice and Terms · **Contact us about your data** |
| Account | **Log out** ("On this device only") · **Delete account** ("Permanently removes your account and all budget data. Export first if you want a copy. This can't be undone.") with a destructive button |

- **Consent line:** "You agreed to the Privacy Notice on **Nov 14, 2026**. Your data is only used to run Chiwawallet and is never sold." The date comes from `profiles.consent_at`.
- **Reminder switches** save to `profiles.bill_reminders`, `payday_summary` and `mid_period_checkin` (defaults: on, on, off).
- **Theme** saves to `profiles.theme` (`light` / `dark` / `system`) and applies right away.
- **Contact us about your data** opens an email to the privacy address in the Privacy Notice (`legal.md`).

## 2. Budget settings (mobile page and desktop section)

- **Header (mobile):** a back arrow to More and the h1 "Budget settings".
- **Pay schedule** card:
  - Budget name (text input).
  - "How often you're paid": segmented Weekly, Twice a month, Monthly.
  - 1st payday and 2nd payday selects (they change with the frequency, as in onboarding step 1, `onboarding.md`).
  - "Week starts on": Monday or Sunday.
  - Note: "Changing paydays only affects future periods. Nov 15 – 29 stays as it is."
- **Carry-over** card, two switches:
  - **Carry over leftover money**, "Leftover or overspend rolls into the next period". Saves `budgets.carry_over`.
  - **Ask me on payday**, "Choose to keep, save or pay debt with the leftover". Saves `budgets.ask_on_payday`; it's disabled when carry-over is off.
- **Money split** card:
  - "Budgeting model: 50/30/20 · choose others soon", with a "Soon" tag.
  - The three targets shown read-only: Needs 50%, Wants 30%, Savings & debt 20%.
  - Currency: "Philippine peso · ₱ PHP" (read-only).
- **Button:** **Save changes** (primary). On desktop: **Save budget settings**, plus **Cancel**.

**Changing paydays or frequency:**
- The current period keeps its dates. The new schedule starts at the next payday.
- Future periods that were already created are removed and regenerated, but their one-off and assigned items are moved to the matching new period.
- Show a confirmation first: "Change paydays from Nov 30? 3 future plans will be rebuilt. One-off items move with them."

## 3. Export my data

A bottom sheet on mobile, a dialog on desktop. Title "Export my data", subtitle "A copy of everything in your account, as CSV files you can open in Google Sheets or Excel."

Four checkboxes, all ticked by default:

| Option | Hint | Files |
| --- | --- | --- |
| Transactions | All 14 this period, plus every past period | `transactions.csv` |
| Plans and periods | Planned items, carry-over and paydays | `budget_periods.csv`, `plan_items.csv`, `budgets.csv` |
| Savings, debts, bills, income | With their history | `savings_pots.csv`, `debts.csv`, `recurring_bills.csv`, `income_sources.csv` |
| Profile and settings | Name, email, categories, consent date | `profile.csv`, `categories.csv` |

- **File line:** "chiwawallet-export-2026-11-20.zip · about 40 KB". The date is today in Manila time.
- **Button:** **Download** (hero), disabled when nothing is ticked.
- **Note:** "Your file stays on this device. Keep it somewhere safe; it contains your financial data."
- **How it's built:** a Route Handler that reads only the logged-in user's rows (RLS still applies) and streams a zip.
  - Amounts are pesos with two decimals (centavos ÷ 100).
  - Dates are `YYYY-MM-DD`.
  - The CSVs start with a UTF-8 byte-order mark so Excel shows ₱ correctly.
- This is the DPA data-access right. Keep it working for the demo account too (export only).

## 4. Delete account

A full page on mobile, a dialog on desktop. Level 3 of the delete pattern (`delete-pattern.md`).

- **Header:** a back arrow, plus the mascot faded to greyscale on a light red circle.
- **h1:** "Delete your account?", then "This permanently erases your account and everything in it. It can't be undone."
- **"You'll lose"** list (live counts):
  - "14 transactions and every past period"
  - "3 savings pots (₱67,500 tracked)"
  - "Your bills, debts, income and categories"
- **Reassurance:** "Your real money is not affected. Chiwawallet only stores your records."
- **Export link card:** **Export my data first**, "Recommended · CSV files". It opens Export.
- **"Why are you leaving?" (optional):** a select with "Choose a reason" and a few reasons (Not using it, Too complicated, Switching apps, Privacy, Other).
- **Confirm field:** "Type **DELETE** to confirm", with the hint "The button turns on when it matches." Match in capitals, exactly.
- **Buttons:** **Delete my account forever** (destructive #B42318, disabled until it matches), then **Keep my account** (secondary; focus starts here).
- **Footnote:** "We'll email you a confirmation. Everything is erased within 30 days, including backups."

**What happens:**
1. A server action deletes the auth user, which cascades to every table.
2. Sign the user out everywhere.
3. Send the confirmation email through Resend.
4. Go to the login page with the toast "Your account was deleted."

The demo account can't be deleted: hide the Delete account option for it.

## 5. Accessibility

- [ ] Each settings section is a `<section aria-labelledby>` with its h2. The section menu updates `aria-current` on scroll.
- [ ] Switches have `role="switch"`, and their hints are tied to them with `aria-describedby`.
- [ ] The DELETE field has a visible label. The disabled button explains why with `aria-describedby` pointing to the hint.
- [ ] After saving a section, a toast says "Budget settings saved", and focus stays put.

## 6. Fix before building

1. **Leaving reason vs. privacy:** if you store the "Why are you leaving?" answer after deletion, store it with no user ID or email, and say so: "Saved without your name or email." Or drop the field.
2. **"Erased within 30 days, including backups":** the free Supabase plan has no automatic backups, but your monthly manual exports are backups. Delete the user from those too, or change the line to "Erased right away. Copies in our monthly backups are removed within 30 days."
3. **Reminders promise notifications** the MVP doesn't send (push is v1.1). Until then, label them "Shows on your dashboard", or hide the section.
4. **Mobile Profile and Reminders pages** aren't designed. Reuse the desktop section cards as stacked mobile pages reached from More.
5. **Desktop Categories "Manage categories"** points to `#`. Wire it to the category list (`more-and-categories.md`).
6. **Change email** isn't offered. That's fine for the MVP; say "Contact us to change your email" under the Email field.
