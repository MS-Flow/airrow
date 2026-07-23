// Dashboard (F-205 FR-2): projects + one primary action.
import Link from "next/link";
import { Plus, ArrowRight } from "lucide-react";
import { Badge, Button, Card } from "@/components/ui";
import { requireSession } from "@/lib/auth";
import { listProjects, type ProjectStatus } from "@/lib/data/store";
import { timeAgo } from "@/lib/utils";

const statusMeta: Record<ProjectStatus, { label: string; tone: "neutral" | "accent" | "success" | "danger" }> = {
  interviewing: { label: "Interview in progress", tone: "accent" },
  generating: { label: "Generating", tone: "accent" },
  ready: { label: "Ready", tone: "success" },
  failed: { label: "Generation failed", tone: "danger" }
};

const nextRoute: Record<ProjectStatus, (id: string) => string> = {
  interviewing: (id) => `/app/projects/${id}/interview`,
  generating: (id) => `/app/projects/${id}/generating`,
  ready: (id) => `/app/projects/${id}`,
  failed: (id) => `/app/projects/${id}`
};

export const metadata = { title: "Projects" };

export default async function Dashboard() {
  const { org, user } = await requireSession();
  const projects = listProjects(org.id);

  return (
    <div className="mx-auto max-w-4xl px-8 py-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-fg">Projects</h1>
          <p className="mt-1 text-sm text-fg-muted">
            {projects.length === 0
              ? `Welcome, ${user.name.split(" ")[0]}.`
              : `${projects.length} project${projects.length === 1 ? "" : "s"} in ${org.name}`}
          </p>
        </div>
        <Link href="/app/projects/new">
          <Button>
            <Plus className="size-4" />
            New project
          </Button>
        </Link>
      </div>

      {projects.length === 0 ? (
        <Card className="mt-10 flex flex-col items-center px-8 py-16 text-center">
          <div className="flex size-12 items-center justify-center rounded-lg border border-border bg-surface-raised font-mono text-lg text-accent">
            →
          </div>
          <h2 className="mt-5 text-[15px] font-semibold text-fg">Create your first project</h2>
          <p className="mt-2 max-w-sm text-sm leading-relaxed text-fg-muted">
            Describe your product, answer the CTO interview, and Airrow generates your complete
            engineering foundation — ready for Claude Code.
          </p>
          <Link href="/app/projects/new" className="mt-6">
            <Button>Start the interview</Button>
          </Link>
        </Card>
      ) : (
        <div className="mt-8 space-y-2">
          {projects.map((p) => {
            const meta = statusMeta[p.status];
            return (
              <Link key={p.id} href={nextRoute[p.status](p.id)} className="block">
                <Card className="group flex items-center justify-between px-5 py-4 transition-colors hover:border-border-strong">
                  <div className="min-w-0">
                    <div className="flex items-center gap-3">
                      <span className="truncate text-[15px] font-medium text-fg">{p.name}</span>
                      <Badge tone={meta.tone}>{meta.label}</Badge>
                    </div>
                    <p className="mt-1 truncate text-[13px] text-fg-muted">{p.description}</p>
                  </div>
                  <div className="ml-4 flex shrink-0 items-center gap-3">
                    <span className="text-xs text-fg-faint">{timeAgo(p.updatedAt)}</span>
                    <ArrowRight className="size-4 text-fg-faint transition-transform group-hover:translate-x-0.5 group-hover:text-fg-muted" />
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
