// ZIP delivery is the funnel's generate→download step (spec 182), and it had no test of its own.
//
// `/analyze` found the emitter typechecked and was never exercised: a `capture` placed after an
// early `return`, or lost in a later refactor, would leave the suite green and the dashboard
// reporting that nobody ever downloaded anything — which reads as a product failure rather than as
// a missing line of code.
//
// What is asserted is the pairing: the event fires exactly where `recordDelivery` fires, and never
// on a path that produces no bytes.
import { describe, it, expect, vi, beforeEach } from "vitest";

const session = vi.hoisted(() => ({ current: null as { org: { id: string } } | null }));
const store = vi.hoisted(() => ({
  getProject: vi.fn(async (): Promise<unknown> => ({ id: "proj1", slug: "pied-piper" })),
  latestJob: vi.fn(async (): Promise<unknown> => ({ id: "job1", status: "completed" })),
  loadArtifact: vi.fn(async (): Promise<unknown> => ({
    files: [{ path: "README.md", content: "# Pied Piper" }]
  })),
  getImportSource: vi.fn(async (): Promise<unknown> => null),
  listImportFiles: vi.fn(async () => []),
  listConflictResolutions: vi.fn(async () => []),
  recordDelivery: vi.fn(async () => {})
}));
const analytics = vi.hoisted(() => ({
  captures: [] as { name: string; distinctId: string; properties: Record<string, unknown> }[]
}));

vi.mock("@/lib/auth", () => ({ getSession: async () => session.current }));
vi.mock("@/lib/data/store", () => store);
vi.mock("@airrow/engine", () => ({ applyResolutions: (files: unknown) => files }));
vi.mock("@/features/analytics/server", () => ({
  capture: (name: string, distinctId: string, properties: Record<string, unknown>) => {
    analytics.captures.push({ name, distinctId, properties });
  }
}));

import { GET } from "./route";

const download = () =>
  GET(new Request("https://airrow.test/api/projects/proj1/zip"), {
    params: Promise.resolve({ id: "proj1" })
  });

beforeEach(() => {
  vi.clearAllMocks();
  analytics.captures = [];
  session.current = { org: { id: "org1" } };
  store.getProject.mockResolvedValue({ id: "proj1", slug: "pied-piper" });
  store.latestJob.mockResolvedValue({ id: "job1", status: "completed" });
  store.loadArtifact.mockResolvedValue({ files: [{ path: "README.md", content: "# Pied Piper" }] });
  store.getImportSource.mockResolvedValue(null);
});

describe("ZIP delivery", () => {
  it("records the download beside the delivery row", async () => {
    const res = await download();

    expect(res.status).toBe(200);
    expect(store.recordDelivery).toHaveBeenCalledWith("proj1", "job1", "zip");
    expect(analytics.captures).toEqual([
      { name: "zip_downloaded", distinctId: "org_org1", properties: { project: "proj1" } }
    ]);
  });

  it("records nothing for a signed-out request", async () => {
    session.current = null;

    const res = await download();

    expect(res.status).toBe(401);
    expect(analytics.captures).toEqual([]);
  });

  it("records nothing for a project in another workspace", async () => {
    // `getProject` is org-scoped, so a project that is not this workspace's simply is not found.
    // The event must not fire on the way to a 404 — it would attribute a download to the workspace
    // that was refused one.
    store.getProject.mockResolvedValue(null);

    const res = await download();

    expect(res.status).toBe(404);
    expect(analytics.captures).toEqual([]);
  });

  it("records nothing when there is no ready artifact to send", async () => {
    store.latestJob.mockResolvedValue(null);

    const res = await download();

    expect(res.status).toBe(409);
    expect(analytics.captures).toEqual([]);
  });
});
