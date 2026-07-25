import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { ProjectStatus } from "@/lib/data/store";
import { cn, timeAgo } from "@/lib/utils";

type Tone = "neutral" | "accent" | "info" | "success" | "danger";

export const STATUS_META: Record<ProjectStatus, { label: string; tone: Tone }> = {
  interviewing: { label: "Interview in progress", tone: "accent" },
  generating: { label: "Generating", tone: "info" },
  ready: { label: "Ready", tone: "success" },
  failed: { label: "Generation failed", tone: "danger" }
};

/** Where a project's status says the founder should go next. */
export function nextRoute(status: ProjectStatus, id: string): string {
  switch (status) {
    case "interviewing":
      return `/app/projects/${id}/interview`;
    case "generating":
      return `/app/projects/${id}/generating`;
    default:
      return `/app/projects/${id}`;
  }
}

export interface ProjectSummary {
  id: string;
  name: string;
  description: string;
  status: ProjectStatus;
  updatedAt: string;
}

export function ProjectRow({ project, className }: { project: ProjectSummary; className?: string }) {
  const meta = STATUS_META[project.status];
  return (
    <Link href={nextRoute(project.status, project.id)} className={cn("group block", className)}>
      <Card interactive className="flex items-center justify-between gap-4 px-5 py-4">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <span className="truncate text-md font-medium text-fg">{project.name}</span>
            <Badge tone={meta.tone}>{meta.label}</Badge>
          </div>
          <p className="mt-1 truncate text-sm text-fg-muted">{project.description}</p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <span className="text-xs text-fg-faint">{timeAgo(project.updatedAt)}</span>
          <ArrowRight className="size-4 text-fg-faint transition-transform group-hover:translate-x-0.5 group-hover:text-fg-muted" />
        </div>
      </Card>
    </Link>
  );
}
