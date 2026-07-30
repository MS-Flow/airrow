import { describe, it, expect, vi } from "vitest";
import type { InterviewAnswers } from "@airrow/schemas";
import { claimGuestDraft, type ClaimDeps } from "./claim";
import { GUEST_DRAFT_VERSION } from "./draft-schema";

/**
 * A complete answer set. `tenancy: "organizations"` and a `capabilities` list containing
 * "ai" deliberately make every conditional question visible, so the fixture exercises the
 * whole interview rather than the short path through it.
 */
const COMPLETE_ANSWERS: InterviewAnswers = {
  productType: "saas",
  problem: "Small agencies track clients in spreadsheets and lose follow-ups.",
  vision: "Give small agencies a CRM they actually keep using.",
  mvpFocus: "Track clients and never miss a follow-up.",
  audience: "b2b",
  coreEntities: "Client, Contact, Deal, Followup",
  tenancy: "organizations",
  authModel: ["email_password"],
  roles: "simple",
  capabilities: ["auth", "organizations", "ai"],
  aiUsage: "llm_calls",
  integrations: "Stripe for billing, Postmark for email.",
  dataSensitivity: "standard",
  scale: "validate",
  framework: "nextjs",
  database: "supabase",
  hosting: "vercel",
  repoProvider: "github",
  team: "solo"
};

function draft(overrides: Record<string, unknown> = {}) {
  return {
    version: GUEST_DRAFT_VERSION,
    name: "Loop CRM",
    description: "A lightweight CRM for small agencies that hate admin.",
    answers: COMPLETE_ANSWERS,
    ...overrides
  };
}

function deps(): ClaimDeps & { createProject: ReturnType<typeof vi.fn> } {
  const createProject = vi.fn(async () => ({ id: "project-1" }));
  return {
    createProject,
    saveAnswers: vi.fn(async () => undefined),
    completeInterview: vi.fn(async () => undefined)
  };
}

describe("claimGuestDraft", () => {
  it("turns a complete draft into a project", async () => {
    const d = deps();
    const result = await claimGuestDraft(draft(), d);

    expect(result).toEqual({ ok: true, projectId: "project-1" });
    expect(d.createProject).toHaveBeenCalledWith(
      "Loop CRM",
      "A lightweight CRM for small agencies that hate admin."
    );
    expect(d.saveAnswers).toHaveBeenCalledOnce();
    expect(d.completeInterview).toHaveBeenCalledWith("project-1");
  });

  it("ignores an organization_id smuggled into the draft", async () => {
    const d = deps();
    const result = await claimGuestDraft(draft({ organization_id: "someone-elses-org" }), d);

    expect(result.ok).toBe(true);
    // The org is closed over by the caller, so it can never arrive as an argument.
    expect(d.createProject).toHaveBeenCalledWith("Loop CRM", expect.any(String));
    for (const call of d.createProject.mock.calls) {
      expect(JSON.stringify(call)).not.toContain("someone-elses-org");
    }
  });

  it("rejects a draft written by an older version without writing", async () => {
    const d = deps();
    const result = await claimGuestDraft(draft({ version: GUEST_DRAFT_VERSION - 1 }), d);

    expect(result.ok).toBe(false);
    expect(d.createProject).not.toHaveBeenCalled();
  });

  it("rejects an incomplete answer set without writing", async () => {
    const d = deps();
    const { productType: _dropped, ...incomplete } = COMPLETE_ANSWERS;
    const result = await claimGuestDraft(draft({ answers: incomplete }), d);

    expect(result.ok).toBe(false);
    expect(d.createProject).not.toHaveBeenCalled();
  });

  it("rejects an answer with a value outside the schema without writing", async () => {
    const d = deps();
    const result = await claimGuestDraft(
      draft({ answers: { ...COMPLETE_ANSWERS, hosting: "my-basement" } }),
      d
    );

    expect(result.ok).toBe(false);
    expect(d.createProject).not.toHaveBeenCalled();
  });

  it("rejects a project name the signed-in path would also reject", async () => {
    const d = deps();
    const result = await claimGuestDraft(draft({ name: "x" }), d);

    expect(result.ok).toBe(false);
    expect(d.createProject).not.toHaveBeenCalled();
  });

  it("rejects a draft that is not an object at all", async () => {
    const d = deps();
    expect((await claimGuestDraft(null, d)).ok).toBe(false);
    expect((await claimGuestDraft("draft", d)).ok).toBe(false);
    expect(d.createProject).not.toHaveBeenCalled();
  });
});
