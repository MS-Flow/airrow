// ZIP delivery (F-403). Org-scoped, latest ready artifact, root = project slug.
import JSZip from "jszip";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getProject, latestJob, loadArtifact, recordDelivery } from "@/lib/data/store";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const project = await getProject(session.org.id, id);
  if (!project) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const job = await latestJob(id);
  const artifact = job && job.status === "completed" ? await loadArtifact(job.id) : null;
  if (!job || !artifact) return NextResponse.json({ error: "no_ready_artifact" }, { status: 409 });

  const zip = new JSZip();
  for (const file of artifact.files) {
    // Paths come from the manifest only (F-403 Security) — never from the client.
    zip.file(`${project.slug}/${file.path}`, file.content);
  }
  const bytes = await zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });

  await recordDelivery(id, job.id, "zip");

  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${project.slug}-foundation.zip"`
    }
  });
}
