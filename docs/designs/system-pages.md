# Chiwawallet Demo, Offline & 404 Spec

Nov 19, 2026 · Girly Gado

The pages and banners outside the normal flow: demo mode, offline, and page not found. Canvas files: `DemoDashboard`, `DemoDashboardDesktop`, `Offline`, `OfflineDesktop`, `NotFound` and `NotFoundDesktop` (on the **Demo, offline, 404 & legal** page).

## 1. Demo mode

The shared demo account lets reviewers try the app without signing up (the **Try the demo** button on Log in and Sign up, `auth-screens.md`).

### Banner

A strip above everything else on every page while logged in as the demo account: `role="status"`, yellow #FFF6D6, a 2px ink bottom border, `10px 12px` padding.

| | Mobile | Desktop |
| --- | --- | --- |
| Tag | Ink pill, gold text: "DEMO" (11px weight 800, 0.5px letter spacing) | "DEMO MODE" (12px) |
| Text | "Sample data. Resets every Sunday." (12px) | "You're exploring Chiwawallet with sample data. Feel free to click anything; it all resets every Sunday. Please don't enter real information." |
| Buttons | **Sign up free** (36px, `green-500`, white text) | **Exit demo** (40px, outline in #5C4600) and **Sign up free** (40px, `green-500`) |

- The banner can't be dismissed. On mobile, add **Exit demo** to More (above Log out).
- **Exit demo** logs out and goes to Log in. **Sign up free** logs out and goes to Sign up.

### Demo account

- **Name:** "Juan (demo)" in the mobile greeting. On desktop, "Juan" with "Demo account" under it in the sidebar profile chip.
- **Data:** the same sample budget as the canvas (twice a month, 15th and 30th, Main job + Freelance, Emergency/Travel/MP2, SPayLater…), built from a made-up version of your real plan. Never your real numbers.
- **Seeding:** a script, `scripts/seed-demo.ts`, rebuilds the demo account every Sunday at 00:00 Manila time (GitHub Actions cron). The seed dates shift so the "current period" always has realistic data.
- **Blocked for the demo account:** changing the email or password, deleting the account, and connecting Google. Hide those controls and enforce it on the server (`profiles.is_demo = true`), not only in the UI.
- **Allowed:** everything else, including deletes and exports. They're temporary.
- **Demo login:** the **Try the demo** button calls a server action that signs in with the demo credentials stored as server-only env vars. The password is never sent to the browser.

## 2. Offline

Shown by the service worker (Serwist) when a page can't load, and as a banner when the connection drops while the app is open.

### Offline page

- Centered on `bg`: the mascot at 132px on a 168px `mint` circle, greyed out (`filter: grayscale(0.7)`), with a 52px white badge (3px ink border) holding a crossed-out Wi-Fi icon.
- **h1:** "You're offline" (Fredoka 30px).
- **Text:** "Chiwawallet needs internet to save and sync your budget. We're showing what was saved at 2:15 PM." The time is the last successful sync, in Manila time.
- **Heads-up note** (yellow): "You can still look around. Adding or editing waits until you're back online."
- **Buttons:**
  - **Try again** (hero sticker, 52px): reloads.
  - **See saved dashboard** (secondary): opens the cached dashboard.
- **Desktop:** the same content, centered, with the buttons side by side.

### Rules

- The MVP doesn't save changes offline (offline logging is v1.1).
- While offline, disable Save buttons and show a heads-up line: "You're offline. This will be saved when you're back." Or simply: "Can't save while offline."
- Cache the app shell and the last-viewed Dashboard, Plan and Activity pages, so "See saved dashboard" works.
- When the connection comes back, show a toast, "Back online", and refresh the data.

## 3. Page not found (404)

`app/not-found.tsx`.

- The mascot at 132px on a 168px `mint` circle, tilted about 8° (`rotate(-8deg)`), with a 52px yellow badge (#FFF6D6, 3px ink border) holding a "?" in Fredoka 26px (#5C4600).
- **h1:** "This page ran off" (Fredoka 30px).
- **Text:** "Even the best-trained chihuahua wanders sometimes. The page you're looking for doesn't exist or has moved."
- **Small caps line:** "ERROR 404 · SIT. STAY. ... LOST?" (`text-3`).
- **Buttons:** **Go to dashboard** (hero), **Go back** (secondary; `history.back()`, or the dashboard if there's no history).
- **Logged out:** "Go to dashboard" becomes "Go to log in".

Also add a general error page (`app/error.tsx`) in the same style:
- **h1:** "Something went wrong"
- **Text:** "It's not you. Try again, and if it keeps happening, email us."
- **Buttons:** **Try again**, **Go to dashboard**.
- Never show error codes or stack traces to users.

## 4. Accessibility

- [ ] The demo banner is `role="status"`, so it's announced once, not on every page.
- [ ] Offline and 404 pages have one h1, and the mascot is decorative (`alt=""`).
- [ ] The "Back online" toast is `role="status"`.

## 5. Fix before building

1. **Placeholder links:** "Try again" and "Go back" point to `#`. Wire them to a reload and `history.back()`.
2. **Mobile has no Exit demo.** Add it to More, as in section 1.
3. **"Resets every Sunday"** must match the cron schedule and the Terms (`legal.md`).
