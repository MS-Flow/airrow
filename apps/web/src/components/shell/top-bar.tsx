"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Plus, Search } from "lucide-react";
import { Breadcrumbs, type Crumb } from "@/components/ui/breadcrumbs";
import { Button } from "@/components/ui/button";

const SEGMENT_LABELS: Record<string, string> = {
  new: "New project",
  interview: "Interview",
  generating: "Generating",
  preview: "Preview",
  docs: "Documentation",
  continue: "Continue locally",
  settings: "Settings",
  templates: "Templates",
  prompts: "Prompts"
};

/** Derives the trail from the URL; project ids become their name via `projectNames`. */
export function buildCrumbs(pathname: string, projectNames: Record<string, string>): Crumb[] {
  const parts = pathname.split("/").filter(Boolean).slice(1); // drop "app"
  if (parts.length === 0) return [{ label: "Projects" }];

  const top = parts[0] ?? "";
  if (top !== "projects") return [{ label: SEGMENT_LABELS[top] ?? top }];

  const crumbs: Crumb[] = [{ label: "Projects", href: "/app" }];
  const second = parts[1];
  if (!second) return [{ label: "Projects" }];

  if (second === "new") return [...crumbs, { label: SEGMENT_LABELS.new ?? "New project" }];

  crumbs.push({ label: projectNames[second] ?? "Project", href: `/app/projects/${second}` });
  const third = parts[2];
  if (third) crumbs.push({ label: SEGMENT_LABELS[third] ?? third });
  return crumbs;
}

export function TopBar({ projectNames }: { projectNames: Record<string, string> }) {
  const pathname = usePathname();
  const crumbs = buildCrumbs(pathname, projectNames);

  return (
    <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center justify-between gap-4 border-b border-border bg-bg/80 px-6 backdrop-blur-md max-md:pl-14">
      <Breadcrumbs items={crumbs} />
      <div className="flex shrink-0 items-center gap-2">
        <span className="hidden items-center gap-1.5 rounded-md border border-border bg-bg-subtle px-2 py-1 text-xs text-fg-faint sm:flex">
          <Search className="size-3" />
          <kbd className="font-mono">⌘K</kbd>
        </span>
        <Button size="sm" asChild>
          <Link href="/app/projects/new">
            <Plus className="size-4" />
            New project
          </Link>
        </Button>
      </div>
    </header>
  );
}
