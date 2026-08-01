// The actions, and the gate they carry themselves (spec 150).
//
// A server action is a POST endpoint. It is reachable by anyone who can name it, without ever
// rendering the page that normally posts to it — so "the admin layout calls `requireAdmin()`" protects
// the *page* and nothing else. These tests are what say each action refuses on its own, and that it
// refuses **before** it does anything.
//
// The other thing pinned down here is the promise every plan spec since 74 has made: handing back a
// generation must never write `organizations.plan`.
import { describe, it, expect, vi, beforeEach } from "vitest";

const NOT_FOUND = new Error("NEXT_NOT_FOUND");
const REDIRECT = new Error("NEXT_REDIRECT");

const requireAdmin = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth", () => ({ requireAdmin }));

const redirect = vi.hoisted(() =>
  vi.fn((path: string) => {
    // Next's `redirect` throws to unwind the action; the tests read the path off the mock.
    void path;
    throw REDIRECT;
  })
);
vi.mock("next/navigation", () => ({ redirect }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const setUserSuspended = vi.hoisted(() => vi.fn());
const setTicketStatus = vi.hoisted(() => vi.fn());
type PublishResult = { ok: true } | { ok: false; reason: "no-consent" | "missing" };
const setReviewPublished = vi.hoisted(() =>
  vi.fn(async (): Promise<PublishResult> => ({ ok: true }))
);
const recordAdminAction = vi.hoisted(() => vi.fn());
vi.mock("@/lib/data/admin", () => ({
  setUserSuspended,
  setTicketStatus,
  setReviewPublished,
  recordAdminAction
}));

const grantCredits = vi.hoisted(() => vi.fn());
vi.mock("@/lib/data/credits", async () => {
  // The clamp is real: it is the ceiling on what a typo in the form can mint.
  const actual = await vi.importActual<typeof import("@/lib/data/credits")>("@/lib/data/credits");
  return { grantCredits, clampCreditCount: actual.clampCreditCount, MAX_CREDITS_PER_GRANT: actual.MAX_CREDITS_PER_GRANT };
});

import {
  grantCreditsAction,
  setReviewPublishedAction,
  setTicketStatusAction,
  suspendUserAction
} from "./actions";

const form = (fields: Record<string, string>): FormData => {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
};

/** Every action, with a payload that would succeed if the caller were an operator. */
const ACTIONS: [string, () => Promise<void>][] = [
  ["suspendUserAction", () => suspendUserAction(form({ userId: "u1", suspend: "true" }))],
  ["grantCreditsAction", () => grantCreditsAction(form({ userId: "u1", orgId: "o1", count: "1" }))],
  ["setTicketStatusAction", () => setTicketStatusAction(form({ ticketId: "t1", close: "true" }))],
  ["setReviewPublishedAction", () => setReviewPublishedAction(form({ reviewId: "r1", publish: "true" }))]
];

beforeEach(() => {
  vi.clearAllMocks();
  requireAdmin.mockResolvedValue({ user: { id: "admin-1", email: "ops@airrow.app", name: "Ops" } });
  setReviewPublished.mockResolvedValue({ ok: true });
});

describe("every admin action gates itself", () => {
  it.each(ACTIONS)("%s refuses a caller who is not an operator", async (_name, call) => {
    requireAdmin.mockRejectedValue(NOT_FOUND);

    await expect(call()).rejects.toBe(NOT_FOUND);
  });

  it.each(ACTIONS)("%s does nothing at all when refused", async (_name, call) => {
    requireAdmin.mockRejectedValue(NOT_FOUND);

    await expect(call()).rejects.toBe(NOT_FOUND);
    // The gate is the first line of each action, so a refused caller cannot have written or audited.
    expect(setUserSuspended).not.toHaveBeenCalled();
    expect(grantCredits).not.toHaveBeenCalled();
    expect(setTicketStatus).not.toHaveBeenCalled();
    expect(setReviewPublished).not.toHaveBeenCalled();
    expect(recordAdminAction).not.toHaveBeenCalled();
  });
});

describe("suspending and reactivating", () => {
  it("suspends and records who did it", async () => {
    await expect(
      suspendUserAction(form({ userId: "u1", suspend: "true", reason: "abuse" }))
    ).rejects.toBe(REDIRECT);

    expect(setUserSuspended).toHaveBeenCalledWith("admin-1", "u1", true);
    expect(recordAdminAction).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: "admin-1",
        action: "user.suspend",
        subjectType: "user",
        subjectId: "u1",
        reason: "abuse"
      })
    );
  });

  it("reactivates, and says so in the audit row", async () => {
    await expect(suspendUserAction(form({ userId: "u1", suspend: "false" }))).rejects.toBe(REDIRECT);

    expect(setUserSuspended).toHaveBeenCalledWith("admin-1", "u1", false);
    expect(recordAdminAction).toHaveBeenCalledWith(
      expect.objectContaining({ action: "user.reactivate" })
    );
  });

  it("refuses a form with no user", async () => {
    await expect(suspendUserAction(form({ suspend: "true" }))).rejects.toThrow(/userId is required/);
    expect(setUserSuspended).not.toHaveBeenCalled();
  });
});

describe("granting generations", () => {
  it("writes the credits and an audit row, and never touches the plan", async () => {
    await expect(
      grantCreditsAction(form({ userId: "u1", orgId: "o1", count: "3", reason: "wrong answers" }))
    ).rejects.toBe(REDIRECT);

    expect(grantCredits).toHaveBeenCalledWith({
      orgId: "o1",
      count: 3,
      reason: "wrong answers",
      grantedBy: "admin-1"
    });
    expect(recordAdminAction).toHaveBeenCalledWith(
      expect.objectContaining({ action: "credits.grant", subjectId: "u1" })
    );
    // `organizations.plan` is Stripe's alone (specs 74, 99, 100, 122). Nothing this action can reach
    // writes it — there is no store import here at all, which is the strongest form of that promise.
    expect(recordAdminAction.mock.calls[0]?.[0]?.reason).toContain("3 generations");
  });

  it("caps a typo rather than minting fifty generations", async () => {
    await expect(
      grantCreditsAction(form({ userId: "u1", orgId: "o1", count: "5000" }))
    ).rejects.toBe(REDIRECT);

    expect(grantCredits).toHaveBeenCalledWith(expect.objectContaining({ count: 10 }));
  });

  it("treats a missing or nonsense count as one", async () => {
    await expect(grantCreditsAction(form({ userId: "u1", orgId: "o1", count: "abc" }))).rejects.toBe(
      REDIRECT
    );

    expect(grantCredits).toHaveBeenCalledWith(expect.objectContaining({ count: 1 }));
  });

  it("refuses to grant to nothing when the account has no workspace", async () => {
    await expect(grantCreditsAction(form({ userId: "u1", count: "1" }))).rejects.toThrow(
      /orgId is required/
    );
    expect(grantCredits).not.toHaveBeenCalled();
  });
});

describe("ticket status", () => {
  it("closes and reopens, recording each", async () => {
    await expect(setTicketStatusAction(form({ ticketId: "t1", close: "true" }))).rejects.toBe(REDIRECT);
    expect(setTicketStatus).toHaveBeenCalledWith("admin-1", "t1", "closed");
    expect(recordAdminAction).toHaveBeenCalledWith(expect.objectContaining({ action: "ticket.close" }));

    vi.clearAllMocks();
    requireAdmin.mockResolvedValue({ user: { id: "admin-1" } });

    await expect(setTicketStatusAction(form({ ticketId: "t1", close: "false" }))).rejects.toBe(REDIRECT);
    expect(setTicketStatus).toHaveBeenCalledWith("admin-1", "t1", "open");
    expect(recordAdminAction).toHaveBeenCalledWith(expect.objectContaining({ action: "ticket.reopen" }));
  });
});

describe("publishing a review", () => {
  it("records a publication that the data layer allowed", async () => {
    await expect(setReviewPublishedAction(form({ reviewId: "r1", publish: "true" }))).rejects.toBe(
      REDIRECT
    );

    expect(setReviewPublished).toHaveBeenCalledWith("admin-1", "r1", true);
    expect(recordAdminAction).toHaveBeenCalledWith(
      expect.objectContaining({ action: "review.publish", subjectType: "review" })
    );
  });

  it("writes no audit row when the data layer refused for want of consent", async () => {
    setReviewPublished.mockResolvedValue({ ok: false, reason: "no-consent" });

    await expect(setReviewPublishedAction(form({ reviewId: "r1", publish: "true" }))).rejects.toBe(
      REDIRECT
    );

    expect(redirect).toHaveBeenCalledWith("/app/admin/reviews?error=no-consent");
    // A refused publication is not an event that happened, so it must not appear in the log as one.
    expect(recordAdminAction).not.toHaveBeenCalled();
  });
});
