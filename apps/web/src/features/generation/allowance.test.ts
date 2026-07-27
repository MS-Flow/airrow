// The free allowance is what stands between an open signup and an unbounded bill, so its edges are
// worth pinning down: off-by-one at the boundary, whether our own failures cost the founder a
// generation, and that an admin account is exempt without that exemption leaking to anyone else.
import { describe, it, expect, vi, beforeEach } from "vitest";

const countGenerations = vi.hoisted(() => vi.fn());
const isAdminUser = vi.hoisted(() => vi.fn(async () => false));
vi.mock("@/lib/data/store", () => ({ countGenerations, isAdminUser }));

import { FREE_GENERATION_LIMIT, checkAllowance } from "./allowance";

describe("checkAllowance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isAdminUser.mockResolvedValue(false);
  });

  it("allows the first generation", async () => {
    countGenerations.mockResolvedValue(0);

    await expect(checkAllowance("org1")).resolves.toEqual({
      allowed: true,
      used: 0,
      remaining: FREE_GENERATION_LIMIT,
      unlimited: false
    });
  });

  it("allows the last one included", async () => {
    // The boundary: two used means two spent, not two remaining.
    countGenerations.mockResolvedValue(FREE_GENERATION_LIMIT - 1);

    const result = await checkAllowance("org1");

    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(1);
  });

  it("refuses once the allowance is spent", async () => {
    countGenerations.mockResolvedValue(FREE_GENERATION_LIMIT);

    const result = await checkAllowance("org1");

    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it("never reports negative remaining", async () => {
    // Concurrent submits can push the count past the limit; the founder should read "0 left",
    // not "-2 left".
    countGenerations.mockResolvedValue(FREE_GENERATION_LIMIT + 5);

    await expect(checkAllowance("org1")).resolves.toMatchObject({
      allowed: false,
      remaining: 0
    });
  });

  it("scopes the count to the caller's organization", async () => {
    countGenerations.mockResolvedValue(0);

    await checkAllowance("org1");

    expect(countGenerations).toHaveBeenCalledWith("org1");
  });

  it("does not consult the admin flag when there is no user to consult it for", async () => {
    // The bypass is read for a user we actually have, never inferred. A caller without a session
    // gets the ordinary limit rather than an accidental exemption.
    countGenerations.mockResolvedValue(0);

    await checkAllowance("org1");

    expect(isAdminUser).not.toHaveBeenCalled();
  });

  it("exempts an admin account, however many it has already used", async () => {
    isAdminUser.mockResolvedValue(true);
    countGenerations.mockResolvedValue(FREE_GENERATION_LIMIT + 40);

    const result = await checkAllowance("org1", "user1");

    expect(result.allowed).toBe(true);
    expect(result.unlimited).toBe(true);
  });

  it("still refuses a non-admin who passes a user id", async () => {
    // The exemption comes from the flag, not from having asked with a user id.
    isAdminUser.mockResolvedValue(false);
    countGenerations.mockResolvedValue(FREE_GENERATION_LIMIT);

    const result = await checkAllowance("org1", "user1");

    expect(result.allowed).toBe(false);
    expect(result.unlimited).toBe(false);
  });
});
