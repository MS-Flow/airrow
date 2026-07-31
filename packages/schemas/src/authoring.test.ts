// The contract an authoring response must satisfy before any of it reaches a file (spec 65).
import { describe, it, expect } from "vitest";
import {
  AUTHORED_TOTAL_MAX_CHARS,
  FLAGGABLE_ANSWERS,
  PROSE_SLOTS,
  SLOT_MAX_CHARS,
  authoredSlotsSchema,
  isProseSlot,
  pickFlaggedAnswers
} from "./authoring.ts";
import { interviewQuestions } from "./questions.ts";

describe("prose slot allowlist", () => {
  it.each(["CMD_DEV", "CMD_BUILD", "CMD_TYPECHECK", "CMD_LINT", "CMD_TEST"])(
    "excludes %s — a command the founder runs",
    (token) => {
      expect(isProseSlot(token)).toBe(false);
    }
  );

  it.each(["SETUP_STEPS", "CI_SETUP_STEPS", "DEPLOY_STEPS"])(
    "excludes %s — a procedure that must be correct, not well phrased",
    (token) => {
      expect(isProseSlot(token)).toBe(false);
    }
  );

  it.each(["PROJECT_NAME", "PROJECT_SLUG", "REPO_PROVIDER", "DEPLOY_TARGET", "STACK_SUMMARY"])(
    "excludes %s — a fact, not writing",
    (token) => {
      expect(isProseSlot(token)).toBe(false);
    }
  );

  it("includes the prose a reader judges as writing", () => {
    expect(isProseSlot("VISION")).toBe(true);
    expect(isProseSlot("DOMAIN_OVERVIEW")).toBe(true);
    expect(isProseSlot("ARCHITECTURE_LAYERS")).toBe(true);
  });

  it("gives every allowlisted slot a ceiling", () => {
    // A slot without a cap is an unbounded write into the founder's files.
    for (const slot of PROSE_SLOTS) {
      expect(SLOT_MAX_CHARS[slot]).toBeGreaterThan(0);
    }
  });
});

describe("authored slots contract", () => {
  it("accepts a partial response", () => {
    // Authoring some slots and leaving the rest deterministic is normal, not a failure.
    const parsed = authoredSlotsSchema.safeParse({ VISION: "A written vision." });

    expect(parsed.success).toBe(true);
  });

  it("accepts null as 'the interview did not support a value'", () => {
    const parsed = authoredSlotsSchema.safeParse({ VISION: null });

    expect(parsed.success).toBe(true);
  });

  it("rejects a slot past its ceiling", () => {
    const parsed = authoredSlotsSchema.safeParse({
      VISION: "x".repeat(SLOT_MAX_CHARS.VISION + 1)
    });

    expect(parsed.success).toBe(false);
  });

  it("rejects a value carrying an unrendered template token", () => {
    // The model echoing prompt scaffolding back is never legitimate content.
    const parsed = authoredSlotsSchema.safeParse({ VISION: "Built on {{STACK_SUMMARY}} for teams." });

    expect(parsed.success).toBe(false);
  });

  it("strips unknown keys rather than failing the generation", () => {
    const parsed = authoredSlotsSchema.safeParse({ VISION: "Fine.", CMD_DEV: "rm -rf /" });

    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data).not.toHaveProperty("CMD_DEV");
  });

  it("bounds the total a response may contribute", () => {
    // This is what sizes max_tokens — an instruction to be brief is not a limit.
    expect(AUTHORED_TOTAL_MAX_CHARS).toBe(
      PROSE_SLOTS.reduce((sum, slot) => sum + SLOT_MAX_CHARS[slot], 0)
    );
  });
});

// A model naming which answers it refused (spec 128). What it names reaches a founder-facing screen,
// so the allowlist here is the same idea as the prose one: only what the interview recognises.
describe("flaggable answers", () => {
  it("covers exactly the answers the founder typed themselves", () => {
    const freeText = interviewQuestions.filter((q) => q.type === "text").map((q) => q.id);

    expect([...FLAGGABLE_ANSWERS]).toEqual(freeText);
  });

  it("excludes a picked option — it came from a list we wrote", () => {
    expect(pickFlaggedAnswers(["productType", "capabilities", "framework"])).toEqual([]);
  });

  it("keeps the free-text answers a rejection is allowed to name", () => {
    expect(pickFlaggedAnswers(["problem", "mvpFocus"])).toEqual(["problem", "mvpFocus"]);
  });

  it.each([
    ["an invented id", ["password"]],
    ["a sentence", ["the problem answer is too vague"]],
    ["values that are not strings", [7, null, { id: "problem" }]],
    ["something that is not a list", "problem"],
    ["nothing at all", undefined]
  ])("drops %s", (_label, raw) => {
    expect(pickFlaggedAnswers(raw)).toEqual([]);
  });

  it("names each answer once", () => {
    expect(pickFlaggedAnswers(["problem", "problem"])).toEqual(["problem"]);
  });
});
