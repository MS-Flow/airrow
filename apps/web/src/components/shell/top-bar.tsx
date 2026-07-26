"use client";

import { usePathname } from "next/navigation";
import { Breadcrumbs, type Crumb } from "@/components/ui/breadcrumbs";
import { ProjectActions } from "@/features/projects/ProjectActions";

const SEGMENT_LABELS: Record<string, string> = {
  new: "New project",
  import: "Import",
  interview: "Interview",
  generating: "Generating",
  preview: "Preview",
  continue: "Continue locally",
  settings: "Settings"
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

export function TopBar({
  projectNames,
  themeSwitch,
  userMenu
}: {
  projectNames: Record<string, string>;
  /** Rendered on the server so the theme cookie is never read on the client. */
  themeSwitch: React.ReactNode;
  userMenu: React.ReactNode;
}) {
  const pathname = usePathname();
  const crumbs = buildCrumbs(pathname, projectNames);

  return (
    // `h-17` is the landing header's height (its `py-3.5` around an `h-10` logo), so
    // moving from the public site into the app doesn't shift the horizon line.
    <header className="sticky top-0 z-20 flex h-17 shrink-0 items-center justify-between gap-4 border-b border-border bg-bg/80 px-6 backdrop-blur-md max-md:pl-14">
      <Breadcrumbs items={crumbs} />
      <div className="flex shrink-0 items-center gap-2">
        <ProjectActions size="md" compact />
        {themeSwitch}
        {userMenu}
      </div>
    </header>
  );
}
