import {
  ArrowLeftRight,
  CalendarRange,
  CreditCard,
  HandCoins,
  House,
  type LucideIcon,
  Menu,
  PiggyBank,
  Receipt,
  Settings,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  // Other pages that count as this item, for aria-current. On mobile, Income,
  // Bills, Savings, Debts and Settings are reached through More.
  alsoActiveOn?: string[];
};

// Mobile bottom bar, either side of the + button (app-shell.md §1).
export const MOBILE_TABS_LEFT: NavItem[] = [
  { href: "/dashboard", label: "Home", icon: House },
  { href: "/plan", label: "Plan", icon: CalendarRange },
];
export const MOBILE_TABS_RIGHT: NavItem[] = [
  { href: "/activity", label: "Activity", icon: ArrowLeftRight },
  {
    href: "/more",
    label: "More",
    icon: Menu,
    alsoActiveOn: ["/income", "/bills", "/savings", "/debts", "/settings"],
  },
];

// Desktop sidebar (app-shell.md §2). Mobile "Activity" is desktop "Transactions".
export const SIDEBAR_LINKS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: House },
  { href: "/plan", label: "Plan", icon: CalendarRange },
  { href: "/activity", label: "Transactions", icon: ArrowLeftRight },
  { href: "/income", label: "Income", icon: HandCoins },
  { href: "/bills", label: "Bills", icon: Receipt },
  { href: "/savings", label: "Savings", icon: PiggyBank },
  { href: "/debts", label: "Debts", icon: CreditCard },
];
export const SETTINGS_LINK: NavItem = { href: "/settings", label: "Settings", icon: Settings };

// Until the Add transaction sheet exists (Week 3), the + button and the
// desktop Add transaction button link to Activity (decided Nov 19).
export const ADD_TRANSACTION_HREF = "/activity";

function matches(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function isCurrent(pathname: string, item: NavItem) {
  return [item.href, ...(item.alsoActiveOn ?? [])].some((href) => matches(pathname, href));
}
