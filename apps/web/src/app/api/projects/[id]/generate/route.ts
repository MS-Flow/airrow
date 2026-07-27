// Starts the queued generation job for a project, and returns once it has finished.
// The progress screen calls this on mount, so the work happens inside a request that is
// held open while the founder watches the stages land (F-401 FR-2).
//
// It has to be a request of its own: the submit action cannot both run the job and
// redirect to the screen that shows it, and a job detached from that action would be
// killed the moment the serverless invocation responds.
import { NextResponse } from "next/server";

/**
 * Authoring is one Claude call that writes 21 slots and 3 whole documents; measured against the live
 * API it takes ~20s. The platform default for a route handler is 10s, so without this the request is
 * killed mid-call, the job never completes, and the founder sees the generation hang — the exact
 * failure this endpoint was built to avoid.
 */
export const maxDuration = 60;
import { getSession } from "@/lib/auth";
import { getProject, latestJob, latestModelVersion } from "@/lib/data/store";
import { runGenerationJob } from "@/features/generation/runner";

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const project = await getProject(session.org.id, id);
  if (!project) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const job = await latestJob(id);
  if (!job) return NextResponse.json({ error: "no_job" }, { status: 409 });

  // Only a queued job may be started. Re-mounting the screen, a second tab or a refresh
  // all land here, and none of them should run the job twice or restart a finished one.
  if (job.status !== "queued") return NextResponse.json({ started: false, status: job.status });

  const mv = await latestModelVersion(id);
  if (!mv) return NextResponse.json({ error: "no_model" }, { status: 409 });

  await runGenerationJob(job.id, mv.model);
  const finished = await latestJob(id);
  return NextResponse.json({ started: true, status: finished?.status ?? "unknown" });
}
