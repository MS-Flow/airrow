// Spending the invite cookie (spec 122).
//
// The interesting cases are all refusals. `/auth/callback` runs on *every* GitHub sign-in, so without
// an account-age check a cookie left over from months ago would credit somebody for a founder who was
// already here — and none of these refusals may interrupt the signup they happen inside.
import { beforeEach, describe, expect, it, vi } from "vitest";

const attachReferral = vi.hoisted(() => vi.fn(async () => true));
const getOrgForUser = vi.hoisted(() =>
  vi.fn(async (): Promise<{ id: string } | null> => ({ id: "org-invited" }))
);
const cookieJar = vi.hoisted(() => ({
  get: vi.fn((): { value: string } | undefined => undefined),
  delete: vi.fn()
}));

vi.mock("next/headers", () => ({ cookies: async () => cookieJar }));
vi.mock("@/lib/data/referrals", () => ({ attachReferral }));
vi.mock("@/lib/data/store", () => ({ getOrgForUser }));

const { INVITE_COOKIE, attachPendingReferral, isInviteCode } = await import("./attach");

/** Anchored, so "how old is this account" never depends on when the suite runs (§V). */
const NOW = Date.parse("2026-08-01T12:00:00.000Z");
const minutesAgo = (minutes: number): string => new Date(NOW - minutes * 60_000).toISOString();

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  cookieJar.get.mockReturnValue(undefined);
  cookieJar.delete.mockClear();
  attachReferral.mockClear();
  attachReferral.mockResolvedValue(true);
  getOrgForUser.mockResolvedValue({ id: "org-invited" });
});

describe("attachPendingReferral", () => {
  it("attaches the code to the new workspace", async () => {
    cookieJar.get.mockReturnValue({ value: "abcd1234efgh" });

    await attachPendingReferral({ id: "user-1", createdAt: minutesAgo(1) });

    expect(attachReferral).toHaveBeenCalledWith("abcd1234efgh", "org-invited");
  });

  it("clears the cookie once it has been used", async () => {
    cookieJar.get.mockReturnValue({ value: "abcd1234efgh" });

    await attachPendingReferral({ id: "user-1", createdAt: minutesAgo(1) });

    expect(cookieJar.delete).toHaveBeenCalledWith(INVITE_COOKIE);
  });

  it("does nothing at all without a cookie", async () => {
    await attachPendingReferral({ id: "user-1", createdAt: minutesAgo(1) });

    expect(attachReferral).not.toHaveBeenCalled();
    expect(cookieJar.delete).not.toHaveBeenCalled();
  });

  it("refuses an account that existed long before the link was clicked", async () => {
    cookieJar.get.mockReturnValue({ value: "abcd1234efgh" });

    await attachPendingReferral({ id: "user-1", createdAt: minutesAgo(60 * 24) });

    expect(attachReferral).not.toHaveBeenCalled();
    // Still cleared: a cookie that cannot be spent is only a chance to credit the wrong account later.
    expect(cookieJar.delete).toHaveBeenCalledWith(INVITE_COOKIE);
  });

  it("refuses a cookie that was never one of ours", async () => {
    cookieJar.get.mockReturnValue({ value: "../../etc/passwd" });

    await attachPendingReferral({ id: "user-1", createdAt: minutesAgo(1) });

    expect(attachReferral).not.toHaveBeenCalled();
  });

  it("refuses an account with no workspace yet", async () => {
    cookieJar.get.mockReturnValue({ value: "abcd1234efgh" });
    getOrgForUser.mockResolvedValue(null);

    await attachPendingReferral({ id: "user-1", createdAt: minutesAgo(1) });

    expect(attachReferral).not.toHaveBeenCalled();
  });

  it("never lets a referral failure break the signup it happens inside", async () => {
    cookieJar.get.mockReturnValue({ value: "abcd1234efgh" });
    attachReferral.mockRejectedValue(new Error("Supabase: connection reset"));

    await expect(
      attachPendingReferral({ id: "user-1", createdAt: minutesAgo(1) })
    ).resolves.toBeUndefined();
  });
});

describe("isInviteCode", () => {
  it("accepts what the invite route mints", () => {
    expect(isInviteCode("Ab3-_xyzQR12")).toBe(true);
  });

  it.each(["", "short", "a".repeat(65), "has spaces", "slash/es"])("rejects %j", (value) => {
    expect(isInviteCode(value)).toBe(false);
  });
});
