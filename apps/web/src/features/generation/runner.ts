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
import type { JobStage, ProjectModel } from "@airrow/schemas";
import {
  findAuthoredByInputs,
  getJob,
  saveArtifact,
  saveAuthoringProvenance,
  setProjectStatus,
  updateJob
} from "@/lib/data/store";
import { loadTemplate } from "@/lib/template/load";
import { AUTHORING_MODEL, PROMPT_VERSION, authorFoundation } from "./author";
import { inputsHash, reviveAuthored } from "./memo";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Long enough to see a stage land, short enough that the screen never feels like a wait. */
const BEAT = 260;

const STAGES: JobStage[] = ["resolve", "author", "assemble", "validate", "manifest"];

export async function runGenerationJob(jobId: string, model: ProjectModel): Promise<void> {
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
    const hash = inputsHash(model, PROMPT_VERSION, AUTHORING_MODEL);
    const reused = reviveAuthored(
      await findAuthoredByInputs(job.projectId, hash, PROMPT_VERSION, AUTHORING_MODEL)
    );

    // The one network call in generation. It returns null rather than throwing — no key, a timeout,
    // a contract violation — and the engine then derives everything, so a founder without an
    // integration still gets a foundation and a ZIP.
    const authored = reused ?? (await authorFoundation(model));

    if (authored) {
      // Written on a reused payload too: this job's files were produced by that prompt and model,
      // so its provenance is the same and the manifest must say so.
      await saveAuthoringProvenance(jobId, {
        inputsHash: hash,
        promptVersion: PROMPT_VERSION,
        authoringModel: AUTHORING_MODEL,
        authored
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
