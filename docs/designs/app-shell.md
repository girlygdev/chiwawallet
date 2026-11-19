# Chiwawallet App Shell Spec

Nov 19, 2026 · Girly Gado

The frame around every logged-in screen: the mobile bottom bar, the desktop sidebar and the page header. Page specs (`dashboard.md`, `plan.md` and so on) only describe what goes inside this frame. Token names come from [`style-guide.md`](style-guide.md).

## 1. Mobile bottom bar (under 768px)

- 84px tall, white, with a 1px `line` top border, fixed to the bottom and padded for the iPhone home bar (`env(safe-area-inset-bottom)`).
- Five equal columns: **Home**, **Plan**, the raised **+** button, **Activity**, **More**.
- Each tab: a 24px icon above an 11px label, with a 44px minimum tap area.

| State | Label | Icon |
| --- | --- | --- |
| Current | `green-600`, weight 800, `aria-current="page"` | `green-600` |
| Other | `text-3`, weight 700 | `text-3` |

- **+ button:** 62px circle, `green-500`, 3px `ink` border, `3px 3px 0` ink sticker shadow, raised so its top half sits above the bar. White 26px plus icon, `aria-label="Add transaction"`. It opens the Add transaction sheet (`activity.md`).
- Page content gets bottom padding equal to the bar's height, so the last row is never hidden.
- Sheets and full-screen forms (add, edit, onboarding, delete) hide the bar.

## 2. Desktop sidebar (768px and up)

- A white column (`flex: 1 1 240px`, 24px × 16px padding), full height, with the page beside it (`flex: 999 1 640px`). On narrow screens the sidebar stacks on top.
- **Top:** a 40px logo plus the "Chiwa**wallet**" wordmark (Fredoka 600, 22px; "wallet" in `green-600`).
- **Main links:** Dashboard, Plan, Transactions, Income, Bills, Savings, Debts. Each is 44px tall with `0 12px` padding, a 12px radius, a 20px icon and 15px text.
  - Current: `mint` background, Forest text, weight 800, `aria-current="page"`.
  - Other: `text-2`, weight 700. Hover: `bg` background.
- **Bottom:** Settings (same link style), then a profile chip (`bg` fill, 12px radius, `10px 12px` padding) with a 32px initial circle, the display name and the budget name.
- Desktop has no + tab. Every page header has its own **Add transaction** button instead.

Mobile "Activity" and desktop "Transactions" are the same page. Mobile reaches Income, Bills, Savings, Debts and Settings through **More** (`more-and-categories.md`).

## 3. Page header

### Mobile

- 52px row: a 40px logo, a greeting ("Good afternoon," on one line, the name in Fredoka 20px below), and a 44px bell button on the right (white, 1.5px `line` border, 14px radius).
- The bell gets a 9px dot when something is due within 3 days, and its `aria-label` says so: "Notifications, 2 bills due soon". The dot on the canvas is #E0533D; use `danger` (#B42318) instead.
- Sub-pages (Savings, Bills and so on) replace this with a 44px back arrow and a Fredoka page title.

### Desktop

- Left: a 14px `text-3` greeting line ("Good afternoon, Reggie"), then the page title in Fredoka 600, 30px.
- Middle: the **period switcher** (below).
- Right: the **Add transaction** sticker button: 50px, `green-500`, 2px ink border, `3px 3px 0` shadow, white 15px weight 800 text with a plus icon.
- The row wraps on narrow screens.

### Greeting

By Manila time: "Good morning" (until 11:59), "Good afternoon" (12:00–17:59), "Good evening" (18:00 on). Use `profiles.display_name`.

## 4. Period switcher

Used on Dashboard and Plan.

- A previous arrow, the period dates, and a next arrow. Arrows are 44px on mobile and 40px on desktop, transparent, with `aria-label` "Previous period" and "Next period".
- **Line 1:** the dates in Fredoka (for example "Nov 15 – 29").
- **Line 2** in 13px `text-3`: the payday and the time left ("15th payday · 10 days left"). Future periods say "Starts Nov 30"; past periods say "Ended Nov 14".
- Moving to a future period opens that period's plan, creating it if needed. Moving to the past shows the closed period read-only.

## 5. Shared rules

- **Page background:** `bg`. Content max width about 1100px on desktop.
- **Section heading row:** an `<h2>` (17px weight 800) on the left and a text link on the right ("See all", "Open plan", "Manage"), 14px weight 800 in `green-600`.
- **Cards:** white, 1.5px `line` border, 18px radius on mobile and 20px on desktop.
- **Loading:** grey `track` skeleton blocks the size of the real content, never a full-page spinner.
- **Demo account:** a demo banner sits above the header on every page (`system-pages.md`).
