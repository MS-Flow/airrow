// Generation job runner (F-401 FR-2). Runs to completion inside the caller's request:
// awaited, never fire-and-forget. A serverless invocation is frozen the moment it
// responds, so a detached promise here is killed mid-flight and the job is left
// "running" forever — which is exactly what "Generation was interrupted" was.
//
// That constraint also rules out per-file progress writes: 20+ round-trips to Postgres
// (previously each padded with an artificial sleep) bought a nicer animation at the cost
// of the request budget. Progress is now written once per stage; `generate()` itself is
// pure and takes milliseconds.
import { generate } from "@airrow/engine";
import type { JobStage, ProjectModel } from "@airrow/schemas";
import { saveArtifact, setProjectStatus, updateJob, getJob } from "@/lib/data/store";
import { loadTemplate } from "@/lib/template/load";

const STAGES: JobStage[] = ["resolve", "author", "assemble", "validate", "manifest"];

export async function runGenerationJob(jobId: string, model: ProjectModel): Promise<void> {
  const job = await getJob(jobId);
  if (!job) return;
  const done: JobStage[] = [];

  try {
    await updateJob(jobId, { status: "running", startedAt: new Date().toISOString(), stage: "resolve" });
    done.push("resolve");

    await updateJob(jobId, { stagesDone: [...done], stage: "author" });
    let totalFiles = 0;
    const result = generate(loadTemplate(), model, {
      onFile: (_path, index, total) => {
        if (index === 1) totalFiles = total;
      }
    });
    done.push("author");

    await updateJob(jobId, {
      stagesDone: [...done],
      stage: "assemble",
      totalFiles,
      filesAuthored: result.files.length,
      currentPath: null
    });
    done.push("assemble");

    await updateJob(jobId, { stagesDone: [...done], stage: "validate" });
    done.push("validate");

    await updateJob(jobId, { stagesDone: [...done], stage: "manifest" });
    await saveArtifact(jobId, result);
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
