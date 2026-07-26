// Project workspace: what was generated, and every way out of here.
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowRight,
  BookOpen,
  Boxes,
  Download,
  FileCode2,
  FolderTree,
  Github,
  Map
} from "lucide-react";
import { PageContainer } from "@/components/shell/page-container";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ComingSoon } from "@/components/ui/states";
import { DeleteProjectDialog } from "@/features/projects/DeleteProjectDialog";
import { STATUS_META } from "@/features/projects/ProjectCard";
import { deleteProjectAction } from "@/features/projects/actions";
import { requireSession } from "@/lib/auth";
import { getProject, latestJob, loadArtifact } from "@/lib/data/store";
import { timeAgo } from "@/lib/utils";

export const metadata = { title: "Project" };

/** Sections of the foundation, each deep-linking into the preview browser. */
const SECTIONS = [
  { icon: Boxes, title: "Architecture", file: "docs/architecture/SYSTEM_OVERVIEW.md" },
  { icon: FileCode2, title: "Specifications", file: "specs/README.md" },
  { icon: Map, title: "Roadmap", file: "docs/ROADMAP.md" },
  { icon: BookOpen, title: "Getting started", file: "START_HERE.md" }
];

export default async function ProjectOverview({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { org } = await requireSession();
  const project = await getProject(org.id, id);
  if (!project) notFound();

  const job = await latestJob(id);
  const artifact = job && job.status === "completed" ? await loadArtifact(job.id) : null;
  const meta = STATUS_META[project.status];
  const ready = project.status === "ready";

  const filesByPath = new Set(artifact?.files.map((f) => f.path) ?? []);

  const primary = ready
    ? { href: `/app/projects/${id}/preview`, label: "Browse your foundation" }
    : project.status === "interviewing"
      ? { href: `/app/projects/${id}/interview`, label: "Resume interview" }
      : project.status === "generating"
        ? { href: `/app/projects/${id}/generating`, label: "View generation progress" }
        : { href: `/app/projects/${id}/generating`, label: "View error & retry" };

  return (
    <PageContainer>
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight text-fg">{project.name}</h1>
        <Badge tone={meta.tone}>{meta.label}</Badge>
      </div>
      <p className="mt-2 max-w-2xl text-base leading-relaxed text-fg-muted">{project.description}</p>
      <p className="mt-2 font-mono text-xs text-fg-faint">
        {project.slug} · updated {timeAgo(project.updatedAt)}
      </p>

      <Card className="mt-8">
        <CardBody className="p-6">
          <h2 className="text-base font-semibold text-fg">Next step</h2>
          <p className="mt-1 text-sm text-fg-muted">
            {ready
              ? `Your foundation is ready: ${artifact ? artifact.manifest.fileCount : "—"} files, generated ${job?.finishedAt ? timeAgo(job.finishedAt) : ""}.`
              : project.status === "interviewing"
                ? "Finish the CTO interview to generate your foundation."
                : project.status === "generating"
                  ? "Airrow is authoring your repository right now."
                  : "Generation hit a problem — review the error and retry."}
          </p>
          <div className="mt-5 flex flex-wrap gap-2.5">
            <Button asChild>
              <Link href={primary.href}>
                {primary.label}
                <ArrowRight className="size-4" />
              </Link>
            </Button>
            {ready ? (
              <>
                <Button variant="secondary" asChild>
                  <a href={`/api/projects/${id}/zip`}>
                    <Download className="size-4" />
                    Download project
                  </a>
                </Button>
                <Button variant="secondary" asChild>
                  <Link href={`/app/projects/${id}/continue`}>
                    <FolderTree className="size-4" />
                    Continue in VS Code
                  </Link>
                </Button>
                <Button variant="secondary" disabled title="Connect a GitHub App to enable">
                  <Github className="size-4" />
                  Open GitHub
                </Button>
              </>
            ) : null}
          </div>
        </CardBody>
      </Card>

      {ready ? (
        <>
          <section className="mt-10">
            <h2 className="text-md font-semibold text-fg">Your foundation</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {SECTIONS.filter((s) => filesByPath.has(s.file)).map(({ icon: Icon, title, file }) => (
                <Link key={file} href={`/app/projects/${id}/preview?file=${encodeURIComponent(file)}`}>
                  <Card interactive className="h-full">
                    <CardBody className="p-5">
                      <Icon className="size-4 text-fg-faint" />
                      <h3 className="mt-3 text-base font-semibold text-fg">{title}</h3>
                      <p className="mt-1 truncate font-mono text-xs text-fg-faint">{file}</p>
                    </CardBody>
                  </Card>
                </Link>
              ))}
            </div>
          </section>

          {/* One way into the output. The docs reader was a second, near-identical view of
              the same files — the preview browser already renders them. */}
          <section className="mt-8">
            <Link href={`/app/projects/${id}/preview`}>
              <Card interactive className="h-full">
                <CardBody className="p-5">
                  <FolderTree className="size-4 text-fg-faint" />
                  <h3 className="mt-3 text-base font-semibold text-fg">Generated files</h3>
                  <p className="mt-1 text-sm text-fg-muted">
                    {artifact?.manifest.fileCount ?? 0} files, browsable and editable.
                  </p>
                </CardBody>
              </Card>
            </Link>
          </section>

          <ComingSoon
            className="mt-8"
            title="Milestone tracking"
            description="Your generated roadmap will track itself here as you ship each milestone."
          />
        </>
      ) : null}

      <Separator className="my-10" />

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-fg">Delete project</h2>
          <p className="mt-1 text-sm text-fg-muted">
            Removes the interview, generated foundation and history. No undo.
          </p>
        </div>
        <DeleteProjectDialog
          projectId={project.id}
          projectName={project.name}
          action={deleteProjectAction}
        />
      </div>
    </PageContainer>
  );
}
