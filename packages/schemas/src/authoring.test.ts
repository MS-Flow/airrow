// The contract an authoring response must satisfy before any of it reaches a file (spec 65).
import { describe, it, expect } from "vitest";
import {
  AUTHORED_TOTAL_MAX_CHARS,
  PROSE_SLOTS,
  SLOT_MAX_CHARS,
  authoredSlotsSchema,
  isProseSlot
} from "./authoring.ts";

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
