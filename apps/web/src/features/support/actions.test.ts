// What a founder is promised when they write to us (spec 144): the message is kept, and the parts we
// cannot control cannot take it away from them.
//
// The mailer is mocked as the thing it is — something that answers rather than throws — because the
// behaviour worth pinning down here is what the action does with each answer. `redirect` throws in
// Next, so the mock throws too; a mock that returned would let the code run on past a branch that
// ends the request in production.
import { describe, it, expect, vi, beforeEach } from "vitest";

const requireSession = vi.hoisted(() => vi.fn());
const requireSessionEvenIfSuspended = vi.hoisted(() => vi.fn());
const getProject = vi.hoisted(() => vi.fn());
const createTicket = vi.hoisted(() => vi.fn());
const countRecentTickets = vi.hoisted(() => vi.fn());
const saveReview = vi.hoisted(() => vi.fn());
const sendMail = vi.hoisted(() => vi.fn());
const redirect = vi.hoisted(() =>
  vi.fn((url: string) => {
    throw new Error(`redirect:${url}`);
  })
);

vi.mock("@/lib/auth", () => ({ requireSession, requireSessionEvenIfSuspended }));
vi.mock("next/navigation", () => ({ redirect }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/data/store", () => ({ getProject }));
vi.mock("@/lib/data/support", () => ({
  TICKET_DAILY_LIMIT: 5,
  countRecentTickets,
  createTicket,
  saveReview
}));
vi.mock("@/lib/email", () => ({ sendMail }));

import { submitReviewAction, submitTicketAction } from "./actions";

const READY_PROJECT = { id: "p1", name: "Loop CRM", status: "ready" };

/** Where the action sent the browser — the redirect that ended it. */
async function landedOn(run: Promise<void>): Promise<string> {
  try {
    await run;
  } catch (error) {
    return error instanceof Error ? error.message.replace("redirect:", "") : "";
  }
  throw new Error("the action returned without redirecting");
}

function ticketForm(overrides: Record<string, string> = {}): FormData {
  const form = new FormData();
  const fields = {
    category: "generation",
    subject: "Generation failed halfway",
    body: "It stopped at the architecture document and never came back.",
    projectId: "",
    ...overrides
  };
  for (const [key, value] of Object.entries(fields)) form.set(key, value);
  return form;
}

function reviewForm(overrides: Record<string, string> = {}): FormData {
  const form = new FormData();
  const fields = { projectId: "p1", rating: "5", body: "Genuinely useful.", ...overrides };
  for (const [key, value] of Object.entries(fields)) form.set(key, value);
  return form;
}

const SESSION = {
  user: { id: "u1", email: "f@example.com", name: "Founder", createdAt: "2026-01-01T00:00:00.000Z" },
  org: { id: "org1", name: "Workspace", kind: "personal", createdBy: "u1", plan: "free" }
};

beforeEach(() => {
  vi.clearAllMocks();
  requireSession.mockResolvedValue(SESSION);
  // A ticket is the one write a suspended account may still make (spec 164), so this action reads its
  // session through the helper that tolerates one.
  requireSessionEvenIfSuspended.mockResolvedValue({ session: SESSION, suspended: false });
  getProject.mockResolvedValue(READY_PROJECT);
  countRecentTickets.mockResolvedValue(0);
  createTicket.mockResolvedValue({
    id: "t1",
    category: "generation",
    subject: "Generation failed halfway",
    body: "It stopped at the architecture document and never came back.",
    status: "open",
    projectId: null,
    createdAt: "2026-07-31T10:00:00.000Z"
  });
  saveReview.mockResolvedValue({
    review: {
      id: "r1",
      projectId: "p1",
      rating: 5,
      body: "Genuinely useful.",
      consentPublic: false,
      displayName: "Founder",
      createdAt: "2026-07-31T10:00:00.000Z",
      updatedAt: "2026-07-31T10:00:00.000Z"
    },
    replaced: false
  });
  sendMail.mockResolvedValue({ status: "sent", id: "msg_1" });
});

describe("submitTicketAction", () => {
  it("stores the ticket and notifies us, replying to the founder", async () => {
    expect(await landedOn(submitTicketAction(ticketForm()))).toBe("/app/support?sent=t1");

    expect(createTicket).toHaveBeenCalledWith(
      expect.objectContaining({ orgId: "org1", userId: "u1", category: "generation" })
    );
    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({ replyTo: "f@example.com" })
    );
  });

  it("keeps the ticket when the mail fails — the founder is told it was sent either way", async () => {
    sendMail.mockResolvedValue({ status: "failed", reason: "resend 500" });

    expect(await landedOn(submitTicketAction(ticketForm()))).toBe("/app/support?sent=t1");
    expect(createTicket).toHaveBeenCalledTimes(1);
  });

  it("refuses a body too short to act on, before writing anything", async () => {
    expect(await landedOn(submitTicketAction(ticketForm({ body: "help" })))).toBe(
      "/app/support?error=invalid"
    );

    expect(createTicket).not.toHaveBeenCalled();
    expect(sendMail).not.toHaveBeenCalled();
  });

  it("refuses a category that is not one of ours", async () => {
    expect(await landedOn(submitTicketAction(ticketForm({ category: "urgent" })))).toBe(
      "/app/support?error=invalid"
    );
    expect(createTicket).not.toHaveBeenCalled();
  });

  it("stops at the daily limit, writing no row and sending no mail", async () => {
    countRecentTickets.mockResolvedValue(5);

    expect(await landedOn(submitTicketAction(ticketForm()))).toBe("/app/support?error=limit");

    expect(createTicket).not.toHaveBeenCalled();
    expect(sendMail).not.toHaveBeenCalled();
  });

  it("takes a suspended founder's ticket — asking to come back is the point (spec 164)", async () => {
    requireSessionEvenIfSuspended.mockResolvedValue({ session: SESSION, suspended: true });

    expect(await landedOn(submitTicketAction(ticketForm()))).toBe("/app/support?sent=t1");
    expect(createTicket).toHaveBeenCalled();
  });

  it("rate-limits a suspended founder exactly like anyone else", async () => {
    // Two different refusals, and conflating them would tell someone their account is suspended when
    // what actually happened is that they wrote six tickets today.
    requireSessionEvenIfSuspended.mockResolvedValue({ session: SESSION, suspended: true });
    countRecentTickets.mockResolvedValue(5);

    expect(await landedOn(submitTicketAction(ticketForm()))).toBe("/app/support?error=limit");
    expect(createTicket).not.toHaveBeenCalled();
  });

  it("attaches a project only after checking it belongs to this workspace", async () => {
    // The one field a founder could point at someone else's project (§II).
    getProject.mockResolvedValue(null);

    await landedOn(
      submitTicketAction(ticketForm({ projectId: "11111111-1111-4111-8111-111111111111" }))
    );

    expect(getProject).toHaveBeenCalledWith("org1", "11111111-1111-4111-8111-111111111111");
    expect(createTicket).toHaveBeenCalledWith(expect.objectContaining({ projectId: null }));
  });
});

describe("submitReviewAction", () => {
  it("saves the review and lands back on the project", async () => {
    expect(await landedOn(submitReviewAction(reviewForm()))).toBe("/app/projects/p1?review=saved");

    expect(saveReview).toHaveBeenCalledWith(
      expect.objectContaining({ orgId: "org1", projectId: "p1", rating: 5, consentPublic: false })
    );
  });

  it("refuses a rating outside one to five", async () => {
    expect(await landedOn(submitReviewAction(reviewForm({ rating: "7" })))).toBe(
      "/app/projects/p1?review=invalid"
    );
    expect(saveReview).not.toHaveBeenCalled();
  });

  it("refuses more words than the field accepts", async () => {
    expect(await landedOn(submitReviewAction(reviewForm({ body: "x".repeat(1001) })))).toBe(
      "/app/projects/p1?review=invalid"
    );
    expect(saveReview).not.toHaveBeenCalled();
  });

  it("refuses a project that is not ready — there is nothing to have an opinion about yet", async () => {
    getProject.mockResolvedValue({ ...READY_PROJECT, status: "generating" });

    expect(await landedOn(submitReviewAction(reviewForm()))).toBe("/app");
    expect(saveReview).not.toHaveBeenCalled();
  });

  it("refuses another workspace's project", async () => {
    getProject.mockResolvedValue(null);

    expect(await landedOn(submitReviewAction(reviewForm()))).toBe("/app");
    expect(saveReview).not.toHaveBeenCalled();
  });

  it("takes the consented byline, and falls back to the account name when it is blank", async () => {
    await landedOn(submitReviewAction(reviewForm({ consentPublic: "on", displayName: "" })));

    expect(saveReview).toHaveBeenCalledWith(
      expect.objectContaining({ consentPublic: true, displayName: "Founder" })
    );
  });

  it("keeps the review when the mail fails", async () => {
    sendMail.mockResolvedValue({ status: "failed", reason: "network" });

    expect(await landedOn(submitReviewAction(reviewForm()))).toBe("/app/projects/p1?review=saved");
    expect(saveReview).toHaveBeenCalledTimes(1);
  });

  it("never asks the mailer to publish anything — consent is recorded, not acted on", async () => {
    await landedOn(submitReviewAction(reviewForm({ consentPublic: "on" })));

    const saved = saveReview.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(saved).not.toHaveProperty("publishedAt");
  });
});
