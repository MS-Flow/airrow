// The promise spec 153 made, held under test (spec 182).
//
// The cookie policy tells visitors, in their own words, that measurement on this site writes nothing
// to their device and that *this is why* they are never shown a banner. That sentence is true because
// of one line of PostHog configuration, and PostHog's own quickstart omits it. Nothing about a
// typecheck or a code review reliably catches `persistence` going back to its default — so this
// file does, and it is the reason a config object is read back rather than trusted.
//
// The second thing asserted here is that the library is not downloaded at all without a key: it is
// 228 kB on the critical path of the landing page, and "we only initialise it when configured" is
// not the same claim as "we only fetch it when configured".
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const posthog = vi.hoisted(() => ({
  config: null as Record<string, unknown> | null,
  captures: [] as { event: string; properties?: Record<string, unknown> }[],
  inits: 0
}));

vi.mock("posthog-js", () => ({
  default: {
    init: (_key: string, config: Record<string, unknown>) => {
      posthog.inits += 1;
      posthog.config = config;
    },
    capture: (event: string, properties?: Record<string, unknown>) => {
      posthog.captures.push({ event, properties });
    }
  }
}));

vi.mock("next/navigation", () => ({ usePathname: () => "/" }));

import {
  POSTHOG_OPTIONS,
  analyticsReady,
  captureClient,
  initAnalytics,
  resetClientAnalyticsForTests
} from "./client";

const KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;

beforeEach(() => {
  posthog.config = null;
  posthog.captures = [];
  posthog.inits = 0;
  resetClientAnalyticsForTests();
  process.env.NEXT_PUBLIC_POSTHOG_KEY = "phc_test";
});

afterEach(() => {
  if (KEY === undefined) delete process.env.NEXT_PUBLIC_POSTHOG_KEY;
  else process.env.NEXT_PUBLIC_POSTHOG_KEY = KEY;
});

describe("the options PostHog is started with", () => {
  it("keeps everything out of the visitor's device", () => {
    // `persistence: "memory"` is the whole of spec 153's no-banner reasoning. If this assertion ever
    // fails, the cookie policy has become false and a consent banner has become mandatory — fix the
    // configuration, or ship the banner and rewrite both legal pages. Do not update this test.
    expect(POSTHOG_OPTIONS.persistence).toBe("memory");
  });

  it("never records a session", () => {
    // Session recording would capture interview answers, which are customer IP (§II).
    expect(POSTHOG_OPTIONS.disable_session_recording).toBe(true);
    expect(POSTHOG_OPTIONS.autocapture).toBe(false);
  });

  it("are the options actually handed to init", async () => {
    // The constant above proves nothing on its own if `init` is passed something else.
    await initAnalytics("");

    expect(posthog.config).toMatchObject(POSTHOG_OPTIONS);
  });
});

describe("initAnalytics", () => {
  it("returns without starting anything when there is no key", async () => {
    // The key check comes *before* the dynamic import, which is what keeps 228 kB off a deployment
    // that measures nothing. That the import itself is deferred is a bundling fact, proven by the
    // build manifest rather than here — a mocked module is resolved by the test runner and would
    // report the same either way, so asserting it here would be theatre.
    delete process.env.NEXT_PUBLIC_POSTHOG_KEY;

    await expect(initAnalytics("")).resolves.toBe(false);
    expect(posthog.inits).toBe(0);
    expect(analyticsReady()).toBe(false);
  });

  it("starts once, however many times it is asked", async () => {
    await initAnalytics("?utm_source=hn");
    await initAnalytics("?utm_source=elsewhere");

    expect(posthog.inits).toBe(1);
    expect(analyticsReady()).toBe(true);
  });
});

describe("captureClient", () => {
  it("sends nothing before analytics has started", () => {
    delete process.env.NEXT_PUBLIC_POSTHOG_KEY;
    captureClient("interview_started", { mode: "guest" });

    expect(posthog.captures).toEqual([]);
  });

  it("holds an event raised while the library is still downloading, and sends it after", async () => {
    // An interview mounts and fires immediately. On a slow connection that lands in the gap the
    // dynamic import opened, and dropping it would lose the top of the funnel for exactly the
    // visitors whose experience matters most.
    captureClient("interview_started", { mode: "guest" });
    expect(posthog.captures).toEqual([]);

    await initAnalytics("");

    expect(posthog.captures).toEqual([
      { event: "interview_started", properties: { mode: "guest" } }
    ]);
  });

  it("carries the campaign the page session arrived on", async () => {
    await initAnalytics("?utm_source=hn&utm_campaign=launch");
    captureClient("interview_started", { mode: "guest" });

    expect(posthog.captures).toEqual([
      {
        event: "interview_started",
        properties: { mode: "guest", utm_source: "hn", utm_campaign: "launch" }
      }
    ]);
  });

  it("sends only what the event declares", async () => {
    await initAnalytics("");
    // The cast reproduces a caller widening its object past the declaration, which the type system
    // alone would have refused.
    captureClient("interview_step", {
      question: "problem",
      index: 1,
      total: 12,
      answer: "A CRM for veterinary clinics"
    } as { question: string; index: number; total: number });

    expect(posthog.captures[0]?.properties).toEqual({ question: "problem", index: 1, total: 12 });
  });
});
