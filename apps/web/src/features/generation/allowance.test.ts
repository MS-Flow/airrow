// The early-access allowance is what stands between an open signup and an unbounded bill, so its
// edges are worth pinning down: off-by-one at the boundary, and whether our own failures cost the
// founder a generation.
import { describe, it, expect, vi, beforeEach } from "vitest";

const countGenerations = vi.hoisted(() => vi.fn());
vi.mock("@/lib/data/store", () => ({ countGenerations }));

import { FREE_GENERATION_LIMIT, checkAllowance } from "./allowance";

describe("checkAllowance", () => {
  beforeEach(() => vi.clearAllMocks());

  it("allows the first generation", async () => {
    countGenerations.mockResolvedValue(0);

    await expect(checkAllowance("org1")).resolves.toEqual({
      allowed: true,
      used: 0,
      remaining: FREE_GENERATION_LIMIT
    });
  });

  it("allows the last one included", async () => {
    // The boundary: three used means three spent, not three remaining.
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
});
