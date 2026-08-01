"use client";

// The five surfaces, as links rather than as a client-side tab widget.
//
// Radix's Tabs would need every panel's data loaded at once, which is the opposite of what these
// screens want — each one paginates and filters through its own search params, and each is a Server
// Component that reads only what it shows. So the tab row is links, and the browser does the switching.
//
// The only reason this is a client component at all is `usePathname`, to know which one is current.
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/app/admin", label: "Users" },
  { href: "/app/admin/projects", label: "Projects" },
  { href: "/app/admin/tickets", label: "Tickets" },
  { href: "/app/admin/reviews", label: "Reviews" },
  { href: "/app/admin/stats", label: "Statistics" }
] as const;

export function AdminTabs() {
  const pathname = usePathname();

  return (
    // Wrapping rather than scrolling (spec 164): `overflow-x-auto` put a horizontal scrollbar across
    // the tab names on every desktop that renders one, to scroll a row that is a few pixels too wide.
    // Five short labels wrap onto a second line on a phone and cost nothing anywhere else.
    <nav className="mt-6 flex flex-wrap items-center gap-1 border-b border-border">
      {TABS.map((tab) => {
        // Users lives at the bare route, so it can only match exactly — a `startsWith` would light it
        // up on every other tab as well.
        const active = tab.href === "/app/admin" ? pathname === tab.href : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "-mb-px shrink-0 border-b-2 px-3 py-2.5 text-base font-medium transition-colors",
              active
                ? "border-fg text-fg"
                : "border-transparent text-fg-muted hover:text-fg"
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
