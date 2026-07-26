/** The app's primary navigation, shared by the sidebar and the command palette. */
export interface NavItem {
  href: string;
  label: string;
  /** Lucide icon name, resolved by the sidebar so this file stays serialisable. */
  icon: "projects" | "settings";
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/app", label: "Projects", icon: "projects" },
  { href: "/app/settings", label: "Settings", icon: "settings" }
];
