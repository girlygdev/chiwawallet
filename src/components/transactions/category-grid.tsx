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
import { useState } from "react";
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

type Category = { id: string; name: string; icon: string };

// Add expense's category grid (activity.md §3): the top tiles plus More, three
// to a row. Until the category picker exists (3c-2), More just shows every
// category here (owner, Nov 23). Tiles are buttons with aria-pressed.
export function CategoryGrid({
  categories,
  topCount,
  value,
  onChange,
  error,
  loading,
}: {
  /** Best first (topCategories). */
  categories: Category[] | null;
  topCount: number;
  value: string | undefined;
  onChange: (id: string) => void;
  error?: string;
  loading: boolean;
}) {
  const [showAll, setShowAll] = useState(false);
  const shown = categories ? (showAll ? categories : categories.slice(0, topCount)) : [];
  const hasMore = categories != null && categories.length > topCount && !showAll;

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
        <div className="grid grid-cols-3 gap-2">
          {shown.map((category) => {
            const selected = category.id === value;
            return (
              <button
                key={category.id}
                type="button"
                aria-pressed={selected}
                onClick={() => onChange(category.id)}
                className={cn(
                  "flex min-h-[76px] flex-col items-center justify-center gap-1 rounded-[14px] px-1 py-2 text-xs font-extrabold text-ink outline-link focus-visible:outline-2 focus-visible:outline-offset-2",
                  selected ? "border-2 border-green-600 bg-mint" : "border-[1.5px] border-line bg-surface",
                )}
              >
                <span className="flex size-9 items-center justify-center rounded-[10px] bg-track text-text-2">
                  <CategoryIcon icon={category.icon} size={20} />
                </span>
                <span className="line-clamp-2 text-center leading-tight">{category.name}</span>
              </button>
            );
          })}
          {hasMore && (
            <button
              type="button"
              onClick={() => setShowAll(true)}
              className="flex min-h-[76px] flex-col items-center justify-center gap-1 rounded-[14px] border-[1.5px] border-dashed border-line-dash px-1 py-2 text-xs font-extrabold text-text-2 outline-link focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              <span className="flex size-9 items-center justify-center">
                <Plus aria-hidden size={20} />
              </span>
              More
            </button>
          )}
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
