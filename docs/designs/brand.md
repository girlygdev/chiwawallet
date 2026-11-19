# Chiwawallet Logo & App Icon Spec

Nov 19, 2026 · Girly Gado

The logo lockups, app icons and favicon. Canvas files: `Main`, `Variations` and `AppIcon` (on the **Logo** page). The general logo rules (minimum size, clear space, don'ts, mascot moments) are in [`style-guide.md`](style-guide.md) section 5. This file covers exporting and using the assets.

## 1. Lockups

| Lockup | Background | Wordmark | Tagline | Use |
| --- | --- | --- | --- | --- |
| Main | White | "Chiwa" ink + "wallet" green | "Sit. Stay. Save." | README, desktop sidebar, auth screens |
| Light | Mint #E8F6EE | "Chiwa" ink + "wallet" green | #3E4C44 | Onboarding rail, marketing |
| Dark | #12241A | "Chiwa" white + "wallet" #5DD68F | #B9D3C2 | Dark mode, social images |

- **Wordmark:** Fredoka 600, line height 1.
- **Tagline:** Nunito 700 with 1.5px letter spacing.
- **Logo palette** (from the canvas): Wallet Green #1F9D55, Deep Green #157A41, Mint #E8F6EE, Ink #1C1C1E, Coin Gold #F4C430, and **Ear Blush #F0B49E**, which is used only in the logo artwork. Don't use it in the UI.

## 2. App icon

- **Shape:** the head-and-wallet mark on a `mint` (#E8F6EE) rounded square. The corner radius is about 23% of the size (260px → 60px, 96 → 22, 60 → 14, 40 → 9).
- **Padding:** the mark fills about 85–90% of the square (220 of 260px).
- **Small sizes:** checked at 96, 60 and 40px on the canvas. At 40px and below, use the head-only mark.

### Files to export

| File | Size | Notes |
| --- | --- | --- |
| `app/icon.svg` | Vector | Favicon for modern browsers (Next.js picks it up) |
| `app/favicon.ico` | 16, 32, 48 | Older browsers; head-only mark |
| `app/apple-icon.png` | 180 × 180 | iPhone home screen. **No rounded corners and no transparency** (iOS rounds it); fill the square with mint |
| `public/icons/icon-192.png` | 192 × 192 | PWA manifest |
| `public/icons/icon-512.png` | 512 × 512 | PWA manifest and splash |
| `public/icons/maskable-512.png` | 512 × 512 | `purpose: "maskable"`: mint fills edge to edge, with the mark inside the middle 80% (safe zone) |
| `public/og.png` | 1200 × 630 | Link preview: the dark lockup, centered |

### `app/manifest.ts`

| Field | Value |
| --- | --- |
| `name` | "Chiwawallet" |
| `short_name` | "Chiwawallet" |
| `description` | "Budget by payday. Sit. Stay. Save." |
| `start_url` | `/` |
| `display` | `standalone` |
| `background_color` | #F4FAF6 (`bg`) |
| `theme_color` | #157A41 (Deep Green) |
| `icons` | The 192, 512 and maskable files above |

## 3. Fix before building

1. **Logo on dark:** the Dark lockup puts the mark straight on #12241A, but `style-guide.md` says the logo sits on a mint circle in dark mode so its black outlines stay visible. Keep the mint circle inside the app's dark mode (small sizes), and allow the bare mark only in the large Dark lockup where the outlines are big enough to read. Update the style guide to say so.
2. **Wordmark green:** the Light lockup uses #17834A for "wallet", but the token is `green-600` #177A42. Use the token.
3. **Off-palette greys:** #4A5A50 (canvas captions) isn't a token. Use `text-3` #55645B.
4. **Export the SVG** of the mark from the canvas once, and keep it in `public/brand/` so every icon is generated from the same source.
