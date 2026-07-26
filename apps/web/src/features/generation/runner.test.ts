// The bug this guards: the runner used to be started with `void runGenerationJob(...)`.
// That works while a long-lived Node process is around, but a serverless invocation is
// frozen the moment it responds, so the detached promise was killed part-way and the job
// sat at "running" forever — surfacing as "Generation was interrupted" with nothing written.
//
// The runner paces its stages so they can be read as they land, so these run on fake
// timers: the assertions are about order and completeness, never about wall-clock time.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { ProjectModel } from "@airrow/schemas";

// Order of the writes that matter, so "saved before reported complete" can be asserted
// rather than assumed. The structural guard against the job being detached from its
// request lives in the route handler's test, which is where that call now happens.
const order = vi.hoisted(() => [] as string[]);

type JobPatch = {
  status?: string;
  stage?: string | null;
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

/** Runs the job to completion, driving the runner's pacing rather than waiting it out. */
async function runToCompletion(): Promise<void> {
  const job = runGenerationJob("job1", model);
  await vi.runAllTimersAsync();
  await job;
}

describe("runGenerationJob", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    order.length = 0;
    store.getJob.mockResolvedValue({ id: "job1", projectId: "proj1" });
    store.saveArtifact.mockImplementation(async () => {
      await Promise.resolve();
      order.push("artifact-saved");
    });
    store.updateJob.mockImplementation(async (_id, patch) => {
      if (patch.status) order.push(`status:${patch.status}`);
    });
    generate.mockReturnValue({ files: [{ path: "README.md" }], manifest: { fileCount: 1 } });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("never reports success before the artifact is actually saved", async () => {
    // "completed" is what flips the project to ready and sends the founder to a preview.
    // Writing it first would promise files that may still fail to persist.
    await runToCompletion();

    expect(order).toEqual(["status:running", "artifact-saved", "status:completed"]);
    expect(store.setProjectStatus).toHaveBeenCalledWith("proj1", "ready");
  });

  it("records every stage so progress is never invented", async () => {
    await runToCompletion();

    const final = store.updateJob.mock.calls.at(-1)?.[1];
    expect(final?.stagesDone).toEqual(["resolve", "author", "assemble", "validate", "manifest"]);
  });

  it("writes each stage as its own update, so the screen can show them landing", async () => {
    // One write per stage: enough for the progress screen to poll, far short of the 20+
    // per-file round-trips this used to make inside a single request budget.
    await runToCompletion();

    expect(store.updateJob.mock.calls.length).toBeLessThanOrEqual(6);
    const stages = store.updateJob.mock.calls.map((c) => c[1].stage).filter(Boolean);
    expect(stages).toEqual(["resolve", "author", "assemble", "validate", "manifest"]);
  });

  it("marks the job failed rather than throwing when the engine blows up", async () => {
    generate.mockImplementation(() => {
      throw new Error("template missing");
    });

    await expect(runToCompletion()).resolves.toBeUndefined();

    expect(store.updateJob).toHaveBeenCalledWith(
      "job1",
      expect.objectContaining({ status: "failed", error: "template missing" })
    );
    expect(store.setProjectStatus).toHaveBeenCalledWith("proj1", "failed");
    expect(store.saveArtifact).not.toHaveBeenCalled();
  });
});
