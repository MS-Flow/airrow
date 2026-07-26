// The bug this guards: the runner used to be started with `void runGenerationJob(...)`.
// That works while a long-lived Node process is around, but a serverless invocation is
// frozen the moment it responds, so the detached promise was killed part-way and the job
// sat at "running" forever — surfacing as "Generation was interrupted" with nothing written.
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ProjectModel } from "@airrow/schemas";

// `saveArtifact` yields before finishing, and flips `settled` only once it actually has.
// Asserting on the call alone would pass against the bug — a detached promise is still
// *called* synchronously; what it never gets to do is finish.
const settled = vi.hoisted(() => ({ artifact: false }));

type JobPatch = {
  status?: string;
  stagesDone?: string[];
  error?: string;
};

const store = vi.hoisted(() => ({
  updateJob: vi.fn(async (_jobId: string, _patch: JobPatch) => {}),
  saveArtifact: vi.fn(async (_jobId: string, _result: unknown) => {}),
  setProjectStatus: vi.fn(async (_projectId: string, _status: string) => {}),
  getJob: vi.fn(async (_jobId: string) => ({ id: "job1", projectId: "proj1" }))
}));

vi.mock("@/lib/data/store", () => store);
vi.mock("@/lib/template/load", () => ({ loadTemplate: () => [] }));

const generate = vi.hoisted(() => vi.fn());
vi.mock("@airrow/engine", () => ({ generate }));

import { runGenerationJob } from "./runner";

const model = { name: "Acme" } as unknown as ProjectModel;

describe("runGenerationJob", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    settled.artifact = false;
    store.getJob.mockResolvedValue({ id: "job1", projectId: "proj1" });
    store.saveArtifact.mockImplementation(async () => {
      await new Promise((r) => setTimeout(r, 0));
      settled.artifact = true;
    });
    generate.mockReturnValue({ files: [{ path: "README.md" }], manifest: { fileCount: 1 } });
  });

  it("has finished writing the artifact by the time it resolves", async () => {
    // Nothing may be left in flight: whatever the caller awaits must be the whole job,
    // because the runtime may stop executing the instant the caller returns.
    await runGenerationJob("job1", model);

    expect(settled.artifact).toBe(true);
    expect(store.setProjectStatus).toHaveBeenCalledWith("proj1", "ready");
    const final = store.updateJob.mock.calls.at(-1)?.[1];
    expect(final).toMatchObject({ status: "completed" });
  });

  it("records every stage so progress is never invented", async () => {
    await runGenerationJob("job1", model);

    const final = store.updateJob.mock.calls.at(-1)?.[1];
    expect(final?.stagesDone).toEqual(["resolve", "author", "assemble", "validate", "manifest"]);
  });

  it("keeps its store writes to one per stage", async () => {
    // Per-file progress writes meant 20+ round-trips inside a single request budget.
    await runGenerationJob("job1", model);

    expect(store.updateJob.mock.calls.length).toBeLessThanOrEqual(6);
  });

  it("marks the job failed rather than throwing when the engine blows up", async () => {
    generate.mockImplementation(() => {
      throw new Error("template missing");
    });

    await expect(runGenerationJob("job1", model)).resolves.toBeUndefined();

    expect(store.updateJob).toHaveBeenCalledWith(
      "job1",
      expect.objectContaining({ status: "failed", error: "template missing" })
    );
    expect(store.setProjectStatus).toHaveBeenCalledWith("proj1", "failed");
    expect(store.saveArtifact).not.toHaveBeenCalled();
  });
});
