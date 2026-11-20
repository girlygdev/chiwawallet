# Chiwawallet Design Style Guide

Nov 17, 2026 · Girly Gado

The rules behind every Chiwawallet screen: friendly green, chunky black outlines, money shown plainly. Use this when building or adding screens; the [design canvas](https://claude.ai/artifact/Cj6taSLB1R4SoTxvbm8Hnd) shows every rule in action.

## 1. Principles

Chiwawallet should feel like a loyal little dog that is good with money: warm and a bit playful, never childish, always clear about the numbers.

1. **Money first, decoration second.** The most important number on a screen (Safe to spend, amount, total) is the biggest thing on it.
2. **Show the effect before the action.** Before saving or deleting, say what changes in pesos: "Food budget: ₱2,580 left after this."
3. **One loud thing per area.** The black "sticker" outline and offset shadow mark only the hero card or main action. Everything else stays calm.
4. **Everything follows the payday.** Periods, plans and totals are always framed by payday ("Nov 15 – 29"), never by calendar month.
5. **Friendly, never scary.** Empty states and errors use the chihuahua and plain words. Red appears only when something is deleted or genuinely wrong.

## 2. Color

Green means money and progress, ink black gives the sticker look, and everything else is soft background. Use the token names in code, never raw hex.

### Brand and text

| Token | Hex | Use |
| --- | --- | --- |
| `green-500` Wallet Green | #1F9D55 | Brand, + button, progress fills, check marks |
| `green-600` Action Green | #177A42 | Primary buttons and links (white text passes 4.5:1) |
| `green-700` Deep Green | #157A41 | Hero cards, selected period, Needs in charts |
| `green-800` Forest | #0F5E34 | Text on mint, link hover |
| `ink` | #1C1C1E | Body text (turns light in dark mode) |
| `sticker` | #1C1C1E | Sticker outlines and shadows (mid mint #7FD3A3 in dark mode) |
| `text-2` | #3E4C44 | Secondary text, labels in lists |
| `text-3` | #55645B | Hints, captions, dates (smallest allowed grey) |
| `gold` Coin Gold | #F4C430 | Accent only: clasp, progress on green, Wants in charts |

### Surfaces and lines

| Token | Hex | Use |
| --- | --- | --- |
| `bg` | #F4FAF6 | App background |
| `surface` | #FFFFFF | Cards, sheets, inputs |
| `mint` | #E8F6EE | Selected states, soft buttons, positive notes |
| `line` | #D5E3DA | Default borders (1.5px) |
| `line-soft` | #E3EAE6 | Dividers inside cards |
| `line-dash` | #9CC9AE | Dashed borders for add and empty states |
| `track` | #E3EDE7 | Segmented controls, unassigned bar segments |

### Status

| State | Background | Text | Use |
| --- | --- | --- | --- |
| Positive | #E8F6EE | #0F5E34 | Paid, on track, budget left |
| Heads-up | #FFF6D6 | #5C4600 | Due soon, not assigned yet, tips |
| Danger | #FBEBEB | #9B2C2C | Debts, warnings, over budget |
| Destructive | #B42318 | #FFFFFF | Delete buttons only, nowhere else |
| Info | #E7F1FB | #1F4E8C | Neutral tags, 30th payday |

### Categories and charts

Category icons use a soft background with a darker stroke of the same hue: orange #FFF0E0 / #8A4B00 (food), blue #E7F1FB / #1F4E8C (transport, travel), purple #EFEDFF / #4B3FA6 (personal, fun), yellow #FFF6D6 / #5C4600 (bills), red #FBEBEB / #9B2C2C (debts, health), green #E8F6EE / #177A42 (income, savings).

The 50/30/20 bar always uses the same order and colors: **Needs** #157A41, **Wants** #F4C430, **Savings & debt payoff** #7FD3A3, **Not assigned** #E3EDE7. Each segment also gets a text label, so color is never the only cue.

### Dark mode

| Token | Light | Dark |
| --- | --- | --- |
| `bg` | #F4FAF6 | #0F1A14 |
| `surface` | #FFFFFF | #17261D |
| `line` | #D5E3DA | #2C3F33 |
| `ink` (text) | #1C1C1E | #EAF2EC |
| `sticker` (outline + shadow) | #1C1C1E | #7FD3A3 (mid mint; black blends into the dark background) |
| `text-3` | #55645B | #A7BDB0 |
| Primary button | #177A42 + white text | #2FBF6E + #0B1A11 text |
| Link | #177A42 | #5DD68F |

In dark mode the logo sits on a mint circle so its black outlines stay visible.

## 3. Typography

Two free Google Fonts: **Fredoka** (rounded, friendly) for headings and big money amounts, and **Nunito** for everything else.

| Style | Font | Size (mobile / desktop) | Weight | Use |
| --- | --- | --- | --- | --- |
| Hero amount | Fredoka | 40–44 / 36–44px | 600 | Safe to spend, totals on hero cards |
| Page title | Fredoka | 26–28 / 30px | 600 | One per screen ("Plan", "Activity") |
| Card amount | Fredoka | 22–26px | 600 | Pot balances, stat cards |
| Section title | Nunito | 17–18px | 800 | "Due this period", card headings |
| Section label | Nunito | 12–13px, caps, +0.5px spacing | 800 | "MONEY IN", "YOUR POTS" |
| Body / list item | Nunito | 15–16px | 700–800 for names, 500–600 for text | Rows, paragraphs |
| Input text | Nunito | 16px minimum | 700 | Prevents iPhone zoom on focus |
| Small / hint | Nunito | 13px | 600–700 | Subtitles under names, dates |
| Caption / tag | Nunito | 11–12px | 800 | Chips and tags only; nothing smaller than 11px |

**Line height:** 1.1 for Fredoka headings, 1.45–1.6 for paragraphs. **Weights to load:** Fredoka 500, 600; Nunito 500, 600, 700, 800.

### Writing money

- Peso sign, no space, thousands separator: **₱12,450**. No centavos in display; show them only while typing an amount.
- Money out: real minus sign and ink color, **−₱180**. Money in: plus and green, **+₱25,000**.
- Before and after: an arrow, **₱2,760 → ₱2,940**.
- Ranges and periods: an en dash with spaces, **Nov 15 – 29**. Today is written **Today, Nov 20**.
- Use `Intl.NumberFormat('en-PH')` so every screen formats the same way.

## 4. Spacing, shape and depth

Everything sits on a 4px grid with soft, generous corners. Depth comes from one signature effect: a solid black offset shadow, like a sticker.

### Spacing

- **Steps:** 4, 6, 8, 10, 12, 14, 16, 18, 20, 24, 28, 32, 40, 48px.
- **Inside cards:** 14–18px padding on mobile, 18–20px on desktop.
- **Between sections:** 16–18px on mobile, 20–24px on desktop.
- **Screen edges:** 16px on mobile (20–24px for forms and sheets); `clamp(16px, 3vw, 40px)` on desktop.

### Corner radius

| Token | Radius | Use |
| --- | --- | --- |
| `r-sm` | 10px | Small buttons inside rows, segmented control options |
| `r-md` | 12–14px | Inputs, buttons, icon tiles |
| `r-lg` | 16–18px | Cards, list groups, toasts |
| `r-xl` | 20–24px | Hero cards, dialogs |
| `r-sheet` | 28px top corners | Bottom sheets |
| `r-pill` | 99px | Chips, tags, progress bars |

### Borders

| Border | Use |
| --- | --- |
| 1.5px solid `line` | Default for cards, inputs and list groups |
| 2px solid `green-600` | Selected option, focused input |
| 1.5px dashed `line-dash` | Add buttons and empty states ("something goes here") |
| 2px solid `sticker` | Sticker elements only (see below) |

### The sticker shadow

A 2px `sticker` border plus a solid `sticker` shadow with no blur: `box-shadow: 4px 4px 0 #1C1C1E`. In dark mode both turn mid mint (#7FD3A3), because black disappears on the dark background. Use 3px for buttons, 4–5px for cards and 6px for big desktop panels.

Use it on **one hero element per area**: the Safe to spend card, the main save button in a sheet, the + button, the selected payday, or a key summary card. If two stickers sit side by side, remove one. Other cards stay flat.

The only soft shadow is the small lift on the selected option of a segmented control (`0 1px 3px rgba(0,0,0,0.12)`).

## 5. Logo, mascot and icons

The chihuahua peeking out of a green wallet is the brand. Treat it like a character, not decoration.

### Logo

- **Wordmark:** "Chiwa" in ink plus "wallet" in `green-600` (or #5DD68F on dark), Fredoka 600. Tagline "Sit. Stay. Save." in Nunito 700 below or beside it.
- **Minimum size:** 32px for the full mark. Below that (favicon, 16–24px), use the head-only icon.
- **Clear space:** at least a quarter of the mark's width on every side.
- **Don't:** recolor the dog, stretch the mark, put it on busy photos, or remove the black outlines.

### Using the mascot

| Moment | How it appears |
| --- | --- |
| Login, sign-up, onboarding | Full color, 64–96px |
| Empty states | Full color on a mint circle, 48–120px, with one short line of text |
| Success ("You're all set", payday) | Large, on a mint circle |
| Offline | Greyscale with a crossed-out Wi-Fi badge |
| 404 | Tilted about 8 degrees with a "?" badge |
| Delete account | Faded greyscale on a light red circle |

Use the mascot at most once per screen, and never inside data lists or tables.

### Icons

- **Style:** outline icons, 2px stroke, round caps and joins, 24px grid (for example, Lucide icons, which shadcn uses).
- **Sizes:** 18–22px in rows and buttons, 24px in navigation.
- **Category icons** sit in a 36–44px rounded tile with the category's soft background (see Color).
- **Icon-only buttons** always get an `aria-label` and a 44px tap area.

## 6. Components

Build each component once in shadcn, styled with these rules, and reuse it everywhere.

### Buttons

| Type | Look | Height | Use |
| --- | --- | --- | --- |
| Hero | Wallet Green, white text, 2px ink border, 3px sticker shadow | 54–56px | The single main action in a sheet or flow ("Save expense") |
| Primary | Action Green #177A42, white text, no border | 48–54px | Main action on regular forms and pages |
| Secondary | White, 1.5px `line` border, ink text | 44–52px | Cancel, Back, "Keep it" |
| Soft | Mint background, Forest text | 36–44px | Actions inside rows: Mark paid, Add to pot |
| Dashed | White, 1.5px dashed `line-dash`, green text | 44–52px | Add something new: "+ New pot" |
| Destructive | #B42318, white text | 48–52px | Delete only |
| Text link | Green, weight 800, no underline | 44px tap area | "See all", "Forgot password?" |

Button labels say what happens: "Add ₱2,000 to Travel", not "Submit". Disabled buttons use `track` background and `text-3` text, plus a line explaining why.

### Inputs

- **48px tall inside the app** (onboarding, sheets, settings); **52px on auth screens only** (decided Nov 19). 14px radius, 1.5px `line` border, white background; 2px `green-600` border when focused.
- A visible label above every field (14px, weight 700); "(optional)" in lighter text when it applies.
- **Money inputs:** ₱ prefix inside the field, numeric keyboard (`inputmode="decimal"`). Big amounts use Fredoka at 28–56px with a green underline.
- **Choices:** 2–4 options become a segmented control; 3–6 options with descriptions become radio cards; more than that becomes a select.
- **On/off settings:** a 52×32px switch, green when on.

### Cards and lists

- **Card:** white, 1.5px `line` border, 16–20px radius, no shadow.
- **List group:** one card holding rows, separated by `line-soft` dividers. Each row: icon tile, name (800) with a detail line under it (13px), amount on the right.
- **Hero card:** Deep Green background, white text, sticker border and shadow. Holds the one number that matters.
- **Stat card:** label (13px), Fredoka amount (26px), one-line explanation.

### Chips, tags and progress

- **Filter chips:** 38px pills. Selected = Deep Green with ink border and white text.
- **Status tags:** 11–12px weight 800 pills in the status colors ("Paid", "Due Nov 22", "On track").
- **Progress bars:** 8–12px pill, mint track, Wallet Green fill. Always show the number next to it ("43% of ₱30,000").

### Sheets, dialogs and toasts

- **Bottom sheet (mobile):** white, 28px top corners, grab handle, title plus close button, dims the screen behind at 50%. Used for add and edit forms and confirmations.
- **Dialog (desktop):** centered, max 440px wide, sticker border, Esc or clicking outside cancels. **Side panel (desktop):** 480px from the right for longer forms.
- **Impact box:** a mint (or yellow) note before the save button, stating the result in pesos.
- **Toast:** ink background, white text, bottom of the screen above the navigation, with an action like Undo. It disappears after 5 seconds.
- **Deleting:** follow the three-level delete pattern on the design canvas.

### Navigation

- **Mobile:** bottom bar, 84px tall: Home, Plan, a raised 62px + button (sticker style), Activity, More. The current tab is green, weight 800, with `aria-current`.
- **Desktop:** 240px white sidebar with the logo, links (44px tall, mint background when current) and the profile at the bottom.
- **Sub-pages:** a back arrow (44px) at the top left plus the page title.

### Empty states

Dashed `line-dash` border, the mascot, a title of 3–5 words, one sentence on what goes here, and one button to add it. Never show a blank area or "No data".

## 7. Layout and responsive

Design and build mobile first at 390px wide, then let the same pieces spread out on bigger screens.

| Screen width | Layout |
| --- | --- |
| Under 768px (phones) | One column, bottom navigation, sheets slide up from the bottom |
| 768–1023px (tablets) | One or two columns, sidebar appears, sheets become dialogs |
| 1024px and up (laptops) | 240px sidebar + content; main column plus a 300–420px side column |

- **Content width:** cap main content around 1100px and text blocks around 720px, so lines stay readable on wide screens.
- **Order on mobile:** the hero number first, then what needs action (due items), then progress (budgets, pots), then history (activity).
- **Desktop side column:** summaries and helpers (savings pots, 50/30/20, "Give it a job"). The main column keeps the lists and tables.
- **Tables:** desktop only, inside a box that scrolls sideways on small screens. On mobile the same data becomes a list of rows.
- **Wrapping:** layouts use flex-wrap or auto-fit grids, so nothing is fixed to one screen size. Toolbars wrap and the sidebar stacks on top on narrow screens.

## 8. Voice and tone

Talk like a friend who is good with money: short, warm, specific, never preachy.

- **Short:** button labels of 1–4 words; hints in one sentence.
- **Specific:** use real numbers and dates. "₱1,000 due Nov 22", not "You have upcoming bills".
- **Encouraging, not judging:** "₱400 under your plan" and "Every peso has a job". When someone overspends, say so plainly and suggest a next step. No scolding.
- **Local:** pesos, paydays on the 15th and 30th, Padala, Load & data, MP2, 13th month pay. Filipino words are welcome where people actually use them.
- **Playful in small doses:** dog puns only in empty states, success screens and errors ("Sit. Stay. Save.", "This page ran off"). Never on screens about debt or deleting.
- **Honest:** Chiwawallet tracks records, not real money. Never imply it moves money, and never give investment advice.

### Words to use

| Say | Instead of |
| --- | --- |
| Payday, period | Month, cycle, billing cycle |
| Safe to spend | Available balance, disposable income |
| Not assigned yet | Unallocated, remaining |
| Savings & debt payoff | Savings (when debt payments are included) |
| Mark paid | Complete, settle |
| Keep it | Cancel (on delete confirmations) |
| Delete | Remove (unless only taking something off a plan) |

## 9. Accessibility checklist

Check every new screen against this list before calling it done.

- [ ] Text contrast is at least 4.5:1 (3:1 for text 24px and bigger). On white, the lightest grey allowed is `text-3` #55645B; on Action Green, text is white.
- [ ] Every tap target is at least 44×44px, including icon buttons and rows.
- [ ] Color is never the only signal: status tags have words, chart segments have labels, over-budget states say "over".
- [ ] Real elements only: `<button>` for actions, `<a>` for navigation, `<label>` on every input. No clickable `div`s.
- [ ] Icon-only buttons have an `aria-label`; decorative icons have `aria-hidden="true"`.
- [ ] Selected and current states use `aria-pressed`, `aria-checked` or `aria-current`, not only a color change.
- [ ] Sheets and dialogs trap focus, close with Esc, and return focus to what opened them. Delete confirmations start focus on "Keep it".
- [ ] Amounts that update live (remaining to assign, totals) sit in an `aria-live="polite"` region.
- [ ] Input text is at least 16px, so iPhones don't zoom in.
- [ ] The layout still works at 200% text size and at 320px wide.

## 10. For developers: theme tokens

Paste this into `app/globals.css` (Tailwind v4 reads the theme from CSS). Classes like `bg-mint`, `text-ink`, `rounded-lg` and `shadow-sticker` then match this guide, and the dark values switch automatically.

```css
@import "tailwindcss";

@theme {
  --font-display: "Fredoka", system-ui, sans-serif;
  --font-sans: "Nunito", system-ui, sans-serif;

  --color-green-500: #1F9D55; /* Wallet Green */
  --color-green-600: #177A42; /* Action Green: buttons, links */
  --color-green-700: #157A41; /* Deep Green: hero cards */
  --color-green-800: #0F5E34; /* Forest: text on mint */
  --color-gold: #F4C430;
  --color-danger: #B42318;    /* destructive only */
  --color-sticker: var(--sticker); /* black in light, mid mint in dark */

  --color-ink: var(--ink);
  --color-text-2: var(--text-2);
  --color-text-3: var(--text-3);
  --color-bg: var(--bg);
  --color-surface: var(--surface);
  --color-mint: var(--mint);
  --color-line: var(--line);
  --color-line-soft: var(--line-soft);
  --color-line-dash: #9CC9AE;
  --color-track: var(--track);

  --color-warn-bg: #FFF6D6;  --color-warn-fg: #5C4600;
  --color-bad-bg: #FBEBEB;   --color-bad-fg: #9B2C2C;
  --color-info-bg: #E7F1FB;  --color-info-fg: #1F4E8C;

  --color-needs: #157A41;
  --color-wants: #F4C430;
  --color-savings-debt: #7FD3A3;

  --radius-sm: 10px;
  --radius-md: 14px;
  --radius-lg: 18px;
  --radius-xl: 24px;
  --radius-sheet: 28px;

  --shadow-sticker-sm: 3px 3px 0 var(--sticker);
  --shadow-sticker: 4px 4px 0 var(--sticker);
  --shadow-sticker-lg: 6px 6px 0 var(--sticker);
}

:root {
  --ink: #1C1C1E; --text-2: #3E4C44; --text-3: #55645B;
  --bg: #F4FAF6; --surface: #FFFFFF; --mint: #E8F6EE;
  --line: #D5E3DA; --line-soft: #E3EAE6; --track: #E3EDE7;
  --sticker: #1C1C1E;
}

.dark {
  --ink: #EAF2EC; --text-2: #C9D6CE; --text-3: #A7BDB0;
  --bg: #0F1A14; --surface: #17261D; --mint: #15301F;
  --line: #2C3F33; --line-soft: #22342A; --track: #22342A;
  --sticker: #7FD3A3; /* mid mint */
}
```

Load the fonts with `next/font/google` (Fredoka 500, 600; Nunito 500–800) and point `--font-display` and `--font-sans` at them. When you install shadcn, map its `--primary` to Action Green, `--background` to `bg`, `--border` to `line` and `--radius` to 14px, so its components match without per-component overrides.
