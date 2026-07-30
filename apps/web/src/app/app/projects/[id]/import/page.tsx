// Import review (spec 63): what the analysis derived, and — once generation has run — what the
// output would do to the founder's project. Nothing here writes files; it records decisions.
import { notFound } from "next/navigation";
import Link from "next/link";
import { diffAgainstExisting } from "@airrow/engine";
import type { GeneratedFile } from "@airrow/schemas";
import { PageContainer } from "@/components/shell/page-container";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";
import { requireSession } from "@/lib/auth";
import {
  getImportSource,
  getProject,
  latestJob,
  listConflictResolutions,
  listImportFiles,
  loadArtifact
} from "@/lib/data/store";
import { digestFor } from "@/features/import/digest";
import { AnalysisEvidence, AnalysisNotes } from "@/features/import/AnalysisEvidence";
import { ConflictRow } from "@/features/import/ConflictRow";

export const metadata = { title: "Import review" };

export default async function ImportReview({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { org } = await requireSession();
  const project = await getProject(org.id, id);
  if (!project) notFound();

  const source = await getImportSource(id);
  if (!source) notFound();

  const job = await latestJob(id);
  const artifact = job && job.status === "completed" ? await loadArtifact(job.id) : null;

  return (
    <PageContainer className="max-w-3xl animate-slide-up py-12">
      <h1 className="text-2xl font-semibold tracking-tight text-fg">Import review</h1>
      <p className="mt-2 text-base leading-relaxed text-fg-muted">
        Read from <span className="font-mono text-sm">{source.originalName}</span> —{" "}
        {source.filesAnalyzed} files analysed, {source.filesIgnored} skipped.
      </p>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>What Airrow could work out</CardTitle>
        </CardHeader>
        <CardBody className="p-0">
          <AnalysisEvidence evidence={source.analysis.evidence} />
        </CardBody>
      </Card>

      <AnalysisNotes notes={source.analysis.notes} />

      {artifact && job ? (
        <ImportDiffSection
          projectId={id}
          jobId={job.id}
          sourceId={source.id}
          digestVersion={source.digestVersion}
          files={artifact.files}
        />
      ) : (
        <EmptyState
          className="mt-6"
          title="No generated output yet"
          description="Finish the interview and generate — the diff against your project appears here, before anything is written."
          action={
            <Button asChild>
              <Link href={`/app/projects/${id}/interview`}>Continue the interview</Link>
            </Button>
          }
        />
      )}
    </PageContainer>
  );
}

async function ImportDiffSection({
  projectId,
  jobId,
  sourceId,
  digestVersion,
  files
}: {
  projectId: string;
  jobId: string;
  sourceId: string;
  digestVersion: number;
  files: GeneratedFile[];
}) {
  const [existing, decisions] = await Promise.all([
    listImportFiles(sourceId),
    listConflictResolutions(jobId)
  ]);
  // Hashed with the same key the import was stored under, so a rotated pepper doesn't turn every
  // file into a conflict (spec 68).
  const diff = diffAgainstExisting(files, existing, digestFor(digestVersion));

  return (
    <>
      <div className="mt-8 flex flex-wrap gap-2">
        <Badge tone="success">{diff.added.length} new files</Badge>
        <Badge tone="neutral">{diff.identical.length} already identical</Badge>
        <Badge tone="info">{diff.conflicts.length} conflicts</Badge>
      </div>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Conflicts</CardTitle>
          {diff.conflicts.length > 0 ? (
            <p className="mt-1 text-sm text-fg-muted">
              Each row says what its download contains. Press the chosen answer again to make it
              undecided.
            </p>
          ) : null}
        </CardHeader>
        <CardBody className="p-0">
          {diff.conflicts.length === 0 ? (
            <p className="px-5 py-4 text-sm text-fg-muted">
              Nothing Airrow generated collides with a file you already have.
            </p>
          ) : (
            <ul>
              {diff.conflicts.map((entry) => (
                <ConflictRow
                  key={entry.path}
                  projectId={projectId}
                  entry={entry}
                  decision={decisions.get(entry.path)}
                />
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>New files</CardTitle>
        </CardHeader>
        <CardBody className="p-0">
          <ul>
            {diff.added.map((entry) => (
              <li key={entry.path} className="border-b border-border px-5 py-2.5 last:border-b-0">
                <span className="font-mono text-xs text-fg-muted">{entry.path}</span>
              </li>
            ))}
          </ul>
        </CardBody>
      </Card>

      <p className="mt-6 text-sm text-fg-faint">
        The download contains the new files plus any conflict you chose to take from Airrow. Where you
        have not decided, your version keeps its path and Airrow&rsquo;s arrives beside it as{" "}
        <span className="font-mono text-xs">.airrow.md</span> — nothing of yours is overwritten, and{" "}
        <span className="font-mono text-xs">/cleanup</span> works through both. Choose{" "}
        <em>Keep mine</em> and Airrow&rsquo;s version is not delivered at all. Your project&rsquo;s
        structure sits in the{" "}
        <Link href={`/app/projects/${projectId}/preview`} className="text-fg underline-offset-4 hover:underline">
          preview
        </Link>
        , in one tree with Airrow&rsquo;s files.
      </p>
    </>
  );
}
