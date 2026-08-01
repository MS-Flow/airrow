// Who a caller is, when the platform will not say (spec 151).
//
// The arithmetic of the two ceilings belongs to `chat-limits.db.test.ts`, against real Postgres.
// What is testable without a database is the decision made *before* it: whether a request that
// carries no address is refused outright, as spec 141 had it, or counted in a bucket everyone
// unidentifiable shares.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { visitorKey } from "./chat-limits";

describe("identifying a chat visitor", () => {
  beforeEach(() => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    process.env.AIRROW_CHAT_IP_SALT = "test-salt";
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.AIRROW_CHAT_IP_SALT;
  });

  it("hashes the address rather than storing it", () => {
    const key = visitorKey("203.0.113.7");

    expect(key).toBeTruthy();
    expect(key).not.toContain("203.0.113.7");
    expect(key).toMatch(/^[0-9a-f]{32}$/);
  });

  it("gives the same visitor the same key, and different visitors different ones", () => {
    expect(visitorKey("203.0.113.7")).toBe(visitorKey("203.0.113.7"));
    expect(visitorKey("203.0.113.7")).not.toBe(visitorKey("203.0.113.8"));
  });

  it("changes every key when the salt changes, so the hash is not a lookup table", () => {
    const before = visitorKey("203.0.113.7");
    process.env.AIRROW_CHAT_IP_SALT = "a different salt";

    expect(visitorKey("203.0.113.7")).not.toBe(before);
  });

  it("counts a caller with no address in a shared bucket instead of refusing them", () => {
    // This is what spec 151 changed. Refusing meant the panel could never answer in a browser on
    // localhost, and a deployment behind a header-stripping proxy sat in FAQ mode forever.
    const key = visitorKey(null);

    expect(key).toBe("shared-no-address");
  });

  it("cannot be confused with a real visitor's key", () => {
    // Hashes are 32 hex characters; the shared bucket deliberately is not, so no address can collide
    // into it — and it is not the reserved name `global`, which the SQL function refuses.
    const shared = visitorKey(null);

    expect(shared).not.toMatch(/^[0-9a-f]{32}$/);
    expect(shared).not.toBe("global");
  });

  it("says out loud when the shared bucket is used", () => {
    visitorKey(null);

    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining("shared bucket"));
  });

  it("still refuses entirely when there is no salt, address or not", () => {
    // A missing salt is different from a missing address: without it there is no way to tell two
    // visitors apart at all, so counting them together would hand the whole world one allowance.
    // Spec 141's rule survives here, and only here.
    delete process.env.AIRROW_CHAT_IP_SALT;

    expect(visitorKey("203.0.113.7")).toBeNull();
    expect(visitorKey(null)).toBeNull();
  });
});
