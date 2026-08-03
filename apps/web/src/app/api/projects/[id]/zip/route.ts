// ZIP delivery (F-403). Org-scoped, latest ready artifact, root = project slug.
import JSZip from "jszip";
import { NextResponse } from "next/server";
import { applyResolutions } from "@airrow/engine";
import { distinctIdForOrg } from "@/features/analytics/events";
import { capture } from "@/features/analytics/server";
import { getSession } from "@/lib/auth";
import {
  getImportSource,
  getProject,
  latestJob,
  listConflictResolutions,
  listImportFiles,
  loadArtifact,
  recordDelivery
} from "@/lib/data/store";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const project = await getProject(session.org.id, id);
  if (!project) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const job = await latestJob(id);
  const artifact = job && job.status === "completed" ? await loadArtifact(job.id) : null;
  if (!job || !artifact) return NextResponse.json({ error: "no_ready_artifact" }, { status: 409 });

  // An imported project ships only what it is safe to write: new files, plus the conflicts the
  // founder explicitly took from Airrow. Undecided conflicts keep their version (spec 63).
  const source = await getImportSource(id);
  const files = source
    ? applyResolutions(
        artifact.files,
        await listImportFiles(source.id),
        await listConflictResolutions(job.id)
      )
    : artifact.files;

  const zip = new JSZip();
  for (const file of files) {
    // Paths come from the manifest only (F-403 Security) — never from the client.
    zip.file(`${project.slug}/${file.path}`, file.content);
  }
  const bytes = await zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });

  await recordDelivery(id, job.id, "zip");
  // Beside the delivery row rather than instead of it: the row is the record, this is the funnel
  // step (spec 182). Both are only reached once the bytes exist, so neither can claim a download
  // that failed to build.
  capture("zip_downloaded", distinctIdForOrg(session.org.id), { project: id });

  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${project.slug}-foundation.zip"`
    }
  });
}
