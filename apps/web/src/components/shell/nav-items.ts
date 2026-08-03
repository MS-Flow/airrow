/** The app's primary navigation, shared by the sidebar and the command palette. */
export interface NavItem {
  href: string;
  label: string;
  /** Lucide icon name, resolved by the sidebar so this file stays serialisable. */
  icon: "projects" | "settings" | "support" | "admin";
}

/** What everyone sees. */
const BASE_ITEMS: NavItem[] = [
  { href: "/app", label: "Projects", icon: "projects" },
  { href: "/app/settings", label: "Settings", icon: "settings" },
  { href: "/app/support", label: "Support", icon: "support" }
];

/** The operator console (spec 150). Appended only for admins, never rendered otherwise. */
const ADMIN_ITEM: NavItem = { href: "/app/admin", label: "Admin", icon: "admin" };

/**
 * What a suspended account is offered (spec 164): the one route that still answers.
 *
 * A constant rather than a filter over `BASE_ITEMS`, so adding a nav entry later cannot accidentally
 * hand it to a suspended founder — a new item has to be named here to appear here.
 */
export const SUSPENDED_ITEMS: NavItem[] = [
  { href: "/app/support", label: "Support", icon: "support" }
];

/**
 * The navigation for one session.
 *
 * A function rather than the constant this used to be, because one entry now depends on who is
 * looking. It stays a *single* source: the layout calls it once and hands the result to both the
 * sidebar and the command palette, so neither can drift and the admin entry cannot leak into one of
 * them by being wired up twice.
 *
 * Hiding the entry is presentation, not authorization — `/app/admin` and every admin action gate
 * themselves. A non-admin who guesses the URL gets a 404 either way.
 */
export function navItems({ isAdmin }: { isAdmin: boolean }): NavItem[] {
  return isAdmin ? [...BASE_ITEMS, ADMIN_ITEM] : BASE_ITEMS;
}
