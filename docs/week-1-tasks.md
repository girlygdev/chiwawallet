# Week 1 tasks

The Week 1 checklist in `mvp-brief.md` broken into one-session tasks. Tick tasks here as they're done; tick the brief's checkbox when its whole group is done.

**Week 1 is done when:** you can sign up on the live URL and land on an empty dashboard.

## Done

- [x] Create the Next.js app, push to GitHub, connect to Vercel
- [x] Create the Supabase project; add `.env.local`, `.env.example` and Vercel env vars

## Supabase Auth: login, sign-up and logout pages

Built from `docs/designs/auth-screens.md`, which adds forgot password, check your email and set new password to the original task.

- [x] **3a. Supabase clients.** Install `@supabase/supabase-js` and `@supabase/ssr`. Add `src/lib/supabase/client.ts` (browser) and `src/lib/supabase/server.ts` (server, reads the session cookie).
  Done when: a temporary server call to Supabase runs locally without errors.
- [x] **3b. Auth building blocks and the Log in screen (UI only).** Shared pieces in `src/components/auth/`: split-screen layout (the centered-card layout moved to 3c, where Check your email first uses it), field with label, hint and error, password field with show/hide button, Google button with the official "G", "or" divider, submit button with spinner, form error box. Log in page at `/login`, mobile and desktop, light and dark. No Supabase calls yet.
  Done when: `/login` matches the canvas at 390px and 1024px+, in both themes.
- [x] **3c. Sign up and Check your email.** *(Owner signed up with a real email on Nov 18 and reached the dashboard.)* Install `zod`, `react-hook-form`, `@hookform/resolvers`. Schema in `src/lib/validation/auth.ts`, Server Action, consent checkbox, `/signup`, `/check-email` with the 45-second Resend timer, `/auth/confirm` route for the email link.
  Done when: you can sign up on localhost, confirm by email and land in the app.
- [x] **3d. Log in and log out.** *(Owner tested Nov 18.)* Wire `/login` to Supabase with the error wording from the design doc. Log out button on the dashboard placeholder.
  Done when: log in, log out and log in again work on the live URL.
- [x] **3e. Forgot password and Set new password.** *(Owner tested Nov 18, including reusing the old password.)* `/forgot-password` (always shows Check your email), `/reset-password` with the strength panel, "Passwords match" and "Log out on other devices".
  Done when: a reset email link lets you set a new password and log in with it.
- [x] **3f. Google sign-in.** *(Owner set up the Google OAuth client and tested on Nov 18.)* Owner creates the Google Cloud OAuth client and enables the provider in Supabase. Code adds the buttons' action and an `/auth/callback` route.
  Done when: Google sign-in works on the live URL.

## Rest of Week 1

- [x] **Proxy** (Next.js 16 renamed `middleware.ts` to `proxy.ts`): refresh the Supabase session and redirect logged-out users away from app pages. *(Logged-out redirects checked Nov 19; owner tested the logged-in cases Nov 19.)*
- [x] **Set up Vitest** (decided Nov 19): add `npm run test` before the `profiles` table, so its RLS test has somewhere to run.
- [ ] **`profiles` table** with RLS (own `id`, unique `user_id`), created on sign-up. Copies display name and consent time from the sign-up data. Split Nov 19:
  - [x] **Part 1. Table, trigger and RLS tests on local Supabase.** Migration (including `consent_version`), column permissions, 20 database tests, generated types.
  - [ ] **Apply the migration to the live project** (`supabase login`, `link`, `db push`; owner runs or approves).
  - [ ] **Part 2. App reads and writes `profiles`.** The consent step records `consent_at` (users can't write it directly, so this needs a database function or a trigger on the user's metadata); the dashboard greeting reads `display_name`; the Supabase clients use the generated types. Sign-up and the consent step send `consent_version` (a constant shared with the legal pages' "Last updated" date), and the consent text adds "I'm 18 or older" (decided Nov 19, plan review 1.2).
- [ ] **App shell:** bottom nav on mobile, sidebar on desktop.

## Moved to later weeks

Decided Nov 18, 2026:

- Turnstile on sign-up, log in and forgot password: Week 8. The forms leave its spot above the main button.
- "Try the demo" button: hidden until Week 8, when the demo account exists.
- Privacy Notice and Terms: real pages in Week 8. `/privacy` and `/terms` show a "This feature will come to you soon." placeholder now.
- After sign-up confirmation: go to the dashboard until onboarding is built.

Decided Nov 19, 2026:

- Return to the original page after logging in (`?next=`, with safe-redirect checks): its own small task once there are more app pages than the dashboard.

## Decisions

- The `profiles` RLS test (user A can't read user B's rows) runs against local Supabase (`supabase start`), not the hosted project (decided Nov 19). Needs Docker Desktop and the Supabase CLI.
- `profiles` follows CLAUDE.md: its own `id` plus a unique `user_id` (= auth user). The brief's data model was updated to match.
- The consent checkbox is on sign-up now (per the design doc). Its time is saved with the Supabase user at sign-up, and the `profiles` task copies it to `profiles.consent_at`.
