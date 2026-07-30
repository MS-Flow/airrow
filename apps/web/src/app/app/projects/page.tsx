// Full project list (spec 19) — the dashboard shows the recent few, this shows all.
import Link from "next/link";
import { PageContainer } from "@/components/shell/page-container";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/states";
import { ProjectActions } from "@/features/projects/ProjectActions";
import { ProjectRow } from "@/features/projects/ProjectCard";
import { AllowanceNotice } from "@/features/generation/AllowanceNotice";
import { checkAllowance } from "@/features/generation/allowance";
import { requireSession } from "@/lib/auth";
import { listProjects } from "@/lib/data/store";

export const metadata = { title: "Projects" };

export default async function ProjectsPage() {
  const { user, org } = await requireSession();
  const projects = await listProjects(org.id);
  const allowance = await checkAllowance({ orgId: org.id, plan: org.plan, userId: user.id });

  return (
    <PageContainer>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-fg">Projects</h1>
          <p className="mt-1 text-base text-fg-muted">
            {projects.length} project{projects.length === 1 ? "" : "s"} in {org.name}
          </p>
        </div>
        <ProjectActions />
      </div>

      <AllowanceNotice allowance={allowance} className="mt-4 text-sm" />

      {projects.length === 0 ? (
        <EmptyState
          className="mt-8"
          title="No projects yet"
          description="Every Airrow project starts with a short interview about what you're building."
          action={
            <div className="flex flex-wrap items-center justify-center gap-2">
              <Button asChild>
                <Link href="/app/projects/new">Start the interview</Link>
              </Button>
              <Button variant="secondary" asChild>
                <Link href="/app/projects/import">Import an existing project</Link>
              </Button>
            </div>
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
