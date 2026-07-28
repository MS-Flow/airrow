// Full project list (spec 19) — the dashboard shows the recent few, this shows all.
import Link from "next/link";
import { Plus } from "lucide-react";
import { PageContainer } from "@/components/shell/page-container";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/states";
import { ProjectRow } from "@/features/projects/ProjectCard";
import { requireSession } from "@/lib/auth";
import { listProjects } from "@/lib/data/store";

export const metadata = { title: "Projects" };

export default async function ProjectsPage() {
  const { org } = await requireSession();
  const projects = await listProjects(org.id);

  return (
    <PageContainer>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-fg">Projects</h1>
          <p className="mt-1 text-base text-fg-muted">
            {projects.length} project{projects.length === 1 ? "" : "s"} in {org.name}
          </p>
        </div>
        <Button asChild>
          <Link href="/app/projects/new">
            <Plus className="size-4" />
            New project
          </Link>
        </Button>
      </div>

      {projects.length === 0 ? (
        <EmptyState
          className="mt-8"
          title="No projects yet"
          description="Every Airrow project starts with a short interview about what you're building."
          action={
            <Button asChild>
              <Link href="/app/projects/new">Start the interview</Link>
            </Button>
          }
        />
      ) : (
        <div className="mt-8 space-y-2">
          {projects.map((p) => (
            <ProjectRow key={p.id} project={p} />
          ))}
        </div>
      )}
    </PageContainer>
  );
}
