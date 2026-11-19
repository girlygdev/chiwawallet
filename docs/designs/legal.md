# Chiwawallet Privacy Notice & Terms Spec

Nov 19, 2026 · Girly Gado

How the two legal pages look and work. The wording itself lives on the canvas (`Privacy`, `PrivacyDesktop`, `Terms`, `TermsDesktop`, on the **Demo, offline, 404 & legal** page). It's a plain-language draft based on the Data Privacy Act (RA 10173). **Fill in the [YOUR NAME] and [PRIVACY EMAIL] placeholders and have a lawyer review both pages before public launch.**

Routes: `/privacy` and `/terms`. They're public (no login needed), because sign-up links to them.

## 1. Layout

### Mobile

- **Header:** a back arrow, the h1 ("Privacy Notice" or "Terms of Use"), and "Last updated Nov 14, 2026" (`text-3`).
- **"The short version"** card (the mascot plus 4 bullet points) at the top, so people get the gist in 10 seconds.
- **Numbered sections** as `<details>` accordions, closed by default. Each `<summary>` is the numbered title ("1. Who we are"). Use a 44px minimum height and a chevron that turns when open.

### Desktop

- **Top bar:** the logo and wordmark (linking to the dashboard, or to Log in when logged out), plus a `<nav aria-label="Legal">` switching between Privacy Notice and Terms of Use (`aria-current="page"` on the open one).
- **Left:** a sticky "ON THIS PAGE" list of anchor links to each section (`#who`, `#collect`… / `#accept`, `#what`…).
- **Right:** the h1, the short version card, then every section open (no accordions), each a `<section id>` with an h2. Text width about 720px.

## 2. Sections

| Privacy Notice | Anchor | Terms of Use | Anchor |
| --- | --- | --- | --- |
| 1. Who we are | `#who` | 1. Using Chiwawallet | `#accept` |
| 2. What we collect | `#collect` | 2. What Chiwawallet is | `#what` |
| 3. Why we use it | `#why` | 3. Your account | `#account` |
| 4. Legal basis | `#basis` | 4. Your data | `#data` |
| 5. Where it is stored and who helps | `#where` | 5. Fair use | `#use` |
| 6. How long we keep it | `#keep` | 6. A free service, as is | `#free` |
| 7. Your rights | `#rights` | 7. Limits of responsibility | `#liability` |
| 8. How we protect it | `#security` | 8. Closing your account | `#ending` |
| 9. Changes to this notice | `#changes` | 9. Changes and governing law | `#law` |

**Short versions:**
- **Privacy:** We only collect what the app needs to work. · We never sell your data or show ads. · You can export or delete everything, any time. · We follow the Data Privacy Act of 2012.
- **Terms:** Chiwawallet is free and is not a bank or financial adviser. · Your data is yours. Export or delete it any time. · Keep your account to yourself and use it fairly. · Philippine law applies.

## 3. Keep the pages true

These pages make promises the code must keep. Check each one before launch:

| Promise | Where it's kept |
| --- | --- |
| Only email, name, password hash, budget data, consent date and security logs are collected | Data model; no extra fields |
| Providers: Supabase, Vercel, Resend, Cloudflare Turnstile | Update this list if you add any (for example analytics) |
| Only the developer can access account data, for support, fixes or the law | No admin panel; Supabase dashboard access only for you |
| Deleted transactions are gone after 30 days | The daily purge job (`delete-pattern.md`) |
| Account data is erased within 30 days, including backups | Account deletion plus cleaning your monthly manual backups (`settings.md`) |
| Export and Delete account are in Settings | `settings.md` |
| Replies within 15 days | Your inbox |
| Breach notice within 72 hours | Your one-page breach plan |
| At least 18 years old (Terms 1) | Add an "I'm 18 or older" line to the sign-up consent text |
| Demo resets every Sunday (Terms 5) | The demo cron (`system-pages.md`) |
| 30 days' notice before shutting down (Terms 6) | Your promise |
| Changes announced in the app before they take effect | A dismissible banner, plus new consent if the change matters |

## 4. Consent and versioning

- Sign-up stores `profiles.consent_at`. Store the notice version too (for example `consent_version = '2026-11-14'`), so you know which text each person agreed to.
- When the notice changes in a way that matters, show the new short version on next login with **I agree** and update both fields.
- The "Last updated" date comes from the same version constant.

## 5. Accessibility

- [ ] `<details>`/`<summary>` are used as-is (they're accessible by default). Don't rebuild them with divs.
- [ ] Anchor links move focus to the section heading.
- [ ] Body text is at least 15px with a line height of 1.6, and lines are no wider than about 75 characters.

## 6. Fix before building

1. **Placeholders:** fill in [YOUR NAME] and [PRIVACY EMAIL].
2. **Age:** the Terms say "at least 18", but sign-up doesn't ask. Add "I'm 18 or older" to the consent checkbox text (`auth-screens.md`).
3. **Reminders:** Privacy section 3 mentions reminder emails, which the MVP doesn't send. Remove "and reminders" until they exist.
4. **Lawyer review** before public sign-ups open.
