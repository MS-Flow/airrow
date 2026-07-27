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
  getJob: vi.fn(async (_jobId: string) => ({ id: "job1", projectId: "proj1" })),
  saveAuthoringProvenance: vi.fn(async (_jobId: string, _p: unknown) => {}),
  findAuthoredByInputs: vi.fn(async (): Promise<unknown> => null)
}));

vi.mock("@/lib/data/store", () => store);
vi.mock("@/lib/template/load", () => ({ loadTemplate: () => [] }));

// The one network call in generation, stubbed: these tests are about the runner's control flow, and
// §V forbids reaching the network from a test regardless.
const authorFoundation = vi.hoisted(() => vi.fn(async (): Promise<unknown> => null));
vi.mock("./author", () => ({
  authorFoundation,
  PROMPT_VERSION: "test-prompt",
  AUTHORING_MODEL: "test-model"
}));

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
    store.findAuthoredByInputs.mockResolvedValue(null);
    authorFoundation.mockResolvedValue(null);
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

// A regeneration with unchanged answers costs ~37s, a paid call, and a slice of the founder's
// three-generation allowance. Founders regenerate constantly while tuning one answer, so this is the
// difference between the limit being a budget and the limit being a wall.
describe("authoring memoisation", () => {
  const stored = { slots: { VISION: "A stored vision that is long enough to survive validation." } };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    store.getJob.mockResolvedValue({ id: "job1", projectId: "proj1" });
    store.findAuthoredByInputs.mockResolvedValue(null);
    authorFoundation.mockResolvedValue(null);
    generate.mockReturnValue({ files: [{ path: "README.md" }], manifest: { fileCount: 1 } });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("reuses stored prose instead of paying for the call again", async () => {
    store.findAuthoredByInputs.mockResolvedValue(stored);

    await runToCompletion();

    expect(authorFoundation).not.toHaveBeenCalled();
    expect(generate.mock.calls[0]?.[2]?.authored).toMatchObject({ VISION: expect.any(String) });
  });

  it("calls out when nothing matches, and stores what it got", async () => {
    authorFoundation.mockResolvedValue(stored);

    await runToCompletion();

    expect(authorFoundation).toHaveBeenCalledTimes(1);
    expect(store.saveAuthoringProvenance).toHaveBeenCalledWith(
      "job1",
      expect.objectContaining({ promptVersion: "test-prompt", authoringModel: "test-model" })
    );
  });

  it("keys the lookup on the prompt and model, not just the answers", async () => {
    // Prose written by a superseded prompt is not the prose these inputs would produce now. Missing
    // is the correct outcome — a stale hit is invisible, and would quietly outlive the change.
    await runToCompletion();

    expect(store.findAuthoredByInputs).toHaveBeenCalledWith(
      "proj1",
      expect.any(String),
      "test-prompt",
      "test-model"
    );
  });

  it("does not serve stored prose that no longer satisfies the contract", async () => {
    // Caps tighten and slots get removed. A payload that was valid when written is still just data
    // on the way back in, and must clear the same bar as a live response.
    store.findAuthoredByInputs.mockResolvedValue({ slots: { NOT_A_SLOT: "x" }, documents: {} });

    await runToCompletion();

    expect(authorFoundation).toHaveBeenCalledTimes(1);
  });
});
