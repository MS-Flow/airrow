// What the visit counter is allowed to send (spec 153).
//
// The whole justification for shipping analytics without a consent banner is that this tool stores
// nothing on the visitor's device — so the thing worth testing is not that it renders, but that the
// one piece of judgement we added holds: a signed-in founder's navigation never leaves the browser.
//
// `beforeSend` is captured rather than the network being watched, because it is the decision point;
// whatever it returns null for is never sent at all.
import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";

type Event = { url: string; type: string };
type BeforeSend = (event: Event) => Event | null;

const captured = vi.hoisted(() => ({ beforeSend: null as BeforeSend | null }));

vi.mock("@vercel/analytics/next", () => ({
  Analytics: ({ beforeSend }: { beforeSend?: BeforeSend }) => {
    captured.beforeSend = beforeSend ?? null;
    return null;
  }
}));

import { SiteAnalytics } from "./analytics";

function beforeSend(): BeforeSend {
  render(<SiteAnalytics />);
  const fn = captured.beforeSend;
  if (!fn) throw new Error("SiteAnalytics mounted Analytics without a beforeSend filter");
  return fn;
}

const pageview = (url: string): Event => ({ url, type: "pageview" });

describe("SiteAnalytics", () => {
  it("counts the public pages", () => {
    const filter = beforeSend();

    for (const url of [
      "https://airrow.app/",
      "https://airrow.app/login",
      "https://airrow.app/signup",
      "https://airrow.app/cookies",
      "https://airrow.app/privacy"
    ]) {
      expect(filter(pageview(url))).not.toBeNull();
    }
  });

  it("drops everything inside a signed-in workspace", () => {
    const filter = beforeSend();

    // These paths carry project names and ids. Postgres already answers everything worth knowing
    // about what account holders do (spec 150); this is here to count strangers.
    for (const url of [
      "https://airrow.app/app",
      "https://airrow.app/app/projects/abc-123",
      "https://airrow.app/app/admin",
      "https://airrow.app/app/settings"
    ]) {
      expect(filter(pageview(url))).toBeNull();
    }
  });

  it("excludes a route under /app that does not exist yet", () => {
    // The filter is a prefix rather than a list, so it fails closed: a new private route is excluded
    // on the day it is created rather than on the day someone remembers this file.
    const filter = beforeSend();

    expect(filter(pageview("https://airrow.app/app/something-invented-later"))).toBeNull();
  });

  it("does not mistake a public path that merely starts with the same letters", () => {
    const filter = beforeSend();

    // `/apply` is not `/app`. A careless `includes` would have swallowed it.
    expect(filter(pageview("https://airrow.app/apply"))).not.toBeNull();
    expect(filter(pageview("https://airrow.app/approach"))).not.toBeNull();
  });

  it("drops an event whose url cannot be parsed rather than guessing", () => {
    const filter = beforeSend();

    // Losing one count is cheap; sending a path we meant to withhold is not.
    expect(filter(pageview("not-a-url"))).toBeNull();
    expect(filter(pageview(""))).toBeNull();
  });
});
