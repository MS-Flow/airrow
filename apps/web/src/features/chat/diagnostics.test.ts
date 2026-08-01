// What the chat is allowed to say about itself, and to whom (spec 151).
//
// Two promises live here and they pull in opposite directions: an operator must be able to see why
// the chat went quiet, and a visitor must not. These tests pin both, plus the one detail that would
// silently undo the whole thing — gating the header on the wrong environment variable.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  CHAT_REASON_HEADER,
  diagnosticHeaders,
  reportChatUnavailable,
  reportSharedBucket,
  UNAVAILABLE_REPLY
} from "./diagnostics";

describe("chat diagnostics", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    delete process.env.VERCEL_ENV;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.VERCEL_ENV;
  });

  it("logs the cause with a prefix that can be searched for", () => {
    reportChatUnavailable("limit-store-unreachable");

    expect(console.error).toHaveBeenCalledWith("[chat] unavailable: limit-store-unreachable");
  });

  it("says when an answer fell into the shared bucket, so a proxy deploy is not silent", () => {
    reportSharedBucket();

    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining("[chat]"));
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining("x-forwarded-for"));
  });

  it("returns the cause as a header outside production", () => {
    process.env.VERCEL_ENV = "preview";
    expect(diagnosticHeaders("no-api-key")).toEqual({ [CHAT_REASON_HEADER]: "no-api-key" });

    process.env.VERCEL_ENV = "development";
    expect(diagnosticHeaders("no-salt")).toEqual({ [CHAT_REASON_HEADER]: "no-salt" });
  });

  it("returns nothing at all in production", () => {
    process.env.VERCEL_ENV = "production";

    expect(diagnosticHeaders("no-api-key")).toEqual({});
  });

  it("still returns the header when VERCEL_ENV is unset, which is local development", () => {
    expect(diagnosticHeaders("model-call-failed")).toEqual({
      [CHAT_REASON_HEADER]: "model-call-failed"
    });
  });

  it("is gated on VERCEL_ENV and not NODE_ENV", () => {
    // The one that matters. Vercel builds *preview* with NODE_ENV === "production", so a NODE_ENV
    // gate would have stayed silent on exactly the deployment the original bug was in — while
    // looking entirely reasonable in review.
    process.env.VERCEL_ENV = "preview";

    expect(diagnosticHeaders("no-api-key")).toEqual({ [CHAT_REASON_HEADER]: "no-api-key" });
    expect(process.env.NODE_ENV).not.toBe("preview");
  });

  it("never lets the cause reach the visitor's body", () => {
    // The body is a constant with no room for a reason. That is the guarantee, not a convention.
    expect(UNAVAILABLE_REPLY).toEqual({ status: "unavailable" });
    expect(JSON.stringify(UNAVAILABLE_REPLY)).not.toMatch(/reason|cause|key|salt/i);
  });
});
