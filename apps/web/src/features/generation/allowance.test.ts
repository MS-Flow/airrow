// The allowance is what stands between an open signup and an unbounded bill, so its edges are worth
// pinning down: off-by-one at the boundary, whether our own failures cost the founder a generation,
// that a plan lifts the limit without leaking to anyone else, and that the repair window closes on
// both of its edges independently — a count and a clock, either of which alone is a hole.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const countGenerations = vi.hoisted(() => vi.fn());
const isAdminUser = vi.hoisted(() => vi.fn(async () => false));
const projectUsage = vi.hoisted(() =>
  vi.fn(async (): Promise<{ count: number; firstAt: string | null }> => ({
    count: 0,
    firstAt: null
  }))
);
vi.mock("@/lib/data/store", () => ({ countGenerations, isAdminUser, projectUsage }));

import {
  FREE_GENERATION_LIMIT,
  FREE_REPAIR_LIMIT,
  REPAIR_WINDOW_HOURS,
  allowanceMessage,
  checkAllowance
} from "./allowance";

/** Anchored in UTC so the window arithmetic is the same on every machine and in CI (§V). */
const FIRST_RUN = "2026-07-29T12:00:00.000Z";
const hoursAfterFirstRun = (hours: number): Date =>
  new Date(Date.parse(FIRST_RUN) + hours * 60 * 60 * 1000);

/** A project that has been generated `count` times, the first at `FIRST_RUN`. */
function generatedTimes(count: number): void {
  projectUsage.mockResolvedValue({ count, firstAt: FIRST_RUN });
}

describe("checkAllowance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isAdminUser.mockResolvedValue(false);
    projectUsage.mockResolvedValue({ count: 0, firstAt: null });
  });

  describe("the free foundation", () => {
    it("allows the first generation", async () => {
      countGenerations.mockResolvedValue(0);

      await expect(checkAllowance({ orgId: "org1", plan: "free" })).resolves.toMatchObject({
        allowed: true,
        grant: "free",
        used: 0,
        remaining: FREE_GENERATION_LIMIT,
        unlimited: false
      });
    });

    it("refuses a second project once the free foundation is spent", async () => {
      countGenerations.mockResolvedValue(FREE_GENERATION_LIMIT);
      // A project with nothing on it is a new foundation, not a repair of an old one.
      projectUsage.mockResolvedValue({ count: 0, firstAt: null });

      const result = await checkAllowance({ orgId: "org1", plan: "free", projectId: "new" });

      expect(result).toMatchObject({ allowed: false, denial: "free-spent", remaining: 0 });
    });

    it("refuses when no project is named at all", async () => {
      // Only a project can be repaired, so a bare org-level ask past the limit is simply spent.
      countGenerations.mockResolvedValue(FREE_GENERATION_LIMIT);

      await expect(checkAllowance({ orgId: "org1", plan: "free" })).resolves.toMatchObject({
        allowed: false,
        denial: "free-spent"
      });
    });

    it("never reports negative remaining", async () => {
      // Concurrent submits can push the count past the limit; the founder should read "0 left",
      // not "-2 left".
      countGenerations.mockResolvedValue(FREE_GENERATION_LIMIT + 5);

      await expect(checkAllowance({ orgId: "org1", plan: "free" })).resolves.toMatchObject({
        allowed: false,
        remaining: 0
      });
    });

    it("scopes the count to the caller's organization", async () => {
      countGenerations.mockResolvedValue(0);

      await checkAllowance({ orgId: "org1", plan: "free" });

      expect(countGenerations).toHaveBeenCalledWith("org1");
    });

    it("does not spend the repair budget while the free foundation is still unspent", async () => {
      // Regenerating a project you have not paid for yet is still the free foundation. Charging it
      // to repairs would quietly cost the founder a revision they never used.
      countGenerations.mockResolvedValue(0);
      generatedTimes(1);

      const result = await checkAllowance({ orgId: "org1", plan: "free", projectId: "p1" });

      expect(result).toMatchObject({ allowed: true, grant: "free" });
    });
  });

  describe("the repair window", () => {
    beforeEach(() => countGenerations.mockResolvedValue(FREE_GENERATION_LIMIT));

    it("allows a repair on the generated project, inside the window", async () => {
      generatedTimes(1);

      const result = await checkAllowance({
        orgId: "org1",
        plan: "free",
        projectId: "p1",
        now: hoursAfterFirstRun(1)
      });

      expect(result).toMatchObject({ allowed: true, grant: "repair" });
    });

    it("allows the last repair included", async () => {
      // The boundary: one repair already used still leaves the second.
      generatedTimes(FREE_REPAIR_LIMIT);

      const result = await checkAllowance({
        orgId: "org1",
        plan: "free",
        projectId: "p1",
        now: hoursAfterFirstRun(1)
      });

      expect(result).toMatchObject({ allowed: true, grant: "repair" });
    });

    it("refuses the repair after the count is spent, even inside the window", async () => {
      generatedTimes(FREE_REPAIR_LIMIT + 1);

      const result = await checkAllowance({
        orgId: "org1",
        plan: "free",
        projectId: "p1",
        now: hoursAfterFirstRun(1)
      });

      expect(result).toMatchObject({ allowed: false, denial: "repairs-spent" });
    });

    it("refuses the first repair once the window has closed, with the count untouched", async () => {
      // The other edge, proven independently: no repair has been used, and the clock alone refuses.
      generatedTimes(1);

      const result = await checkAllowance({
        orgId: "org1",
        plan: "free",
        projectId: "p1",
        now: hoursAfterFirstRun(REPAIR_WINDOW_HOURS + 1)
      });

      expect(result).toMatchObject({ allowed: false, denial: "window-closed" });
    });

    it("is still open at the last moment of the window", async () => {
      generatedTimes(1);

      const result = await checkAllowance({
        orgId: "org1",
        plan: "free",
        projectId: "p1",
        now: hoursAfterFirstRun(REPAIR_WINDOW_HOURS)
      });

      expect(result).toMatchObject({ allowed: true, grant: "repair" });
    });

    it("measures the window from the project, not the organization", async () => {
      generatedTimes(1);

      await checkAllowance({ orgId: "org1", plan: "free", projectId: "p1" });

      expect(projectUsage).toHaveBeenCalledWith("p1");
    });

    it("caps a free organization at the foundation plus its repairs", async () => {
      // The whole point of bounding repairs by a count: the ceiling is absolute, not per-day.
      generatedTimes(FREE_GENERATION_LIMIT + FREE_REPAIR_LIMIT);

      const result = await checkAllowance({
        orgId: "org1",
        plan: "free",
        projectId: "p1",
        now: hoursAfterFirstRun(1)
      });

      expect(result.allowed).toBe(false);
    });
  });

  describe("plans and exemptions", () => {
    it("lets a Pro organization past the free ceiling", async () => {
      countGenerations.mockResolvedValue(FREE_GENERATION_LIMIT + 20);

      const result = await checkAllowance({ orgId: "org1", plan: "pro" });

      expect(result).toMatchObject({ allowed: true, grant: "pro", unlimited: true });
    });

    it("does not consult the repair window for a Pro organization", async () => {
      countGenerations.mockResolvedValue(FREE_GENERATION_LIMIT + 20);

      await checkAllowance({ orgId: "org1", plan: "pro", projectId: "p1" });

      expect(projectUsage).not.toHaveBeenCalled();
    });

    it("does not consult the admin flag when there is no user to consult it for", async () => {
      // The bypass is read for a user we actually have, never inferred. A caller without a session
      // gets the ordinary limit rather than an accidental exemption.
      countGenerations.mockResolvedValue(0);

      await checkAllowance({ orgId: "org1", plan: "free" });

      expect(isAdminUser).not.toHaveBeenCalled();
    });

    it("exempts an admin account, however many it has already used", async () => {
      isAdminUser.mockResolvedValue(true);
      countGenerations.mockResolvedValue(FREE_GENERATION_LIMIT + 40);

      const result = await checkAllowance({ orgId: "org1", plan: "free", userId: "user1" });

      expect(result).toMatchObject({ allowed: true, grant: "admin", unlimited: true });
    });

    it("still refuses a non-admin who passes a user id", async () => {
      // The exemption comes from the flag, not from having asked with a user id.
      isAdminUser.mockResolvedValue(false);
      countGenerations.mockResolvedValue(FREE_GENERATION_LIMIT);

      const result = await checkAllowance({ orgId: "org1", plan: "free", userId: "user1" });

      expect(result).toMatchObject({ allowed: false, unlimited: false });
    });
  });
});

describe("allowanceMessage", () => {
  const denials = ["free-spent", "repairs-spent", "window-closed"] as const;

  it.each(denials)("tells a founder refused by %s that their work is safe", (denial) => {
    // The first fear on hitting a limit is losing what you already have.
    expect(allowanceMessage(denial)).toMatch(/unaffected/);
  });

  it.each(denials)("does not promise a checkout that does not exist yet (%s)", (denial) => {
    expect(allowanceMessage(denial)).toMatch(/isn't purchasable yet/);
  });

  it("names the window in hours rather than restating the number in prose", () => {
    expect(allowanceMessage("window-closed")).toContain(`${REPAIR_WINDOW_HOURS} hours`);
  });

  it("distinguishes the two ways a repair can be refused", () => {
    expect(allowanceMessage("repairs-spent")).not.toEqual(allowanceMessage("window-closed"));
  });
});

afterEach(() => vi.useRealTimers());
