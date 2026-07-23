// Project overview (F-205 FR-4): status-aware router to the flow's next step.
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Download, FolderTree, Trash2 } from "lucide-react";
import { Badge, Button, Card, Separator } from "@/components/ui";
import { requireSession } from "@/lib/auth";
import { getProject, latestJob, loadArtifact } from "@/lib/data/store";
import { deleteProjectAction } from "@/features/projects/actions";
import { timeAgo } from "@/lib/utils";

export const metadata = { title: "Project" };

export default async function ProjectOverview({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { org } = await requireSession();
  const project = getProject(org.id, id);
  if (!project) notFound();

  const job = latestJob(id);
  const artifact = job && job.status === "completed" ? loadArtifact(job.id) : null;

  const primary =
    project.status === "interviewing"
      ? { href: `/app/projects/${id}/interview`, label: "Resume interview" }
      : project.status === "generating"
        ? { href: `/app/projects/${id}/generating`, label: "View generation progress" }
        : project.status === "failed"
          ? { href: `/app/projects/${id}/generating`, label: "View error & retry" }
          : { href: `/app/projects/${id}/preview`, label: "Browse your foundation" };

  return (
    <div className="mx-auto max-w-3xl px-8 py-10">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold tracking-tight text-fg">{project.name}</h1>
            <Badge
              tone={
                project.status === "ready"
                  ? "success"
                  : project.status === "failed"
                    ? "danger"
                    : "accent"
              }
            >
              {project.status === "interviewing"
                ? "Interview in progress"
                : project.status === "generating"
                  ? "Generating"
                  : project.status === "failed"
                    ? "Generation failed"
                    : "Ready"}
            </Badge>
          </div>
          <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-fg-muted">
            {project.description}
          </p>
          <p className="mt-2 font-mono text-xs text-fg-faint">
            {project.slug} · updated {timeAgo(project.updatedAt)}
          </p>
        </div>
      </div>

      <Card className="mt-8 p-6">
        <h2 className="text-sm font-semibold text-fg">Next step</h2>
        <p className="mt-1 text-[13px] text-fg-muted">
          {project.status === "interviewing"
            ? "Finish the CTO interview to generate your foundation."
            : project.status === "generating"
              ? "Arrow is authoring your repository right now."
              : project.status === "failed"
                ? "Generation hit a problem — review the error and retry."
                : `Your foundation is ready: ${artifact ? artifact.manifest.fileCount : "—"} files, generated ${job?.finishedAt ? timeAgo(job.finishedAt) : ""}.`}
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link href={primary.href}>
            <Button>
              {primary.label}
              <ArrowRight className="size-4" />
            </Button>
          </Link>
          {project.status === "ready" ? (
            <>
              <a href={`/api/projects/${id}/zip`}>
                <Button variant="secondary">
                  <Download className="size-4" />
                  Download ZIP
                </Button>
              </a>
              <Link href={`/app/projects/${id}/continue`}>
                <Button variant="secondary">
                  <FolderTree className="size-4" />
                  Continue locally
                </Button>
              </Link>
            </>
          ) : null}
        </div>
      </Card>

      <Separator className="my-10" />

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-fg">Delete project</h2>
          <p className="mt-1 text-[13px] text-fg-muted">
            Removes the interview, generated foundation, and history. No undo.
          </p>
        </div>
        <form action={deleteProjectAction}>
          <input type="hidden" name="projectId" value={project.id} />
          <Button variant="danger" size="sm" type="submit">
            <Trash2 className="size-3.5" />
            Delete
          </Button>
        </form>
      </div>
    </div>
  );
}
