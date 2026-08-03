// What may leave the process, and what may not (spec 182).
//
// The point of these tests is the second half. A funnel is a standing invitation to add "just one
// more useful property", and the useful ones are almost always the identifying ones — the email so
// you can look someone up, the project name so the chart reads nicely. `sanitize` is the wall, and
// this file is what makes the wall fail loudly instead of quietly widening.
import { describe, it, expect } from "vitest";
import { EVENT_NAMES, distinctIdForOrg, isPrivatePath, readUtm, sanitize } from "./events";

describe("sanitize", () => {
  it("keeps the properties an event is declared to carry", () => {
    expect(sanitize("interview_step", { question: "mvpFocus", index: 4, total: 12 })).toEqual({
      question: "mvpFocus",
      index: 4,
      total: 12
    });
  });

  it("drops any property the event does not declare", () => {
    // The whole reason this function exists. Every one of these is a plausible thing somebody adds
    // to make a dashboard nicer, and every one of them is a customer's identity.
    const sent = sanitize("signup", {
      method: "email",
      email: "founder@example.com",
      name: "Ada Lovelace",
      userId: "u_1"
    });

    expect(sent).toEqual({ method: "email" });
  });

  it("drops answer text even when it arrives under a declared key", () => {
    // Interview answers are customer IP (§II) and must never reach a third party. A property whose
    // *name* is allowed is not a property whose contents are.
    const sent = sanitize("interview_step", {
      question: "problem",
      index: 2,
      total: 12,
      answer: "We are building a CRM for veterinary clinics."
    });

    expect(sent).not.toHaveProperty("answer");
    expect(Object.values(sent)).not.toContain("We are building a CRM for veterinary clinics.");
  });

  it("drops values that are not scalars", () => {
    // An object smuggles a whole record through a key that looks fine on its own.
    expect(sanitize("zip_downloaded", { project: { id: "p1", name: "Pied Piper" } })).toEqual({});
  });

  it("carries campaign parameters onto any event", () => {
    expect(
      sanitize("paid", { tier: "founding" }, { utm_source: "hn", utm_campaign: "launch" })
    ).toEqual({ tier: "founding", utm_source: "hn", utm_campaign: "launch" });
  });

  it("never lets an unknown event name through as a free-for-all", () => {
    // Every declared name has a list. A name that somehow arrives without one must drop everything
    // rather than default to sending it — the safe direction is a missing chart, not a leak.
    for (const name of EVENT_NAMES) {
      expect(sanitize(name, { email: "founder@example.com" })).toEqual({});
    }
  });
});

describe("readUtm", () => {
  it("reads the five campaign parameters and nothing else", () => {
    expect(readUtm("?utm_source=hn&utm_medium=social&ref=someone&gclid=abc")).toEqual({
      utm_source: "hn",
      utm_medium: "social"
    });
  });

  it("drops a parameter that is present but empty", () => {
    // `?utm_source=` is not a channel, and an empty string on a chart reads as one.
    expect(readUtm("?utm_source=&utm_campaign=launch")).toEqual({ utm_campaign: "launch" });
  });

  it("truncates a campaign value, which anyone can write", () => {
    const long = "x".repeat(500);
    const utm = readUtm(`?utm_campaign=${long}`);

    expect(utm.utm_campaign).toHaveLength(100);
  });

  it("reads nothing out of a query string that has none", () => {
    expect(readUtm("")).toEqual({});
  });
});

describe("isPrivatePath", () => {
  it("treats a workspace path as private", () => {
    expect(isPrivatePath("/app")).toBe(true);
    expect(isPrivatePath("/app/projects/abc")).toBe(true);
  });

  it("does not swallow public paths that merely start with the same letters", () => {
    // The bug spec 153's first version shipped: `startsWith("/app")` also eats `/apply`.
    expect(isPrivatePath("/apply")).toBe(false);
    expect(isPrivatePath("/approach")).toBe(false);
    expect(isPrivatePath("/")).toBe(false);
  });
});

describe("distinctIdForOrg", () => {
  it("names a workspace and nothing about a person", () => {
    expect(distinctIdForOrg("11111111-2222-3333-4444-555555555555")).toBe(
      "org_11111111-2222-3333-4444-555555555555"
    );
  });
});
