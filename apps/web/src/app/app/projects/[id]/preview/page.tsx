// Repo preview: the server loads the artifact and highlights the active file;
// the client renders the tree and the reader.
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { ArrowRight, BookOpen, Download, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LoadingState } from "@/components/ui/states";
import { requireSession } from "@/lib/auth";
import { getProject, latestJob, loadArtifact } from "@/lib/data/store";
import { PreviewBrowser } from "@/features/preview/PreviewBrowser";
import { highlight } from "@/features/preview/highlight";

export const metadata = { title: "Preview" };

export default async function PreviewPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ file?: string }>;
}) {
  const { id } = await params;
  const { file } = await searchParams;
  const { org } = await requireSession();
  const project = await getProject(org.id, id);
  if (!project) notFound();
  if (project.status !== "ready") redirect(`/app/projects/${id}`);

  const job = await latestJob(id);
  const artifact = job && job.status === "completed" ? await loadArtifact(job.id) : null;
  if (!artifact) redirect(`/app/projects/${id}`);

  const files = artifact.files.map((f) => ({ path: f.path, content: f.content }));
  const activePath = file && files.some((f) => f.path === file) ? file : "README.md";
  const active = files.find((f) => f.path === activePath);
  // Markdown is rendered (and sanitized) client-side; code is highlighted here.
  const highlighted =
    active && !activePath.endsWith(".md") ? await highlight(active.content, activePath) : null;

  return (
    <div>
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-6 py-3">
        <div className="flex items-baseline gap-3">
          <Link
            href={`/app/projects/${id}`}
            className="text-base font-semibold text-fg transition-colors hover:text-fg-muted"
          >
            {project.name}
          </Link>
          <span className="font-mono text-xs text-fg-faint">
            {artifact.manifest.fileCount} files · engine v{artifact.manifest.engineVersion}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" asChild>
            <Link href={`/app/projects/${id}/interview`}>
              <Undo2 className="size-3.5" />
              Change answers
            </Link>
          </Button>
          <Button variant="ghost" size="sm" asChild>
            <Link href={`/app/projects/${id}/docs`}>
              <BookOpen className="size-3.5" />
              Docs
            </Link>
          </Button>
          <Button size="sm" asChild>
            <a href={`/api/projects/${id}/zip`}>
              <Download className="size-3.5" />
              Download ZIP
            </a>
          </Button>
          <Button variant="secondary" size="sm" asChild>
            <Link href={`/app/projects/${id}/continue`}>
              Continue locally
              <ArrowRight className="size-3.5" />
            </Link>
          </Button>
        </div>
      </header>
      <Suspense fallback={<LoadingState className="p-8" />}>
        <PreviewBrowser
          projectId={id}
          files={files}
          highlightedHtml={highlighted}
          highlightedFor={highlighted ? activePath : null}
        />
      </Suspense>
    </div>
  );
}
