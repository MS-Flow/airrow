// Documentation reader for the generated project's docs.
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { FolderTree } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/states";
import { DocsReader, type DocFile } from "@/features/docs/DocsReader";
import { requireSession } from "@/lib/auth";
import { getProject, latestJob, loadArtifact } from "@/lib/data/store";

export const metadata = { title: "Documentation" };

/** First markdown heading, falling back to the file name. */
function titleOf(path: string, content: string): string {
  const heading = content.split("\n").find((line) => line.startsWith("# "));
  return heading ? heading.slice(2).trim() : (path.split("/").pop() ?? path);
}

export default async function ProjectDocsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { org } = await requireSession();
  const project = await getProject(org.id, id);
  if (!project) notFound();
  if (project.status !== "ready") redirect(`/app/projects/${id}`);

  const job = await latestJob(id);
  const artifact = job && job.status === "completed" ? await loadArtifact(job.id) : null;
  if (!artifact) redirect(`/app/projects/${id}`);

  const docs: DocFile[] = artifact.files
    .filter((f) => f.path.startsWith("docs/") && f.path.endsWith(".md"))
    .map((f) => ({ path: f.path, title: titleOf(f.path, f.content), content: f.content }));

  if (docs.length === 0) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-16">
        <EmptyState
          title="No documentation in this foundation"
          description="This project's generated repository has no docs/ directory yet. Everything that was generated is in the file browser."
          action={
            <Button asChild>
              <Link href={`/app/projects/${id}/preview`}>
                <FolderTree className="size-4" />
                Browse files
              </Link>
            </Button>
          }
        />
      </div>
    );
  }

  return <DocsReader docs={docs} />;
}
