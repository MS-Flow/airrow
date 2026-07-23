// Generation job runner (F-401 FR-2). Local mode: in-process async with staged
// progress written to the store; the UI polls. Supabase mode swaps polling for Realtime.
import { generate } from "@airrow/engine";
import type { JobStage, ProjectModel } from "@airrow/schemas";
import { saveArtifact, setProjectStatus, updateJob, getJob } from "@/lib/data/store";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const STAGES: JobStage[] = ["resolve", "author", "assemble", "validate", "manifest"];

export async function runGenerationJob(jobId: string, model: ProjectModel): Promise<void> {
  const job = getJob(jobId);
  if (!job) return;
  const done: JobStage[] = [];

  try {
    updateJob(jobId, { status: "running", startedAt: new Date().toISOString(), stage: "resolve" });
    await sleep(700);
    done.push("resolve");

    // Author: run the engine, streaming per-file progress with deliberate pacing —
    // the "watching your foundation being built" moment (F-401 UX).
    updateJob(jobId, { stagesDone: [...done], stage: "author" });
    const authoredPaths: string[] = [];
    const result = generate(model, {
      onFile: (path, index, total) => {
        authoredPaths.push(path);
        if (index === 1) updateJob(jobId, { totalFiles: total });
      }
    });
    for (let i = 0; i < authoredPaths.length; i++) {
      updateJob(jobId, {
        filesAuthored: i + 1,
        currentPath: authoredPaths[i] ?? null
      });
      await sleep(90);
    }
    done.push("author");

    updateJob(jobId, { stagesDone: [...done], stage: "assemble", currentPath: null });
    await sleep(500);
    done.push("assemble");

    updateJob(jobId, { stagesDone: [...done], stage: "validate" });
    await sleep(500);
    done.push("validate");

    updateJob(jobId, { stagesDone: [...done], stage: "manifest" });
    saveArtifact(jobId, result);
    await sleep(400);
    done.push("manifest");

    updateJob(jobId, {
      stagesDone: [...done],
      stage: null,
      status: "completed",
      finishedAt: new Date().toISOString()
    });
    setProjectStatus(job.projectId, "ready");
  } catch (err) {
    updateJob(jobId, {
      status: "failed",
      error: err instanceof Error ? err.message : "Unknown generation error",
      finishedAt: new Date().toISOString()
    });
    setProjectStatus(job.projectId, "failed");
  }
}

export { STAGES };
