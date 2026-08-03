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
  rejectedAnswers?: string[];
};

const store = vi.hoisted(() => ({
  updateJob: vi.fn(async (_jobId: string, _patch: JobPatch) => {}),
  saveArtifact: vi.fn(async (_jobId: string, _result: unknown) => {}),
  setProjectStatus: vi.fn(async (_projectId: string, _status: string) => {}),
  getJob: vi.fn(async (_jobId: string) => ({ id: "job1", projectId: "proj1" })),
  saveAuthoringProvenance: vi.fn(async (_jobId: string, _p: unknown) => {}),
  findAuthoredByInputs: vi.fn(async (): Promise<unknown> => null),
  previousCompletedJob: vi.fn(async (): Promise<unknown> => null),
  // Read by the Slack notification, which turns ids into names (spec 203).
  getOrganization: vi.fn(async (): Promise<unknown> => ({ id: "org1", name: "Acme", plan: "free" })),
  getProject: vi.fn(async (): Promise<unknown> => ({ id: "proj1", name: "CRM" }))
}));

vi.mock("@/lib/data/store", () => store);
vi.mock("@/lib/template/load", () => ({ loadTemplate: () => [] }));
// The founder's reference images (spec 159). Stubbed empty: these tests are about control flow, and
// the runner's own behaviour when there are none is what every existing case here describes.
vi.mock("@/lib/data/ui-references", () => ({ loadUiReferenceImages: async () => [] }));

// The one network call in generation, stubbed: these tests are about the runner's control flow, and
// §V forbids reaching the network from a test regardless.
const UNAVAILABLE = { status: "unavailable" } as const;
const authorFoundation = vi.hoisted(() => vi.fn(async (): Promise<unknown> => ({ status: "unavailable" })));
vi.mock("./author", () => ({
  authorFoundation,
  PROMPT_VERSION: "test-prompt",
  AUTHORING_MODEL: "test-model"
}));

const generate = vi.hoisted(() => vi.fn());
vi.mock("@airrow/engine", () => ({ generate }));

const analytics = vi.hoisted(() => ({
  captures: [] as { name: string; distinctId: string; properties: Record<string, unknown> }[]
}));
vi.mock("@/features/analytics/server", () => ({
  capture: (name: string, distinctId: string, properties: Record<string, unknown>) => {
    analytics.captures.push({ name, distinctId, properties });
  }
}));

// The transport only; `messages.ts` is real, so what Slack would actually read is asserted.
const slack = vi.hoisted(() => ({ sent: [] as string[] }));
vi.mock("@/lib/slack", () => ({ notifySlack: (text: string) => slack.sent.push(text) }));

import { runGenerationJob } from "./runner";

const model = { name: "Acme" } as unknown as ProjectModel;

/** Runs the job to completion, driving the runner's pacing rather than waiting it out. */
async function runToCompletion(): Promise<void> {
  const job = runGenerationJob("job1", model, "org1");
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
    authorFoundation.mockResolvedValue(UNAVAILABLE);
    store.saveArtifact.mockImplementation(async () => {
      await Promise.resolve();
      order.push("artifact-saved");
    });
    store.updateJob.mockImplementation(async (_id, patch) => {
      if (patch.status) order.push(`status:${patch.status}`);
    });
    generate.mockReturnValue({ files: [{ path: "README.md" }], manifest: { fileCount: 1 } });
    analytics.captures = [];
    slack.sent = [];
    store.getOrganization.mockResolvedValue({ id: "org1", name: "Acme", plan: "free" });
    store.getProject.mockResolvedValue({ id: "proj1", name: "CRM" });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // The middle of the funnel (spec 182). Added after `/analyze` found the emitter had no test at
  // all — it typechecked, which is not the same as firing.
  describe("the foundation_generated event", () => {
    it("fires once the foundation exists, naming the workspace and project", async () => {
      await runToCompletion();

      expect(analytics.captures).toEqual([
        {
          name: "foundation_generated",
          distinctId: "org_org1",
          properties: { project: "proj1", reused: false }
        }
      ]);
    });

    it("marks a run that reused the previous prose", async () => {
      // The same distinction the allowance ledger makes: nothing was paid for, and a founder tuning
      // one answer is not a founder generating something new.
      store.findAuthoredByInputs.mockResolvedValue({
        slots: { VISION: "A stored vision that is long enough to survive validation." }
      });

      await runToCompletion();

      expect(analytics.captures[0]?.properties).toEqual({ project: "proj1", reused: true });
    });

    it("does not fire when the generation fails", async () => {
      // An event here would count a failure as a delivery — the one direction this number must not
      // be wrong in, because it feeds the generate→download ratio.
      generate.mockImplementation(() => {
        throw new Error("engine exploded");
      });

      await runToCompletion();

      expect(analytics.captures).toEqual([]);
    });

    it("does not fire when the answers were refused", async () => {
      // A rejected run ends the job without a foundation (spec 128), and is kept out of the funnel
      // for the same reason it is kept out of the allowance ledger.
      authorFoundation.mockResolvedValue({ status: "rejected", answers: ["problem"] });

      await runToCompletion();

      expect(analytics.captures).toEqual([]);
    });
  });

  // Slack gets the names, PostHog gets the ids — both from the same line (spec 203). Notifying on a
  // *generated foundation* rather than on a project being created is deliberate: a project is made
  // in seconds and can be abandoned before a single question is answered.
  describe("the Slack notification", () => {
    it("names the workspace and the project", async () => {
      await runToCompletion();
      await vi.runAllTimersAsync();

      expect(slack.sent).toEqual(["✨ *Acme* generated a foundation: *CRM*"]);
    });

    it("says plainly when it was a regeneration", async () => {
      store.findAuthoredByInputs.mockResolvedValue({
        slots: { VISION: "A stored vision that is long enough to survive validation." }
      });

      await runToCompletion();
      await vi.runAllTimersAsync();

      expect(slack.sent).toEqual(["🔁 *Acme* regenerated *CRM*"]);
    });

    it("stays quiet when the generation failed", async () => {
      generate.mockImplementation(() => {
        throw new Error("engine exploded");
      });

      await runToCompletion();
      await vi.runAllTimersAsync();

      expect(slack.sent).toEqual([]);
    });

    it("does not fail the generation when the name lookup throws", async () => {
      store.getOrganization.mockRejectedValue(new Error("database is down"));

      await runToCompletion();
      await vi.runAllTimersAsync();

      // The job still completed; only the message was lost.
      expect(slack.sent).toEqual([]);
      expect(store.setProjectStatus).toHaveBeenCalledWith("proj1", "ready");
    });
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

// A live call must never be mistaken for a crashed one. The job endpoint declares a job dead after 60
// seconds without a write, and authoring is one long await with no writes in it — so a slow call
// reported itself as "Generation was interrupted" while it was still working (spec 128).
describe("staying alive through a long authoring call", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    store.getJob.mockResolvedValue({ id: "job1", projectId: "proj1" });
    store.findAuthoredByInputs.mockResolvedValue(null);
    generate.mockReturnValue({ files: [{ path: "README.md" }], manifest: { fileCount: 1 } });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("beats while the call is in flight, well inside the 60-second window", async () => {
    // A call slow enough to have tripped the check: the job must have written something in between.
    authorFoundation.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve(UNAVAILABLE), 50_000))
    );

    await runToCompletion();

    // The heartbeat writes nothing but a timestamp, which is exactly how it is recognised here.
    const beats = store.updateJob.mock.calls.filter(([, patch]) => Object.keys(patch).length === 0);
    expect(beats.length).toBeGreaterThanOrEqual(3);
  });

  it("stops beating once the call is done", async () => {
    await runToCompletion();

    const beatsAfter = store.updateJob.mock.calls.filter(([, patch]) => Object.keys(patch).length === 0).length;
    await vi.advanceTimersByTimeAsync(120_000);

    expect(
      store.updateJob.mock.calls.filter(([, patch]) => Object.keys(patch).length === 0)
    ).toHaveLength(beatsAfter);
  });
});

// The answers themselves being refused (spec 128). Everything here is about the run *stopping*: it
// used to continue, hand over a deterministic foundation, and never say why.
describe("refused answers", () => {
  const rejected = { status: "rejected", answers: ["problem", "coreEntities"] } as const;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    store.getJob.mockResolvedValue({ id: "job1", projectId: "proj1" });
    store.findAuthoredByInputs.mockResolvedValue(null);
    store.previousCompletedJob.mockResolvedValue(null);
    authorFoundation.mockResolvedValue(rejected);
    generate.mockReturnValue({ files: [{ path: "README.md" }], manifest: { fileCount: 1 } });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("generates nothing, so the founder is never handed a foundation about nothing", async () => {
    await runToCompletion();

    expect(generate).not.toHaveBeenCalled();
    expect(store.saveArtifact).not.toHaveBeenCalled();
    expect(store.updateJob).not.toHaveBeenCalledWith("job1", expect.objectContaining({ status: "completed" }));
  });

  it("ends the job failed and names the answers to rewrite", async () => {
    // `failed` is also what keeps the run out of the allowance ledger: `chargedUsage` excludes it, so
    // a founder is never charged for answers we declined.
    await runToCompletion();

    expect(store.updateJob).toHaveBeenCalledWith(
      "job1",
      expect.objectContaining({ status: "failed", rejectedAnswers: ["problem", "coreEntities"] })
    );
  });

  it("sends the project back to the interview, where the answers can be changed", async () => {
    await runToCompletion();

    expect(store.setProjectStatus).toHaveBeenCalledWith("proj1", "interviewing");
  });

  it("leaves an existing foundation standing when a regeneration is refused", async () => {
    // A refused rewrite must not cost the founder the foundation they already have.
    store.previousCompletedJob.mockResolvedValue({ id: "job0" });

    await runToCompletion();

    expect(store.setProjectStatus).toHaveBeenCalledWith("proj1", "ready");
  });

  it("still generates deterministically when the call was merely unavailable", async () => {
    // The other half of the distinction: no key or no network is ours to absorb, and the ZIP promise
    // depends on it.
    authorFoundation.mockResolvedValue(UNAVAILABLE);

    await runToCompletion();

    expect(store.saveArtifact).toHaveBeenCalled();
    expect(store.setProjectStatus).toHaveBeenCalledWith("proj1", "ready");
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
    authorFoundation.mockResolvedValue(UNAVAILABLE);
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
    authorFoundation.mockResolvedValue({ status: "authored", foundation: stored });

    await runToCompletion();

    expect(authorFoundation).toHaveBeenCalledTimes(1);
    expect(store.saveAuthoringProvenance).toHaveBeenCalledWith(
      "job1",
      expect.objectContaining({ promptVersion: "test-prompt", authoringModel: "test-model" })
    );
  });

  it("records that a reused run made no call, so the founder is not charged for it", async () => {
    // The other half of memoisation (spec 74). Reusing the prose already avoided the Claude call;
    // this flag is what stops the ledger charging a foundation for a call nobody made.
    store.findAuthoredByInputs.mockResolvedValue(stored);

    await runToCompletion();

    expect(store.saveAuthoringProvenance).toHaveBeenCalledWith(
      "job1",
      expect.objectContaining({ reused: true })
    );
  });

  it("records a live call as chargeable", async () => {
    authorFoundation.mockResolvedValue({ status: "authored", foundation: stored });

    await runToCompletion();

    expect(store.saveAuthoringProvenance).toHaveBeenCalledWith(
      "job1",
      expect.objectContaining({ reused: false })
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
