// The funnel's first server-side step (spec 182).
//
// `signup` is the event most easily made wrong in a way nobody notices, because the two routes that
// emit it run on *every* sign-in, not only the first. Without the freshness guard, the number would
// be a count of logins — larger than reality, growing with retention, and indistinguishable from
// success at a glance.
//
// It is attributed to the workspace rather than the user on purpose: `foundation_generated`,
// `zip_downloaded` and `paid` all name an organization, and a funnel whose first step is keyed
// differently from its last is five counters in a trench coat.
import { describe, it, expect, vi, beforeEach } from "vitest";

const analytics = vi.hoisted(() => ({
  captures: [] as { name: string; distinctId: string; properties: Record<string, unknown> }[]
}));
const getOrgForUser = vi.hoisted(() => vi.fn(async (): Promise<{ id: string } | null> => ({ id: "org1" })));

vi.mock("./server", () => ({
  capture: (name: string, distinctId: string, properties: Record<string, unknown>) => {
    analytics.captures.push({ name, distinctId, properties });
  }
}));
vi.mock("@/lib/data/store", () => ({ getOrgForUser }));

import { captureSignup } from "./signup";

const now = new Date("2026-08-03T12:00:00.000Z");
const ago = (ms: number) => new Date(now.getTime() - ms).toISOString();

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(now);
  analytics.captures = [];
  getOrgForUser.mockResolvedValue({ id: "org1" });
});

describe("captureSignup", () => {
  it("records a new account against its workspace", async () => {
    await captureSignup({ id: "u1", createdAt: ago(5_000) }, "github");

    expect(analytics.captures).toEqual([
      { name: "signup", distinctId: "org_org1", properties: { method: "github" } }
    ]);
  });

  it("carries the method the founder actually used", async () => {
    await captureSignup({ id: "u1", createdAt: ago(5_000) }, "email");

    expect(analytics.captures[0]?.properties).toEqual({ method: "email" });
  });

  it("records nothing for a returning founder signing in", async () => {
    // The bug this exists to prevent: both emitting routes run on every sign-in, so without the
    // freshness test `signup` would count logins and grow with retention.
    await captureSignup({ id: "u1", createdAt: ago(30 * 24 * 60 * 60_000) }, "google");

    expect(analytics.captures).toEqual([]);
    // And it does not even ask the database — the cheap check comes first.
    expect(getOrgForUser).not.toHaveBeenCalled();
  });

  it("still counts an account confirmed after a slow round trip", async () => {
    // A consent screen or an inbox can take minutes. Erring long costs a duplicate on a chart;
    // erring short loses the top of the funnel for everyone on a bad connection.
    await captureSignup({ id: "u1", createdAt: ago(9 * 60_000) }, "email");

    expect(analytics.captures).toHaveLength(1);
  });

  it("records nothing when the workspace does not exist yet", async () => {
    // A half-created account is not a signup to report.
    getOrgForUser.mockResolvedValue(null);

    await captureSignup({ id: "u1", createdAt: ago(5_000) }, "github");

    expect(analytics.captures).toEqual([]);
  });

  it("never throws into the route it was called from", async () => {
    // It runs inside `/auth/callback` and `/auth/confirm`. A founder whose signup broke because an
    // analytics lookup failed is a far worse outcome than a signup quietly not counted.
    getOrgForUser.mockRejectedValue(new Error("database is down"));

    await expect(
      captureSignup({ id: "u1", createdAt: ago(5_000) }, "github")
    ).resolves.toBeUndefined();
    expect(analytics.captures).toEqual([]);
  });
});
