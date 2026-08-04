// The server transport (spec 182): silent without a key, harmless when PostHog is not.
//
// Both halves matter for different reasons. Silent-without-a-key is what makes every developer
// machine, every preview and every fork run the product unmeasured and unbothered. Harmless-when-
// PostHog-is-not is what keeps an analytics host out of the failure path of a payment.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const posthog = vi.hoisted(() => ({
  captures: [] as { distinctId: string; event: string; properties?: Record<string, unknown> }[],
  captureThrows: false,
  flushRejects: false,
  constructed: 0
}));

vi.mock("posthog-node", () => ({
  PostHog: class {
    constructor() {
      posthog.constructed += 1;
    }
    capture(payload: { distinctId: string; event: string; properties?: Record<string, unknown> }) {
      if (posthog.captureThrows) throw new Error("transport is on fire");
      posthog.captures.push(payload);
    }
    flush() {
      return posthog.flushRejects ? Promise.reject(new Error("unreachable")) : Promise.resolve();
    }
  }
}));

import { capture, resetAnalyticsForTests } from "./server";

const KEY = process.env.POSTHOG_KEY;

beforeEach(() => {
  posthog.captures = [];
  posthog.captureThrows = false;
  posthog.flushRejects = false;
  posthog.constructed = 0;
  resetAnalyticsForTests();
  process.env.POSTHOG_KEY = "phc_test";
});

afterEach(() => {
  if (KEY === undefined) delete process.env.POSTHOG_KEY;
  else process.env.POSTHOG_KEY = KEY;
  vi.restoreAllMocks();
});

describe("capture", () => {
  it("sends the event, the workspace id and the declared properties", () => {
    capture("paid", "org_1", { tier: "founding" });

    expect(posthog.captures).toEqual([
      { distinctId: "org_1", event: "paid", properties: { tier: "founding" } }
    ]);
  });

  it("sends nothing at all without a key", () => {
    // The local, preview and fork default. Not an error state — an unmeasured one.
    delete process.env.POSTHOG_KEY;
    resetAnalyticsForTests();

    capture("zip_downloaded", "org_1", { project: "p1" });

    expect(posthog.constructed).toBe(0);
    expect(posthog.captures).toEqual([]);
  });

  it("treats a blank key as no key", () => {
    // An empty environment variable is what a dashboard field left untouched actually produces.
    process.env.POSTHOG_KEY = "   ";
    resetAnalyticsForTests();

    capture("zip_downloaded", "org_1", { project: "p1" });

    expect(posthog.constructed).toBe(0);
  });

  it("builds the client once, however many events are sent", () => {
    capture("zip_downloaded", "org_1", { project: "p1" });
    capture("zip_downloaded", "org_1", { project: "p2" });

    expect(posthog.constructed).toBe(1);
  });

  it("swallows a transport that throws", () => {
    // The caller is a Stripe webhook, a generation or a download. None of them is worth failing.
    posthog.captureThrows = true;
    vi.spyOn(console, "error").mockImplementation(() => {});

    expect(() => capture("paid", "org_1", { tier: "monthly" })).not.toThrow();
  });

  it("swallows a flush that rejects, rather than leaving it unhandled", () => {
    // An unhandled rejection takes the process down in Node, which would turn a slow analytics host
    // into an outage.
    posthog.flushRejects = true;

    expect(() => capture("paid", "org_1", { tier: "monthly" })).not.toThrow();
  });

  it("strips a property the event does not declare, at the transport too", () => {
    // Belt as well as braces: `sanitize` is tested on its own, and this asserts the transport
    // actually applies it rather than passing the caller's object straight through.
    const properties = { project: "p1", email: "founder@example.com" };
    // The cast is the point of the test: it reproduces a caller that has widened its object past
    // what the event declares, which the type system alone would have refused.
    capture("zip_downloaded", "org_1", properties as { project: string });

    expect(posthog.captures[0]?.properties).toEqual({ project: "p1" });
  });
});
