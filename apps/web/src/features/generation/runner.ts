// Generation job runner (F-401 FR-2). Local mode: in-process async with staged
// progress written to the store; the UI polls. Supabase mode swaps polling for Realtime.
import { generate } from "@airrow/engine";
import type { JobStage, ProjectModel } from "@airrow/schemas";
import { saveArtifact, setProjectStatus, updateJob, getJob } from "@/lib/data/store";
import { loadTemplate } from "@/lib/template/load";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const STAGES: JobStage[] = ["resolve", "author", "assemble", "validate", "manifest"];

export async function runGenerationJob(jobId: string, model: ProjectModel): Promise<void> {
  const job = await getJob(jobId);
  if (!job) return;
  const done: JobStage[] = [];

  try {
    await updateJob(jobId, { status: "running", startedAt: new Date().toISOString(), stage: "resolve" });
    await sleep(700);
    done.push("resolve");

    // Author: render the canonical template through the engine, collecting per-file paths;
    // progress is written after the synchronous generate() call so store writes stay ordered.
    await updateJob(jobId, { stagesDone: [...done], stage: "author" });
    const authoredPaths: string[] = [];
    let totalFiles = 0;
    const result = generate(loadTemplate(), model, {
      onFile: (path, index, total) => {
        authoredPaths.push(path);
        if (index === 1) totalFiles = total;
      }
    });
    if (totalFiles > 0) await updateJob(jobId, { totalFiles });
    for (let i = 0; i < authoredPaths.length; i++) {
      await updateJob(jobId, {
        filesAuthored: i + 1,
        currentPath: authoredPaths[i] ?? null
      });
      await sleep(90);
    }
    done.push("author");

    await updateJob(jobId, { stagesDone: [...done], stage: "assemble", currentPath: null });
    await sleep(500);
    done.push("assemble");

    await updateJob(jobId, { stagesDone: [...done], stage: "validate" });
    await sleep(500);
    done.push("validate");

    await updateJob(jobId, { stagesDone: [...done], stage: "manifest" });
    await saveArtifact(jobId, result);
    await sleep(400);
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
