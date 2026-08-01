// The suspension reaches the API, not just the pages (spec 164).
//
// This is the half of the proof the gate's own unit tests cannot give. `lib/auth.admin.test.ts` shows
// that `getSession` refuses a suspended profile; that says the rule is right, not that it is wired in.
// Here the **real** `getSession` runs inside a **real** route handler, with only Supabase Auth and the
// profile read faked underneath — so a future change that gives this endpoint its own session lookup,
// or drops the check from `getSession`, fails here.
//
// `/api/projects/[id]/job` is the endpoint worth pinning: it is the one a browser polls on its own, so
// it is the one that would keep answering a suspended founder's open tab.
import { describe, it, expect, vi, beforeEach } from "vitest";

const getUser = vi.hoisted(() => vi.fn());
vi.mock("@/lib/data/supabase-server", () => ({
  supabaseServer: async () => ({ auth: { getUser } })
}));

const getOrgForUser = vi.hoisted(() => vi.fn());
const profileFlags = vi.hoisted(() => vi.fn());
const getProject = vi.hoisted(() => vi.fn());
const latestJob = vi.hoisted(() => vi.fn());
vi.mock("@/lib/data/store", () => ({
  getOrgForUser,
  profileFlags,
  setDisplayName: vi.fn(),
  getProject,
  latestJob,
  setProjectStatus: vi.fn(),
  updateJob: vi.fn()
}));

import { GET } from "./route";

const ctx = { params: Promise.resolve({ id: "proj1" }) };

function signedInAs(suspendedAt: string | null): void {
  getUser.mockResolvedValue({
    data: { user: { id: "u1", email: "founder@example.com", created_at: "2026-01-01", user_metadata: {} } }
  });
  getOrgForUser.mockResolvedValue({
    id: "org1",
    name: "Workspace",
    kind: "personal",
    createdBy: "u1",
    plan: "free"
  });
  profileFlags.mockResolvedValue({ isAdmin: false, suspendedAt });
}

describe("GET /api/projects/[id]/job", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getProject.mockResolvedValue({ id: "proj1", status: "ready" });
    latestJob.mockResolvedValue({ id: "job1", status: "completed", heartbeatAt: new Date().toISOString() });
  });

  it("answers a signed-in founder", async () => {
    signedInAs(null);

    const response = await GET(new Request("http://x"), ctx);
    expect(response.status).toBe(200);
  });

  it("refuses a suspended account holding a valid token", async () => {
    // Exactly the state that produced the bug: Supabase Auth still says this is a real, signed-in
    // user, because banning an account does not invalidate a token it already issued. The database
    // row is what has to stop this, and it is read on every request.
    signedInAs("2026-08-01T10:17:30.000Z");

    const response = await GET(new Request("http://x"), ctx);
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "unauthorized" });
  });

  it("reads nothing about the project once it has refused", async () => {
    // A refusal that still queried is a refusal that leaked whether the project exists.
    signedInAs("2026-08-01T10:17:30.000Z");

    await GET(new Request("http://x"), ctx);
    expect(getProject).not.toHaveBeenCalled();
    expect(latestJob).not.toHaveBeenCalled();
  });
});
