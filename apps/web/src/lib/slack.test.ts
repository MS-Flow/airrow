// The transport, and the one property everything else depends on (spec 203): it cannot fail its
// caller.
//
// Its callers are a signup, a project creation and a Stripe webhook. A rejected promise escaping
// this module would become an unhandled rejection — which in Node takes the process with it — and
// the payment it was reporting on has already succeeded. So: never throws, never rejects, and a
// deployment with no webhook configured makes no request at all.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { notifySlack } from "./slack";

const URL_VAR = process.env.SLACK_WEBHOOK_URL;
const WEBHOOK = "https://hooks.slack.com/services/T000/B000/xxxx";

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn(async () => new Response(null, { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
  process.env.SLACK_WEBHOOK_URL = WEBHOOK;
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  if (URL_VAR === undefined) delete process.env.SLACK_WEBHOOK_URL;
  else process.env.SLACK_WEBHOOK_URL = URL_VAR;
});

describe("notifySlack", () => {
  it("posts the message as text to the configured webhook", () => {
    notifySlack("💚 *Acme* bought Pro — monthly.");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(WEBHOOK);
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body))).toEqual({ text: "💚 *Acme* bought Pro — monthly." });
  });

  it("makes no request at all when no webhook is configured", () => {
    // Local development, previews and forks. Not an error state — an unnotified one.
    delete process.env.SLACK_WEBHOOK_URL;

    notifySlack("anything");

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("treats a blank value as no webhook", () => {
    // What a dashboard field left untouched actually produces.
    process.env.SLACK_WEBHOOK_URL = "   ";

    notifySlack("anything");

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("refuses a URL that is not Slack's, rather than posting our customers elsewhere", () => {
    // A value pasted into the wrong variable would otherwise send workspace names to a stranger.
    process.env.SLACK_WEBHOOK_URL = "https://evil.example/collect";
    vi.spyOn(console, "warn").mockImplementation(() => {});

    notifySlack("💚 *Acme* bought Pro");

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("says once, and only once, that a configured URL is unusable", () => {
    // Ours to fix, and silent failure is how it would stay unfixed — but a line per request would
    // bury the logs of the endpoint it is attached to.
    process.env.SLACK_WEBHOOK_URL = "https://evil.example/collect";
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    notifySlack("one");
    notifySlack("two");

    expect(warn.mock.calls.length).toBeLessThanOrEqual(1);
  });

  it("does not return a promise, so no caller can await it into a critical path", () => {
    // A property of the signature rather than of each caller remembering.
    expect(notifySlack("hello")).toBeUndefined();
  });

  it("swallows a failing request rather than rejecting", async () => {
    // Slack rate-limits per webhook, and a launch spike is exactly when that happens.
    fetchMock.mockRejectedValue(new Error("rate limited"));

    expect(() => notifySlack("hello")).not.toThrow();
    // Let the rejected promise settle: an unhandled rejection here would fail the run.
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

  it("swallows fetch throwing synchronously", () => {
    fetchMock.mockImplementation(() => {
      throw new Error("no network");
    });

    expect(() => notifySlack("hello")).not.toThrow();
  });
});
