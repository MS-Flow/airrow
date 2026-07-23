// Job status polling endpoint (F-401 FR-3). Org-scoped; detects stale jobs.
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getProject, latestJob, setProjectStatus, updateJob } from "@/lib/data/store";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const project = getProject(session.org.id, id);
  if (!project) return NextResponse.json({ error: "not_found" }, { status: 404 });

  let job = latestJob(id);
  if (job && job.status === "running") {
    const age = Date.now() - new Date(job.heartbeatAt).getTime();
    if (age > 60_000) {
      // Dev-server restart mid-job (F-401 risk): mark failed, offer retry.
      updateJob(job.id, { status: "failed", error: "Generation was interrupted. Retry to regenerate." });
      setProjectStatus(id, "failed");
      job = latestJob(id);
    }
  }
  return NextResponse.json({ job, projectStatus: getProject(session.org.id, id)?.status ?? null });
}
