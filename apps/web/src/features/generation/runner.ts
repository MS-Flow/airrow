// Generation job runner (F-401 FR-2). Runs to completion inside the caller's request:
// awaited, never fire-and-forget. A serverless invocation is frozen the moment it
// responds, so a detached promise here is killed mid-flight and the job is left
// "running" forever — which is exactly what "Generation was interrupted" was.
//
// It is started by POST /api/projects/[id]/generate, which the progress screen calls once
// it is on screen, so the stages below are written while the founder is watching them.
//
// `generate()` itself is milliseconds, so the pacing is deliberate: without it the five
// stages resolve faster than a single poll and the screen jumps from empty to done. What
// is *not* faked is the order or the outcome — each stage is written when that stage has
// actually run, and nothing is reported complete before the artifact is saved. Per-file
// progress is gone, though: 20+ Postgres round-trips inside one request budget bought
// detail nobody could read at that speed.
import { generate } from "@airrow/engine";
import type { AnswerId, JobStage, ProjectModel } from "@airrow/schemas";
import {
  findAuthoredByInputs,
  getJob,
  previousCompletedJob,
  saveArtifact,
  saveAuthoringProvenance,
  setProjectStatus,
  updateJob
} from "@/lib/data/store";
import { distinctIdForOrg } from "@/features/analytics/events";
import { capture } from "@/features/analytics/server";
import { loadUiReferenceImages } from "@/lib/data/ui-references";
import { loadTemplate } from "@/lib/template/load";
import { AUTHORING_MODEL, PROMPT_VERSION, authorFoundation } from "./author";
import { inputsHash, reviveAuthored } from "./memo";
import { rejectionMessage } from "./rejection";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Long enough to see a stage land, short enough that the screen never feels like a wait.
 *
 * Sized against the "author" stage's real duration, not in isolation: that stage is the one live
 * network call in the job, and the other four are near-instant beside it — a founder watching the
 * screen saw four flashes and then one long wait, which reads as stuck even when it isn't. Weighting
 * the four fixed stages more heavily borrows from that gap so the whole run feels like one steady
 * progression instead of a wait with decoration on either side.
 */
const BEAT = 700;

const STAGES: JobStage[] = ["resolve", "author", "assemble", "validate", "manifest"];

/**
 * How often a long stage says it is still alive.
 *
 * Comfortably inside the 60 seconds the job endpoint calls a job dead in
 * (`api/projects/[id]/job/route.ts`), with room for a missed beat.
 */
const HEARTBEAT_MS = 15_000;

/**
 * Run `work` while telling the database the job is still alive.
 *
 * Authoring is one long await with no writes inside it, and a job that has not written for 60 seconds
 * is declared interrupted — so a call that merely ran long was indistinguishable from a crashed one,
 * and founders were told "Generation was interrupted" about a generation that was working. Spec 123
 * fought that with model choice, which narrowed the window without closing it; this closes it. An
 * empty patch is the whole heartbeat: `jobPatchToRow` always bumps `heartbeat_at`.
 */
async function withHeartbeat<T>(jobId: string, work: Promise<T>): Promise<T> {
  const beat = setInterval(() => {
    // A missed beat is not worth failing a generation over — the next one is 15 seconds away, and
    // the endpoint allows four of them.
    void updateJob(jobId, {}).catch(() => {});
  }, HEARTBEAT_MS);
  try {
    return await work;
  } finally {
    clearInterval(beat);
  }
}

/**
 * End a run whose answers were refused (spec 128).
 *
 * `failed` rather than a status of its own, carrying the flagged answers: that is what keeps the run
 * out of the allowance ledger, which already excludes failed jobs because Airrow charges for calls it
 * paid for and nothing here produced a foundation.
 *
 * The project goes back to where the founder can act on it, not to `failed` — `interviewing` when
 * there is nothing to fall back on, and `ready` when an earlier foundation exists, because a refused
 * regeneration must not take away the one they already have.
 */
async function rejectAnswers(
  jobId: string,
  projectId: string,
  answers: readonly AnswerId[]
): Promise<void> {
  const previous = await previousCompletedJob(projectId, jobId);
  await updateJob(jobId, {
    status: "failed",
    error: rejectionMessage(answers),
    rejectedAnswers: [...answers],
    finishedAt: new Date().toISOString()
  });
  await setProjectStatus(projectId, previous ? "ready" : "interviewing");
}

/**
 * `orgId` is passed in rather than looked up: the caller has already established the organization
 * from the session, and the runner only knows a project — the same reason `matureReferral` is called
 * from the route rather than here. It scopes the reference lookup, which is org-scoped like every
 * other DataStore read (spec 159).
 */
export async function runGenerationJob(
  jobId: string,
  model: ProjectModel,
  orgId: string
): Promise<void> {
  const job = await getJob(jobId);
  if (!job) return;
  const done: JobStage[] = [];

  try {
    await updateJob(jobId, { status: "running", startedAt: new Date().toISOString(), stage: "resolve" });
    await sleep(BEAT);
    done.push("resolve");

    await updateJob(jobId, { stagesDone: [...done], stage: "author" });

    // Nothing that shapes the prose has changed, so there is nothing to pay for: reuse the previous
    // run's payload rather than spending another ~45s call and another slice of the founder's
    // allowance. Founders regenerate constantly while tuning one answer.
    // What the founder attached, if anything. Loaded before the hash, because it is part of what the
    // model will be looking at and therefore part of what "nothing changed" means (spec 159). Never
    // throws: an unreachable object costs this generation its references, never the generation.
    const references = await loadUiReferenceImages(orgId, job.projectId);

    const hash = inputsHash(model, PROMPT_VERSION, AUTHORING_MODEL, references);
    const reused = reviveAuthored(
      await findAuthoredByInputs(job.projectId, hash, PROMPT_VERSION, AUTHORING_MODEL)
    );

    // The one network call in generation. It never throws: `unavailable` — no key, a timeout, a
    // contract violation — lets the engine derive everything, so a founder without an integration
    // still gets a foundation and a ZIP. `rejected` is the other outcome, and the only one that ends
    // the job: the model read the answers and found no software product in them (spec 128).
    const outcome = reused
      ? ({ status: "authored", foundation: reused } as const)
      : await withHeartbeat(jobId, authorFoundation(model, references));

    if (outcome.status === "rejected") {
      await rejectAnswers(jobId, job.projectId, outcome.answers);
      return;
    }
    const authored = outcome.status === "authored" ? outcome.foundation : null;

    if (authored) {
      // Written on a reused payload too: this job's files were produced by that prompt and model,
      // so its provenance is the same and the manifest must say so.
      await saveAuthoringProvenance(jobId, {
        inputsHash: hash,
        promptVersion: PROMPT_VERSION,
        authoringModel: AUTHORING_MODEL,
        authored,
        // The founder is charged for calls we made. This run made none, so the ledger must not
        // count it — otherwise "nothing changed" costs a foundation for nobody's Claude call.
        reused: reused !== null
      });
    }

    let totalFiles = 0;
    const result = generate(loadTemplate(), model, {
      authored: authored?.slots,
      authoredDocuments: authored?.documents,
      authoredToolchain: authored?.toolchain,
      authoring: { promptVersion: PROMPT_VERSION, model: AUTHORING_MODEL },
      onFile: (_path, index, total) => {
        if (index === 1) totalFiles = total;
      }
    });
    // A live call is the real work of this stage and needs no padding. Reused prose and the
    // deterministic path both resolve in milliseconds, and the stage has to be legible either way.
    if (reused || !authored) await sleep(BEAT * 2);
    done.push("author");

    await updateJob(jobId, {
      stagesDone: [...done],
      stage: "assemble",
      totalFiles,
      filesAuthored: result.files.length,
      currentPath: null
    });
    await sleep(BEAT);
    done.push("assemble");

    await updateJob(jobId, { stagesDone: [...done], stage: "validate" });
    await sleep(BEAT);
    done.push("validate");

    await updateJob(jobId, { stagesDone: [...done], stage: "manifest" });
    await saveArtifact(jobId, result);
    await sleep(BEAT);
    done.push("manifest");

    await updateJob(jobId, {
      stagesDone: [...done],
      stage: null,
      status: "completed",
      finishedAt: new Date().toISOString()
    });
    await setProjectStatus(job.projectId, "ready");

    // The middle of the funnel, and the last event before delivery (spec 182). Emitted here rather
    // than at the route because this is where a foundation is known to exist: every path above this
    // line ends the job without one. `reused` separates a founder tuning one answer from one
    // generating something new — the same distinction the allowance ledger makes, for the same
    // reason.
    capture("foundation_generated", distinctIdForOrg(orgId), {
      project: job.projectId,
      reused: reused !== null
    });
  } catch (err) {
    await updateJob(jobId, {
      status: "failed",
      error: err instanceof Error ? err.message : "Unknown generation error",
      finishedAt: new Date().toISOString()
    });
    await setProjectStatus(job.projectId, "failed");
  }
}

export { STAGES };
