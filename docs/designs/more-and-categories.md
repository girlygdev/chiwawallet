# Chiwawallet More & Categories Spec

Nov 19, 2026 · Girly Gado

The mobile **More** tab, the hub for everything that isn't Home, Plan or Activity, plus creating a category. Canvas files: `More`, `NewCategory` and `CategoryPicker` (on the **Transactions & More** page). Desktop has no More page; the same links live in the sidebar and in Settings ([`settings.md`](settings.md)). The category picker is specified in [`activity.md`](activity.md).

Routes: `/more` (mobile only; on desktop it redirects to `/settings`) and `/settings/categories/new`.

## 1. More (mobile)

**Header:** the h1 "More" (Fredoka 28px).

**Profile card,** a sticker card: white, 20px radius, 2px ink border, `4px 4px 0` shadow, 16px padding.
- A 56px Deep Green circle with the initial ("R") in Fredoka 24px.
- The display name, the email, and "My budget · Twice a month".
- It opens Profile in Settings.

**Sections:** each has a 13px weight 800 caps `text-3` h2 and a list card. Each row is `12px 14px` with a 40px icon tile, a name (weight 800), an optional 13px detail line and a chevron.

| Section | Row | Detail line (live) | Opens |
| --- | --- | --- | --- |
| MONEY | Income | 2 sources · ₱58,000 a month | Income (`income.md`) |
| | Bills | 3 recurring | Bills (`bills.md`) |
| | Savings pots | 3 pots · ₱67,500 saved | Savings (`savings.md`) |
| | Debts | 1 debt · ₱8,000 left | Debts (`debts.md`) |
| BUDGET | Budget settings | Paydays, week start, carry-over | `settings.md` |
| | Categories | Names, icons and 50/30/20 groups | Category list (section 3) |
| | Budgeting model | 50/30/20, plus a grey "Soon" tag | Nothing yet (v1.1) |
| APP | Appearance | Light / Dark / Auto segmented control | Changes `profiles.theme` right away |
| | Install Chiwawallet | Add it to your home screen | Install instructions |
| PRIVACY & ACCOUNT | Export my data | Download everything as CSV | `settings.md` |
| | Privacy Notice | — | `legal.md` |
| | Terms | — | `legal.md` |
| | Delete account | Permanently remove all your data | `settings.md`; red tile |

- **Footer:** a secondary **Log out** button (52px, with an icon), then the 44px mascot, "Sit. Stay. Save." and "Chiwawallet v0.1" (12px `text-3`).
- **Install row:** hide it when the app is already installed (`display-mode: standalone`). On Android it triggers the browser's install prompt; on iPhone it shows a short sheet: tap Share, then "Add to Home Screen".
- **Budgeting model:** shown disabled with "Soon" until v1.1. Its tap does nothing, so make it a plain row (not a link) with `aria-disabled="true"`.

## 2. New category

A full-height sheet with a back arrow, titled "New category" (Fredoka 22px). It's opened from the category picker or from the category list.

**Preview card** at the top (`aria-label="Preview"`, "PREVIEW" label): a 56px icon tile in the chosen colour, the name, and the group line ("Needs · 50% target"). It updates as you type.

| Field | Control | Default |
| --- | --- | --- |
| Name | 50px text input, focused | "New category" placeholder |
| Which 50/30/20 group? | Three radio rows: **Needs** ("Must-pays like food, bills, rent", 50%), **Wants** ("Nice-to-haves like shopping, fun", 30%), **Savings & debt payoff** ("Saving or paying debt early", 20%) | Needs |
| Icon | A grid of 20 icon buttons, 52px tall, 14px radius | Paw |
| Color | 6 swatches, 46px circles | Orange |
| Budget per payday (optional) | ₱ money input | Empty |

- **Group rows** are `10px 14px` with a 14px radius. Selected: 2px `green-600` border, `mint` fill. The percentage on the right comes from the budget's targets.
- **Icons**, each with an `aria-label`: Pet, Groceries, Home, Electricity, Water, Internet, Phone, Health, Medicine, School, Gifts, Travel, Car, Gas, Coffee, Clothes, Games, Fitness, Grooming, Kids. Use the matching Lucide icons.
  - Selected: a 2px border and soft background in the chosen colour.
  - Not selected: 1.5px `line` border, `text-2` icon.
- **Colours,** soft background / icon colour:

| Colour | Background | Icon |
| --- | --- | --- |
| Orange | #FFF0E0 | #8A4B00 |
| Blue | #E7F1FB | #1F4E8C |
| Purple | #EFEDFF | #4B3FA6 |
| Yellow | #FFF6D6 | #5C4600 |
| Red | #FBEBEB | #9B2C2C |
| Green | #E8F6EE | #177A42 |

  Swatches show the soft colour with a dot of the icon colour. Selected: 3px ink border. Each has an `aria-label` and `aria-pressed`.
- **Budget per payday:** saved as `categories.default_budget`. From the next period on, `generatePlan()` copies it into each period's plan. Say so under the field: "Added to every payday's plan from Nov 30." (Ask whether to add it to the current period too.)
- **Button:** **Save category** (hero). Then return to where it was opened from, with the new category selected.
- **Saves:** `categories` with `name`, `kind = expense`, `group` (`needs` / `wants` / `savings_debt`), `icon`, `color` and `default_budget`.
- **Validation:** the name is required, 1–30 characters, and must be unique among the user's categories (case-insensitive): "You already have a category called Food."

## 3. Category list (not on the canvas)

The **Categories** row in More and Settings opens a list that isn't designed yet. Build it from existing pieces:
- The same three group sections as the category picker, with rows instead of tiles: icon, name, budget per payday, chevron.
- Tapping a row opens New category in edit mode, titled "Edit category", with a **Delete category** link (level 2 delete, `delete-pattern.md`).
- **+ New category** as a dashed button at the bottom.
- An **Income categories** section, if `kind = income` categories are used. Otherwise hide it.

## 4. Default categories

Created for every new user at sign-up (week 3 of the build plan). From the picker:

| Group | Categories |
| --- | --- |
| Needs | Food, Transport, Bills, Rent, Load & data, Health, Padala |
| Wants | Personal, Shopping, Dining out, Fun, Gifts, Travel |
| Savings & debt payoff | Savings pot, Extra debt payment (system categories; see `activity.md`) |

## 5. Accessibility

- [ ] The More rows are links (they go somewhere). The Appearance row isn't a link: it's a row with a label and a real radio group.
- [ ] The disabled Budgeting model row has `aria-disabled="true"`, and the "Soon" tag is part of its accessible name.
- [ ] Group, icon and colour choices are announced with their state (`aria-checked` or `aria-pressed`).
- [ ] The preview card is `aria-hidden` (it repeats the fields) or `aria-live="off"`, so it isn't read on every keystroke.

## 6. Fix before building

1. **Nested controls:** the Appearance row is an `<a>` with a radio group inside it. Make the row a plain `<div>` and keep the radio group.
2. **Placeholder links:** the profile card, Categories, Budgeting model, Appearance and Install all point to `#`. Wire them as in the section 1 table.
3. **The "Soon" tag colour** (#F3F4F2) isn't a token. Use `track`.
4. **Category list and edit** aren't designed. See section 3.
