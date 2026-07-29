// Dashboard: what you were doing, what to do next, and what is coming.
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { PageContainer } from "@/components/shell/page-container";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";
import { ProjectActions } from "@/features/projects/ProjectActions";
import { ProjectRow, nextRoute } from "@/features/projects/ProjectCard";
import { requireSession } from "@/lib/auth";
import { listProjects } from "@/lib/data/store";
import { timeAgo } from "@/lib/utils";

export const metadata = { title: "Dashboard" };

export default async function Dashboard() {
  const { org, user } = await requireSession();
  const projects = await listProjects(org.id);
  const recent = projects.slice(0, 4);
  const inFlight = projects.find((p) => p.status === "interviewing" || p.status === "generating");
  const firstName = user.name.split(" ")[0] ?? user.name;

  return (
    <PageContainer>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-fg">
            Welcome back, {firstName}.
          </h1>
          <p className="mt-1 text-base text-fg-muted">
            {projects.length === 0
              ? "Let's build your first engineering foundation."
              : `${projects.length} project${projects.length === 1 ? "" : "s"} in ${org.name}`}
          </p>
        </div>
        <ProjectActions />
      </div>

      {inFlight ? (
        <Card interactive className="mt-8">
          <CardBody className="flex flex-wrap items-center justify-between gap-4 p-5">
            <div className="min-w-0">
              <p className="text-2xs font-medium uppercase tracking-wide text-fg-faint">
                Continue where you left off
              </p>
              <p className="mt-1.5 truncate text-md font-medium text-fg">{inFlight.name}</p>
              <p className="mt-0.5 text-sm text-fg-muted">
                {inFlight.status === "interviewing"
                  ? "The CTO interview is unfinished."
                  : "Generation is running."}
              </p>
            </div>
            <Button variant="secondary" asChild>
              <Link href={nextRoute(inFlight.status, inFlight.id)}>
                Resume
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </CardBody>
        </Card>
      ) : null}

      <section className="mt-10">
        <div className="flex items-center justify-between">
          <h2 className="text-md font-semibold text-fg">Recent projects</h2>
          {projects.length > recent.length ? (
            <Link href="/app/projects" className="text-sm text-fg-muted transition-colors hover:text-fg">
              View all
            </Link>
          ) : null}
        </div>

        {projects.length === 0 ? (
          <EmptyState
            className="mt-4"
            title="Create your first project"
            description="Describe your product, answer the CTO interview, and Airrow generates your complete engineering foundation — ready for Claude Code."
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
          <div className="mt-4 space-y-2">
            {recent.map((p) => (
              <ProjectRow key={p.id} project={p} />
            ))}
          </div>
        )}
      </section>

      <section className="mt-10">
        <h2 className="text-md font-semibold text-fg">Recent generations</h2>
        {projects.filter((p) => p.status === "ready").length === 0 ? (
          <p className="mt-3 text-sm text-fg-faint">
            Nothing generated yet — finish an interview and your foundation appears here.
          </p>
        ) : (
          <div className="mt-4 space-y-2">
            {projects
              .filter((p) => p.status === "ready")
              .slice(0, 3)
              .map((p) => (
                <Link key={p.id} href={`/app/projects/${p.id}/preview`} className="block">
                  <Card interactive className="flex items-center justify-between px-5 py-3.5">
                    <span className="truncate text-base text-fg">{p.name}</span>
                    <span className="shrink-0 text-xs text-fg-faint">{timeAgo(p.updatedAt)}</span>
                  </Card>
                </Link>
              ))}
          </div>
        )}
      </section>
    </PageContainer>
  );
}
