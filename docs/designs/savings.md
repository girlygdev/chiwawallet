# Chiwawallet Savings Pots Spec

Nov 19, 2026 · Girly Gado

Named pots that money goes into each payday: Emergency, Travel, MP2 and so on. Canvas files: `Savings`, `SavingsDesktop` and `NewPot` (on the **Savings, debts, bills & income** page). Adding or withdrawing money uses the Savings tab of the add sheet ([`activity.md`](activity.md)); deleting a pot is in [`delete-pattern.md`](delete-pattern.md).

Routes: `/savings`, `/savings/[potId]`, `/savings/new`.

## 1. The numbers

| Value | Formula |
| --- | --- |
| Pot balance | `starting_balance` + deposits − withdrawals (never stored; always calculated from transactions) |
| To go | target − balance |
| Progress | balance ÷ target, capped at 100% |
| Total saved | the sum of all pot balances (₱13,000 + ₱6,000 + ₱48,500 = ₱67,500) |
| Monthly saving plan | each pot's contribution × paydays per month: ₱3,000 (once) + ₱2,000 × 2 + ₱5,000 (once) = ₱12,000 |
| Goal date ("On track for…") | step through the coming paydays, adding the planned contribution where the pot's pay slot matches, until the balance reaches the target. Show the month. |

- No target means no progress bar, no "to go" and no goal date.
- **If the contribution can't reach the target by the target date,** show the yellow line "Behind: save ₱X each payday to make it by June."

## 2. Mobile list

- **Header:** a back arrow to More, the h1 "Savings pots", and a 44px **+** sticker button (`green-500`, 2px ink border, `2px 2px 0` shadow, `aria-label="Add savings pot"`) that opens New pot.
- **Total card,** the hero: Deep Green, 22px radius, sticker border, `4px 4px 0` shadow. It says "Total saved", ₱67,500 in Fredoka, and "Across 3 pots · +₱3,000 this period".
- **YOUR POTS:** the caps heading plus a reminder line, "Due this period: ₱2,000 to Travel", when a planned deposit is unpaid.
- **Pot card** (a link to the pot's details), one per pot:
  - Top row: a tile, the name, and the schedule ("₱3,000 every 15th", "₱2,000 each payday", "₱5,000 every 30th"). The balance is on the right in Fredoka.
  - An 8px progress bar, with "₱17,000 to go" and "43% of ₱30,000" under it.
  - A status tag: "On track for May 2027" (positive), "Behind" (heads-up) or "Locked · deposits only" (neutral, with a lock icon).
  - A locked pot with no target says "No target · long-term savings" instead of the bar.
- **Bottom button:** **Add money to a pot** (primary, full width) opens the add sheet on the Savings tab.

## 3. Desktop

- **Header:** a summary line ("Saving toward 2 goals plus MP2"), the h1 "Savings pots", and a **New pot** button.
- **Three stat cards:**
  - Total saved: ₱67,500, "3 pots".
  - Added this period: ₱3,000, "₱2,000 more planned".
  - Monthly saving plan: ₱12,000, "₱3k + ₱4k + ₱5k".
- **Left column:** the pot cards as on mobile. The selected one has a 2px `green-600` border and `aria-current="true"`.
- **Right column, pot details** for the selected pot:
  - The name, a subtitle, and a big balance "₱13,000 of ₱30,000" with a bar.
  - Three facts: plan ("₱3,000 / 15th"), Still needed (₱17,000), Goal date (May 2027).
  - Actions: **Add money** (primary), **Withdraw** (secondary, hidden for locked pots), **Edit** (text link).
  - **History:** the pot's transactions, newest first ("Planned deposit · Nov 15 · from 15th payday · +₱3,000"), ending with "Starting balance · Sep 1 · +₱4,000".

On mobile, the pot details are a separate page (`/savings/[potId]`) with the same content stacked.

## 4. New savings pot

A bottom sheet on mobile, a dialog or side panel on desktop. Title "New savings pot", subtitle "A goal you put money toward each payday."

| Field | Control | Example | Saves to |
| --- | --- | --- | --- |
| Pot name | 50px text input, focused | Laptop fund | `name` |
| Icon | 6 icon buttons: Laptop, Emergency, Travel, Home, Gift, School (`aria-pressed`) | Laptop | `icon` |
| Target (optional) | ₱ money input | 40,000 | `target_amount` |
| Target date (optional) | Month picker button | Jun 2027 | `target_date` |
| Already saved (optional) | ₱ money input | 0 | `starting_balance` |
| Save each time | ₱ money input, required | 2,000 | `planned_contribution` |
| From | A select button: Every payday, 15th only, 30th only (uses the real dates) | Every payday | `pay_slot` |
| Locked savings | A switch (`role="switch"`), with the hint "Deposits only, like MP2 or time deposits" | Off | `is_locked` |

- **Projection box** (`mint`, live):
  - "At ₱4,000 a month you reach ₱40,000 by Sep 2027."
  - If a target date is set and won't be met, a second line: "Save ₱2,900 each payday to make it by June." Round up to the nearest ₱100.
- **Button:** **Create pot** (hero).
- **After saving:** the pot appears in the list, and its contribution is added to the plan of every open future period.
- **Colour:** the pot's colour comes from the chosen icon's default, or a colour picker like New category's (`more-and-categories.md`) if you want one.
- **Edit** reuses this sheet, titled "Edit pot". Changing the contribution asks: "Update future paydays only?"

## 5. Locked pots

- Deposits only: Withdraw is hidden on the pot and disabled in the add sheet ("₱48,500 · locked, deposits only").
- Counted in Total saved, but marked with a lock wherever it appears.
- On the dashboard: a full bar in `line-dash` and "Locked savings" (`dashboard.md`).

## 6. Accessibility

- [ ] Pot cards are links named with the pot name and balance.
- [ ] Progress bars have text next to them ("43% of ₱30,000").
- [ ] The Locked switch has `role="switch"` and `aria-checked`, and its label and hint are tied to it.
- [ ] The projection box is `aria-live="polite"`.

## 7. Fix before building

1. **Travel pot schedule disagrees across screens.** Savings says "₱2,000 each payday" and the monthly plan counts ₱4,000 a month, but Plan says "Split · half each payday", and the goal date "Apr 2027" matches neither. Decide: Travel is **₱2,000 every payday** (`pay_slot = every`). Then Plan's detail line becomes "Every payday" and the goal date becomes **Feb 2027** (₱14,000 to go at ₱2,000 a payday, from this period).
2. **Desktop pot subtitle** says "Needs · emergency fund". Pots count as **Savings & debt payoff**, not Needs. Use "Emergency fund" or "Savings & debt payoff".
3. **Placeholder links:** the pot cards and detail actions point to `#`. Wire them to the details page, the Savings tab with this pot pre-selected, and Edit pot.
4. **Mobile pot details page** isn't designed. Stack the desktop details panel (section 3).
5. **`pay_slot = split`** for pots (half on each payday) is mentioned on Plan but not offered in New pot. Either add "Split across both" to the From select, or drop split for pots. Recommend dropping it: "Every payday" with a per-payday amount is simpler.
