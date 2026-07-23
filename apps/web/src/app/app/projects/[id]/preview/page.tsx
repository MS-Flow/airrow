// Repo preview (F-402): server loads artifact; client renders tree + markdown.
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { ArrowRight, Download } from "lucide-react";
import { Button } from "@/components/ui";
import { requireSession } from "@/lib/auth";
import { getProject, latestJob, loadArtifact } from "@/lib/data/store";
import { PreviewBrowser } from "@/features/preview/PreviewBrowser";

export const metadata = { title: "Preview" };

export default async function PreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { org } = await requireSession();
  const project = getProject(org.id, id);
  if (!project) notFound();
  if (project.status !== "ready") redirect(`/app/projects/${id}`);

  const job = latestJob(id);
  const artifact = job && job.status === "completed" ? loadArtifact(job.id) : null;
  if (!artifact) redirect(`/app/projects/${id}`);

  return (
    <div>
      <header className="flex items-center justify-between border-b border-border px-6 py-3">
        <div className="flex items-baseline gap-3">
          <Link href={`/app/projects/${id}`} className="text-sm font-semibold text-fg hover:text-accent">
            {project.name}
          </Link>
          <span className="font-mono text-xs text-fg-faint">
            {artifact.manifest.fileCount} files · engine v{artifact.manifest.engineVersion}
          </span>
        </div>
        <div className="flex items-center gap-2.5">
          <a href={`/api/projects/${id}/zip`}>
            <Button size="sm">
              <Download className="size-3.5" />
              Download ZIP
            </Button>
          </a>
          <Link href={`/app/projects/${id}/continue`}>
            <Button variant="secondary" size="sm">
              Continue locally
              <ArrowRight className="size-3.5" />
            </Button>
          </Link>
        </div>
      </header>
      <Suspense>
        <PreviewBrowser files={artifact.files.map((f) => ({ path: f.path, content: f.content }))} />
      </Suspense>
    </div>
  );
}
