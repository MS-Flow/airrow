"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutGrid,
  LayoutTemplate,
  Menu,
  MessageSquareQuote,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  X
} from "lucide-react";
import { AirrowLogo } from "@/components/brand/logo";
import { AirrowMark } from "@/components/brand/mark";
import { Progress } from "@/components/ui/progress";
import { Tooltip } from "@/components/ui/tooltip";
import { NAV_ITEMS, type NavItem } from "./nav-items";
import { cn } from "@/lib/utils";

const icons = {
  projects: LayoutGrid,
  templates: LayoutTemplate,
  prompts: MessageSquareQuote,
  settings: Settings
} as const;

export interface GeneratingProject {
  id: string;
  name: string;
  percent: number;
}

function isActive(pathname: string, href: string): boolean {
  return href === "/app" ? pathname === "/app" || pathname.startsWith("/app/projects") : pathname.startsWith(href);
}

function NavLink({
  item,
  collapsed,
  onNavigate
}: {
  item: NavItem;
  collapsed: boolean;
  onNavigate: () => void;
}) {
  const pathname = usePathname();
  const Icon = icons[item.icon];
  const active = isActive(pathname, item.href);

  const link = (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium transition-colors",
        collapsed && "justify-center px-0",
        active ? "bg-surface text-fg" : "text-fg-muted hover:bg-surface hover:text-fg"
      )}
    >
      <Icon className="size-4 shrink-0" />
      {collapsed ? null : item.label}
    </Link>
  );

  return collapsed ? (
    <Tooltip content={item.label} side="right">
      {link}
    </Tooltip>
  ) : (
    link
  );
}

/**
 * Left rail. Collapses to icons on demand and at narrow widths; below the
 * mobile breakpoint it becomes a drawer opened from the top bar.
 */
export function Sidebar({
  footer,
  generating
}: {
  footer: React.ReactNode;
  generating: GeneratingProject | null;
}) {
  const [collapsed, setCollapsed] = React.useState(false);
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const closeDrawer = React.useCallback(() => setDrawerOpen(false), []);

  return (
    <>
      {/* Mobile: a button in the flow of the top bar opens the drawer. */}
      <button
        type="button"
        onClick={() => setDrawerOpen(true)}
        aria-label="Open navigation"
        className="fixed left-4 top-3.5 z-30 cursor-pointer rounded-md p-1.5 text-fg-muted transition-colors hover:bg-surface hover:text-fg md:hidden"
      >
        <Menu className="size-4" />
      </button>

      {drawerOpen ? (
        <button
          type="button"
          aria-label="Close navigation"
          onClick={closeDrawer}
          className="fixed inset-0 z-40 animate-fade-in cursor-default bg-bg/70 backdrop-blur-sm md:hidden"
        />
      ) : null}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex flex-col border-r border-border bg-bg-subtle transition-[width,transform] duration-200 ease-out-quart",
          collapsed ? "w-16" : "w-60",
          drawerOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        )}
      >
        <div className={cn("flex items-center justify-between px-4 py-5", collapsed && "px-0 justify-center")}>
          <Link href="/app" onClick={closeDrawer} aria-label="Airrow home">
            {collapsed ? <AirrowMark priority className="h-6" /> : <AirrowLogo priority />}
          </Link>
          <button
            type="button"
            onClick={closeDrawer}
            aria-label="Close navigation"
            className="cursor-pointer rounded-md p-1 text-fg-faint transition-colors hover:text-fg md:hidden"
          >
            <X className="size-4" />
          </button>
        </div>

        <nav className="flex-1 space-y-0.5 px-3">
          {NAV_ITEMS.map((item) => (
            <NavLink key={item.href} item={item} collapsed={collapsed} onNavigate={closeDrawer} />
          ))}
        </nav>

        {generating ? (
          <Link
            href={`/app/projects/${generating.id}/generating`}
            onClick={closeDrawer}
            className="mx-3 mb-3 block rounded-md border border-border bg-surface px-3 py-2.5 transition-colors hover:border-border-strong"
          >
            {collapsed ? (
              <Progress value={generating.percent} aria-label={`Generating ${generating.name}`} />
            ) : (
              <>
                <p className="truncate text-xs font-medium text-fg">{generating.name}</p>
                <p className="mb-2 mt-0.5 text-2xs text-fg-faint">Generating…</p>
                <Progress value={generating.percent} aria-label={`Generating ${generating.name}`} />
              </>
            )}
          </Link>
        ) : null}

        <div className={cn("border-t border-border p-3", collapsed && "px-2")}>{footer}</div>

        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="hidden cursor-pointer items-center gap-2.5 border-t border-border px-4 py-2.5 text-xs text-fg-faint transition-colors hover:text-fg md:flex"
        >
          {collapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
          {collapsed ? null : "Collapse"}
        </button>
      </aside>

      {/* Spacer keeps the content column in step with the rail's width. */}
      <div className={cn("hidden shrink-0 transition-[width] duration-200 md:block", collapsed ? "w-16" : "w-60")} />
    </>
  );
}
