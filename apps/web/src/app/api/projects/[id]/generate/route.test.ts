// This endpoint exists so the generation job runs inside a request that is held open.
// The original bug was the opposite: the job was detached from the request that started
// it (`void runGenerationJob(...)`), and a serverless invocation freezes the moment it
// responds, so the work was killed part-way and the job sat at "running" forever.
import { describe, it, expect, vi, beforeEach } from "vitest";

const runGenerationJob = vi.hoisted(() => vi.fn(async () => {}));
vi.mock("@/features/generation/runner", () => ({ runGenerationJob }));

const auth = vi.hoisted(() => ({ getSession: vi.fn() }));
vi.mock("@/lib/auth", () => auth);

const store = vi.hoisted(() => ({
  getProject: vi.fn(),
  latestJob: vi.fn(),
  latestModelVersion: vi.fn()
}));
vi.mock("@/lib/data/store", () => store);

// Crediting whoever invited this founder happens here too (spec 122); it has its own tests.
const matureReferral = vi.hoisted(() => vi.fn(async () => {}));
vi.mock("@/lib/data/referrals", () => ({ matureReferral }));

import { POST } from "./route";

const ctx = { params: Promise.resolve({ id: "proj1" }) };

describe("POST /api/projects/[id]/generate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    auth.getSession.mockResolvedValue({ org: { id: "org1" } });
    store.getProject.mockResolvedValue({ id: "proj1" });
    store.latestJob.mockResolvedValue({ id: "job1", status: "queued" });
    store.latestModelVersion.mockResolvedValue({ id: "mv1", model: {} });
    runGenerationJob.mockResolvedValue(undefined);
  });

  it("does not respond until the job has finished", async () => {
    // The whole point of the endpoint. If it resolved early the runtime could freeze
    // mid-generation, which is the failure this replaced.
    let finish!: () => void;
    runGenerationJob.mockReturnValue(new Promise<void>((r) => (finish = r)));

    let responded = false;
    const pending = POST(new Request("http://x", { method: "POST" }), ctx).then((r) => {
      responded = true;
      return r;
    });

    // Drain everything the handler could settle on its own. Whatever is left waiting can
    // only be the job, so if it has responded by now it is not awaiting the work.
    await new Promise((r) => setTimeout(r, 0));
    expect(responded).toBe(false);

    finish();
    await pending;
    expect(responded).toBe(true);
  });

  it("starts a queued job", async () => {
    store.latestJob
      .mockResolvedValueOnce({ id: "job1", status: "queued" })
      .mockResolvedValueOnce({ id: "job1", status: "completed" });

    const res = await POST(new Request("http://x", { method: "POST" }), ctx);

    // The organization travels with the job: the runner only knows a project, and the founder's UI
    // references are org-scoped like every other read (spec 159).
    expect(runGenerationJob).toHaveBeenCalledWith("job1", {}, "org1");
    await expect(res.json()).resolves.toMatchObject({ started: true, status: "completed" });
  });

  it("refuses to restart a job that is not queued", async () => {
    // A refresh, a second tab or a re-mount all land here; none may run the job twice.
    store.latestJob.mockResolvedValue({ id: "job1", status: "running" });

    const res = await POST(new Request("http://x", { method: "POST" }), ctx);

    expect(runGenerationJob).not.toHaveBeenCalled();
    await expect(res.json()).resolves.toMatchObject({ started: false });
  });

  it("denies a project the caller's org does not own", async () => {
    store.getProject.mockResolvedValue(null);

    const res = await POST(new Request("http://x", { method: "POST" }), ctx);

    expect(res.status).toBe(404);
    expect(runGenerationJob).not.toHaveBeenCalled();
  });

  it("denies an unauthenticated caller", async () => {
    auth.getSession.mockResolvedValue(null);

    const res = await POST(new Request("http://x", { method: "POST" }), ctx);

    expect(res.status).toBe(401);
    expect(runGenerationJob).not.toHaveBeenCalled();
  });
});
