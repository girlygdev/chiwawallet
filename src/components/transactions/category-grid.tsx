"use client";

import {
  Baby,
  Car,
  CircleAlert,
  Coffee,
  CreditCard,
  Dog,
  Droplet,
  Dumbbell,
  Fuel,
  Gamepad2,
  Gift,
  GraduationCap,
  HeartPulse,
  House,
  type LucideIcon,
  Pill,
  PawPrint,
  PiggyBank,
  Plane,
  Plus,
  Scissors,
  Shirt,
  ShoppingBasket,
  Smartphone,
  Tag,
  Wallet,
  Wifi,
  Zap,
} from "lucide-react";
import { gridCategories } from "@/lib/transactions";
import { cn } from "@/lib/utils";

// categories.icon holds a Lucide name. Only the icons we offer are imported
// (the defaults and more-and-categories.md §2's 20), so the bundle stays small.
// Anything else shows a tag.
const ICONS: Record<string, LucideIcon> = {
  "shopping-basket": ShoppingBasket,
  car: Car,
  zap: Zap,
  house: House,
  wifi: Wifi,
  "heart-pulse": HeartPulse,
  smartphone: Smartphone,
  scissors: Scissors,
  shirt: Shirt,
  coffee: Coffee,
  "gamepad-2": Gamepad2,
  gift: Gift,
  plane: Plane,
  wallet: Wallet,
  "piggy-bank": PiggyBank,
  "credit-card": CreditCard,
  "paw-print": PawPrint,
  dog: Dog,
  droplet: Droplet,
  pill: Pill,
  "graduation-cap": GraduationCap,
  fuel: Fuel,
  dumbbell: Dumbbell,
  baby: Baby,
};

export function CategoryIcon({ icon, size }: { icon: string; size: number }) {
  const Icon = ICONS[icon] ?? Tag;
  return <Icon aria-hidden size={size} strokeWidth={2} />;
}

// categories.color → its token pair. Written out in full so Tailwind finds
// the class names. An unknown colour gets the neutral track tile.
const COLORS: Record<string, string> = {
  orange: "bg-cat-orange-bg text-cat-orange-fg",
  blue: "bg-cat-blue-bg text-cat-blue-fg",
  purple: "bg-cat-purple-bg text-cat-purple-fg",
  yellow: "bg-cat-yellow-bg text-cat-yellow-fg",
  red: "bg-cat-red-bg text-cat-red-fg",
  green: "bg-cat-green-bg text-cat-green-fg",
};

/**
 * A category's icon on its soft colour: 36px in the grid and picker, 40px in
 * the Activity list (activity.md §1). Decorative: the name sits beside it.
 */
export function CategoryIconTile({
  icon,
  color,
  size = "sm",
}: {
  icon: string;
  color: string;
  /** sm 36px, md 40px, lg 56px (New category's preview card). */
  size?: "sm" | "md" | "lg";
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex shrink-0 items-center justify-center",
        size === "lg" ? "size-14 rounded-[16px]" : size === "md" ? "size-10 rounded-[10px]" : "size-9 rounded-[10px]",
        COLORS[color] ?? "bg-track text-text-2",
      )}
    >
      <CategoryIcon icon={icon} size={size === "lg" ? 28 : size === "md" ? 22 : 20} />
    </span>
  );
}

export type TileCategory = { id: string; name: string; icon: string; color: string };

/**
 * A category button for the add sheet's grid and the picker: a 36px icon tile
 * in the category's colour, then the name, which also names the button.
 */
export function CategoryTile({
  category,
  selected,
  onClick,
  className,
}: {
  category: TileCategory;
  selected: boolean;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        "flex min-h-[76px] flex-col items-center justify-center gap-1 rounded-[14px] px-1 py-2 text-xs font-extrabold text-ink outline-link focus-visible:outline-2 focus-visible:outline-offset-2",
        selected ? "border-2 border-green-600 bg-mint" : "border-[1.5px] border-line bg-surface",
        className,
      )}
    >
      <CategoryIconTile icon={category.icon} color={category.color} />
      <span className="line-clamp-2 text-center leading-tight">{category.name}</span>
    </button>
  );
}

// Add expense's category grid (activity.md §3): the top tiles plus More,
// three to a row. More opens the category picker (category-picker.tsx).
// Tiles are buttons with aria-pressed.
export function CategoryGrid({
  categories,
  topCount,
  value,
  onChange,
  onMore,
  error,
  loading,
  ref,
}: {
  /** Best first (topCategories). */
  categories: TileCategory[] | null;
  topCount: number;
  value: string | undefined;
  onChange: (id: string) => void;
  onMore: () => void;
  error?: string;
  loading: boolean;
  /** The tiles' container, so focus can come back here from the picker. */
  ref?: React.Ref<HTMLDivElement>;
}) {
  const shown = categories ? gridCategories(categories, topCount, value) : [];

  return (
    <fieldset className="flex flex-col gap-1.5" aria-describedby={error ? "expense-category-error" : undefined}>
      <legend className="mb-1.5 text-sm font-bold text-ink">Category</legend>

      {loading ? (
        <div aria-hidden className="grid grid-cols-3 gap-2">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="h-[76px] animate-pulse rounded-[14px] bg-track motion-reduce:animate-none" />
          ))}
        </div>
      ) : (
        <div ref={ref} className="grid grid-cols-3 gap-2">
          {shown.map((category) => (
            <CategoryTile
              key={category.id}
              category={category}
              selected={category.id === value}
              onClick={() => onChange(category.id)}
            />
          ))}
          <button
            type="button"
            onClick={onMore}
            data-more
            className="flex min-h-[76px] flex-col items-center justify-center gap-1 rounded-[14px] border-[1.5px] border-dashed border-line-dash px-1 py-2 text-xs font-extrabold text-text-2 outline-link focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            <span className="flex size-9 items-center justify-center">
              <Plus aria-hidden size={20} />
            </span>
            More
          </button>
        </div>
      )}

      {error && (
        <p id="expense-category-error" className="flex items-center gap-1.5 text-[13px] font-bold text-bad-fg">
          <CircleAlert aria-hidden className="size-4 shrink-0" />
          {error}
        </p>
      )}
    </fieldset>
  );
}
