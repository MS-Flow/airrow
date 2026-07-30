import { describe, expect, it } from "vitest";

import { PRODUCTION_ORIGIN, allowedOrigin, isAllowedHost } from "./site-url";

describe("isAllowedHost", () => {
  it("accepts the hosts Airrow answers on", () => {
    expect(isAllowedHost("airrow.app")).toBe(true);
    expect(isAllowedHost("www.airrow.app")).toBe(true);
    // The dev environment as it is today, and the branch domain the runbook plans for.
    expect(isAllowedHost("airrow-dev.vercel.app")).toBe(true);
    expect(isAllowedHost("dev.airrow.app")).toBe(true);
  });

  it("accepts a Vercel preview deploy, whose hostname cannot be listed in advance", () => {
    expect(isAllowedHost("airrow-git-113-branded-auth-email.vercel.app")).toBe(true);
  });

  it("accepts local development on either spelling, with or without a port", () => {
    expect(isAllowedHost("localhost:3000")).toBe(true);
    expect(isAllowedHost("127.0.0.1:3000")).toBe(true);
    expect(isAllowedHost("localhost")).toBe(true);
  });

  it("rejects a host that is not ours", () => {
    expect(isAllowedHost("evil.example.com")).toBe(false);
  });

  // The interesting attacks are the ones that look like our domain without being it.
  it("rejects a lookalike that merely ends with our domain", () => {
    expect(isAllowedHost("airrow.app.evil.example.com")).toBe(false);
  });

  it("rejects a lookalike that merely contains our domain", () => {
    expect(isAllowedHost("notairrow.app")).toBe(false);
  });

  it("rejects a lookalike of the preview suffix", () => {
    expect(isAllowedHost("evil-vercel.app")).toBe(false);
  });
});

describe("allowedOrigin", () => {
  it("keeps the host the founder actually signed up on", () => {
    expect(allowedOrigin("dev.airrow.app", "https")).toBe("https://dev.airrow.app");
  });

  it("uses http for local development, where there is no forwarded protocol", () => {
    expect(allowedOrigin("localhost:3000", null)).toBe("http://localhost:3000");
  });

  it("assumes https for a deployed host that forwards no protocol", () => {
    expect(allowedOrigin("dev.airrow.app", null)).toBe("https://dev.airrow.app");
  });

  it("falls back to production for an unlisted host rather than trusting it", () => {
    expect(allowedOrigin("evil.example.com", "https")).toBe(PRODUCTION_ORIGIN);
  });

  it("falls back to production when the request carries no host at all", () => {
    expect(allowedOrigin(null, null)).toBe(PRODUCTION_ORIGIN);
  });

  it("never lets an unlisted host smuggle its own protocol through", () => {
    expect(allowedOrigin("evil.example.com", "javascript")).toBe(PRODUCTION_ORIGIN);
  });
});
