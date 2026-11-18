# Chiwawallet Auth Screens Style Guide

Nov 18, 2026 · Girly Gado

How to build the sign-in screens: log in, sign up, forgot password, check your email and set a new password. This guide adds to [`style-guide.md`](style-guide.md); token names (`green-600`, `line`, `text-3` and so on) come from there. The **Auth screens** page on the [design canvas](https://claude.ai/artifact/Cj6taSLB1R4SoTxvbm8Hnd) shows every screen.

## 1. Screens and flow

| Screen | Canvas file | Route (suggested) | Leads to |
| --- | --- | --- | --- |
| Log in | `AuthLogin`, `AuthLoginDark` | `/login` | Dashboard · Forgot password · Sign up · Demo |
| Sign up (mobile) | `AuthSignUp` | `/signup` | Check your email · Log in |
| Sign up (desktop) | `AuthSignUpDesktop` | `/signup` | Check your email · Log in · Demo |
| Forgot password | `AuthForgotPassword` | `/forgot-password` | Check your email · Log in |
| Check your email | `AuthCheckEmail` | `/check-email` | Email app · Resend · Sign up (wrong email) |
| Set new password | `AuthSetPassword`, `AuthSetPasswordDesktop` | `/reset-password` | Log in |

```
Sign up ──► Check your email ──► (email link) ──► Onboarding
Log in ──► Dashboard
Log in ──► Forgot password ──► Check your email ──► (email link) ──► Set new password ──► Log in
Log in / Sign up ──► Try the demo ──► Demo dashboard
```

Check your email is shared by sign-up and password reset. Only the text changes: "confirm your account" or "reset your password".

## 2. Layout

### Mobile (under 768px)

- Full-screen page on `bg` (#F4FAF6), one column, no bottom navigation.
- Padding: 40px top on screens that start with the logo (Log in, Set password), 32px on Sign up, 20px on screens with a back arrow. 24px left and right, 28px bottom.
- Gap between blocks: 20px (Log in, Forgot password, Check email), 18px (Set password), 16px (Sign up, which has the most fields).
- The footer link ("New here? Create an account") is pushed to the bottom with `margin-top: auto`.
- Designed at 390 × 844px. The page must scroll on short phones; never cut off the main button.

### Desktop (1024px and up)

There are two layouts.

**Split screen** (Sign up). Two halves of `flex: 1 1 520px` that wrap into one column on narrow screens.
- **Left, the pitch:** `mint` background, padding `48px clamp(24px, 5vw, 72px)`. It holds the logo and wordmark, a big headline ("Budget by payday, not by month."), one paragraph, three feature rows with 40px white icon tiles, and an example Safe to spend card pinned to the bottom with a sticker border and 6px shadow.
- **Right, the form:** white background, form centered, max 420px wide.

**Centered card** (Set new password). `mint` page, logo and wordmark on top, then one white card, max 460px wide, 24px radius, 32px padding, sticker border with a 6px shadow. The "Back to log in" link sits under the card.

Use the split screen for Log in and Sign up, and the centered card for Forgot password, Check your email and Set new password.

## 3. Building blocks

### Header

| Variant | Used on | Spec |
| --- | --- | --- |
| Centered logo | Log in, Set password | Logo 88px (or 76px on a 96px `mint` tile with 28px radius), Fredoka 600 title 28–30px, one-line subtitle in Nunito 15px `text-3` |
| Side-by-side logo | Sign up (mobile) | Logo 64px next to a 26px title and a 14px subtitle, to save height for the form |
| Mascot on mint | Forgot password, Check email | Logo on a `mint` tile (112px, 32px radius) or circle (168px). Check email adds a 52px white badge with a mail icon and a 3px ink border |
| Back arrow | Forgot password, Check email | 44 × 44px tap area at the top left, 24px chevron, `aria-label="Back to log in"` |

Titles: "Welcome back", "Create your account", "Forgot your password?", "Check your email", "Set a new password".

### Google button

- 50–52px tall, white, 1.5px `line` border, 14px radius, ink text at 16px weight 700, icon and label centered with a 10px gap.
- Labels: **Continue with Google** (Log in) and **Sign up with Google** (Sign up).
- It always sits above the email form, followed by a divider.
- The canvas uses a placeholder icon. In code, use Google's official "G" logo and follow [Google's sign-in branding guidelines](https://developers.google.com/identity/branding-guidelines).

### "or" divider

Two 1px `line` rules with the text between them: Nunito 13px weight 600, `text-3`, 12px gap. It says "or" on Log in and "or use email" on Sign up.

### Fields

- Label above the field, Nunito 14px weight 700, with a 6px gap. Fields are 12–14px apart.
- Input: 50–52px tall, 14px radius, 1.5px `line` border, white, 16px padding, Nunito 16px (keeps iPhones from zooming in).
- Focused: a 2px `green-600` border. Placeholder text: #7A8A80.
- **Password fields** have a show/hide eye button inside the right edge: a 44px tap area, a 22px `text-3` icon, and `aria-label` set to "Show password" or "Hide password". Leave 52px right padding in the input so text doesn't run under it.
- **"Forgot password?"** is a text link on the same line as the Password label, aligned right, 14px weight 700.
- **Hints** go under the field in 13px `text-3` and are tied to it with `aria-describedby`. Example: "At least 8 characters, with a number."

| Field | `type` | `autocomplete` | Label |
| --- | --- | --- | --- |
| Name | `text` | `nickname` | What should we call you? |
| Email | `email` | `email` | Email |
| Password (log in) | `password` | `current-password` | Password |
| Password (sign up, reset) | `password` | `new-password` | Password / New password |
| Confirm password | `password` | `new-password` | Confirm new password |

### Password strength (Set new password)

A `mint` panel with a 14px radius and `12px 14px` padding, placed between the two password fields.
- **Top line:** "Password strength" on the left and the level on the right ("Weak", "Okay", "Strong"), both 13px weight 800.
- **Meter:** four 6px pill segments with 4px gaps, filled in `green-500` up to the current level.
- **Checklist:** "At least 8 characters", "Includes a number", "Not the same as your old password". Each rule gets an 18px circle that turns `green-500` with a white tick when met. Text is 13px weight 700 in Forest.
- **Match message** under Confirm: `green-600` tick plus "Passwords match", and the field border turns 2px `green-600`.

### Consent checkbox (Sign up only)

- A 20–22px checkbox with `accent-color: #177A42`, aligned to the top of the label, 10px gap.
- Label (13–14px, line height 1.45): "I agree to the **Privacy Notice** and **Terms**. My budget data is used only to run Chiwawallet and is never sold." The two links are weight 700.
- Leave it **unticked by default**. Keep Create account disabled until it's ticked, and save `profiles.consent_at` when the account is created. This is your DPA consent record.

### Turnstile box

- A box with a 12px radius, 1px `line` border and white background, 56–60px tall: a 24px `green-500` tick circle, "You're verified" (14px weight 700), and "Turnstile bot check" at the right (11px `text-3`).
- On Log in, Sign up and Forgot password, placed right above the main button.
- The canvas shows the passed state. In code this is Cloudflare's own widget, so it will look like theirs. Keep it in the same spot, and set its theme to match light or dark mode.

### Buttons

| Button | Spec | Used for |
| --- | --- | --- |
| Primary | 54px, `green-600`, white Nunito 17px weight 800, 14px radius, no border | Log in, Create account, Send reset link, Open email app, Save new password |
| Demo | 48px, `mint` fill, 1.5px dashed `line-dash` border, Forest 15px weight 700 | "Just looking? Try the demo" (Log in only) |
| Secondary | 50px, white, 1.5px `line` border | Resend link |
| Text link | `green-600`, weight 800, no underline | Create an account, Log in, Back to log in, Change it |

- Auth screens use the flat **primary** button, not the sticker hero button. On desktop the sticker goes on the card instead.
- **Resend link** stays disabled with a countdown ("Resend link in 0:45", `text-3` text), then turns on as "Resend link".
- While a request is running, keep the button's width, show a spinner and change the label ("Logging in…"), and block double taps.

### Notes and footer

- **Heads-up note** (Check email): yellow `#FFF6D6` with `#5C4600` text, 12px radius, 13px weight 600. "Can't find it? Check your Spam or Promotions folder."
- **Footer** (Log in): "New here? **Create an account**" at 15px, then "Privacy Notice · Terms" at 12px in `text-3`.
- **Expiry line** (Set password): "This link expires in 1 hour." at 13px `text-3`, pinned to the bottom.
- **Log out on other devices** (Set password): a checkbox, **ticked by default**.

## 4. Dark mode

`AuthLoginDark` is the reference. Every other auth screen follows the same swaps:

| Element | Light | Dark |
| --- | --- | --- |
| Page | #F4FAF6 | #0F1A14 |
| Inputs, Google button, Turnstile box | #FFFFFF, border #D5E3DA | #17261D, border #2C3F33 |
| Title | #1C1C1E | #FFFFFF |
| Body text | #1C1C1E | #EAF2EC |
| Subtitle, hints, icons | #55645B | #A7BDB0 |
| Focused input | 2px #177A42 | #5DD68F |
| Primary button | #177A42, white text | #2FBF6E, #0B1A11 text |
| Demo button | #E8F6EE, dashed #9CC9AE, #0F5E34 text | #15301F, dashed #2F6B47, #8EE3B0 text |
| Links | #177A42 (hover #0F5E34) | #5DD68F (hover #8EE3B0) |
| Turnstile tick | #1F9D55 | #2FBF6E with a #0B1A11 tick |
| Logo | As is | On a 96px `mint` circle so its black outlines show |

## 5. Words

Keep the copy short and friendly, and say what happens next.

| Spot | Copy |
| --- | --- |
| Log in subtitle | Log in to plan your next payday. |
| Sign up subtitle | Budget by payday. Free, no card needed. (Desktop: Free, no card needed. Takes about a minute.) |
| Forgot password | No worries. Enter the email you signed up with and we'll send you a link to reset it. |
| Check email | We sent a link to **you@example.com**. Tap it to confirm your account. It expires in 1 hour. |
| Desktop pitch | Budget by payday, not by month. Plan every 15th and 30th, pay bills from the right paycheck, and watch your savings grow. Sit. Stay. Save. |
| Demo | Just looking? Try the demo |

Always show the email the user typed, in bold, on Check email and Set new password, so they can spot a typo.

### Error messages (not on the canvas yet)

The canvas only shows the happy path. Build errors this way:

- **Field error:** the border turns 2px #B42318, and a 13px weight 700 message in #9B2C2C with a small alert icon appears under the field, linked with `aria-describedby` and `aria-invalid="true"`.
- **Form error** (for example a wrong password): a box above the main button with `#FBEBEB` background, `#9B2C2C` text and a 12px radius, announced with `role="alert"`.
- **Wording:**
  - Wrong password: "That email and password don't match. Try again or reset your password." Never say which of the two was wrong.
  - Link expired: "This link has expired. We can send you a new one."
  - Too many tries: "Too many tries. Wait a minute, then try again."
- **Never reveal whether an email has an account** (decided Nov 18, 2026). On Sign up, an email that's already registered goes to Check your email like any new sign-up, with no "already an account" message. Resend link also reports success for it. On Forgot password, always show Check your email, even if no account uses that email.

## 6. Accessibility

- [ ] One `<h1>` per screen (the title). On desktop Sign up, the pitch headline is an `<h2>`.
- [ ] Every input has a visible `<label for>`; placeholders are examples only, never the label.
- [ ] The eye button switches its `aria-label` between "Show password" and "Hide password" and has `aria-pressed`.
- [ ] Back arrows and icon buttons have an `aria-label` and a 44px tap area.
- [ ] Decorative mascots use `alt=""`. A logo that is the only brand name on the screen uses `alt="Chiwawallet"`.
- [ ] The password checklist and "Passwords match" sit in an `aria-live="polite"` region.
- [ ] The Resend countdown doesn't announce every second. Announce only when the button becomes available.
- [ ] After a failed submit, move focus to the first field with an error.
- [ ] Use a real `<form>` with `type="submit"` so Enter submits and password managers work.

## 7. Behavior (Supabase Auth)

| Rule | Setting |
| --- | --- |
| Email confirmation required before first login | Supabase Auth: Confirm email on |
| Confirmation and reset links expire in 1 hour | Supabase Auth email link expiry: 3600s; must match the screen text |
| Resend cooldown 45 seconds | Client timer; Supabase also limits how often emails can be sent |
| Password: at least 8 characters with a number | Supabase password rules plus the same Zod schema in the form |
| Bot check on sign up, log in and forgot password | Turnstile through Supabase Auth's CAPTCHA setting |
| Demo account | "Try the demo" logs in to the seeded demo account; that account can't change its email or password |
| After sign-up confirmation | Go to onboarding, not the dashboard |
| After password reset | Sign out other sessions if the box is ticked, then go to Log in |

## 8. Fix before building

Small differences between screens on the canvas. Settle these in code:

1. **Field and button heights:** Sign up uses 50px fields and Google button, Log in uses 52px. Pick **52px** everywhere.
2. **Checkbox size:** 22px on mobile Sign up, 20px elsewhere. Use **22px**.
3. **Demo link element:** a link in light Log in, a `<button>` in dark. It goes somewhere, so use a **link** (`<a>`).
4. **Placeholder links:** the Privacy Notice and Terms links in the Log in footer point to `#`. Point them to `/privacy` and `/terms`.
5. **Example card on desktop Sign up:** it says "Available to spend" and "NOV 16–30". Change it to **Safe to spend** and **Nov 15 – 29** to match the dashboard and the style guide's words.
6. **One-off colors:** the consent label (#2E3A33) and the footer dot (#8A988F) aren't tokens. Use `text-2` and `text-3`.
7. **Desktop Log in and Forgot password** aren't on the canvas. Build them from the split screen and centered card layouts above.
