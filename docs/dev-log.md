# Dev log

Newest entry first.

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
