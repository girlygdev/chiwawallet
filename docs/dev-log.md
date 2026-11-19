# Dev log

Newest entry first.

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
