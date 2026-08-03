// Starts the queued generation job for a project, and returns once it has finished.
// The progress screen calls this on mount, so the work happens inside a request that is
// held open while the founder watches the stages land (F-401 FR-2).
//
// It has to be a request of its own: the submit action cannot both run the job and
// redirect to the screen that shows it, and a job detached from that action would be
// killed the moment the serverless invocation responds.
import { NextResponse } from "next/server";

/**
 * Authoring is two Claude calls — the slots plus three documents, and the UI build brief — measured
 * at ~20s each against the live API. The platform default for a route handler is 10s, so without this
 * the request is killed mid-call, the job never completes, and the founder sees the generation hang —
 * the exact failure this endpoint was built to avoid.
 *
 * The two calls are fired together rather than in sequence (`author.ts`), which is what keeps the
 * budget honest: run one after the other, their latencies added up and a working generation reported
 * itself interrupted (spec 128). This ceiling is the plan's, not a preference — raising it past 60
 * requires a Vercel plan that allows it.
 */
export const maxDuration = 60;
import { getSession } from "@/lib/auth";
import { matureReferral } from "@/lib/data/referrals";
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

  await runGenerationJob(job.id, mv.model, session.org.id);
  const finished = await latestJob(id);

  // If somebody invited this founder, this is the moment it was worth something (spec 122). Here
  // rather than inside the runner because the organization is already established here and the runner
  // only knows a project — and `matureReferral` re-reads the charged ledger itself, so a job that
  // completed but was memoised still earns nobody a week.
  if (finished?.status === "completed") await matureReferral(session.org.id);

  return NextResponse.json({ started: true, status: finished?.status ?? "unknown" });
}
