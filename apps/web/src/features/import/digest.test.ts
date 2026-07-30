// Peppered import digests (spec 68). Deterministic: the pepper is set per test, no clock, no network.
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import crypto from "node:crypto";
import { currentDigestVersion, digestFor, LEGACY_DIGEST_VERSION } from "./digest";

const ENV_KEY = "IMPORT_DIGEST_PEPPERS";
const original = process.env[ENV_KEY];

const rawSha256 = (content: string): string =>
  crypto.createHash("sha256").update(content, "utf8").digest("hex");

beforeEach(() => {
  process.env[ENV_KEY] = "1:pepper-one";
});

afterEach(() => {
  if (original === undefined) delete process.env[ENV_KEY];
  else process.env[ENV_KEY] = original;
});

describe("currentDigestVersion", () => {
  it("is the highest configured version, so new imports use the newest key", () => {
    process.env[ENV_KEY] = "1:pepper-one,2:pepper-two";
    expect(currentDigestVersion()).toBe(2);
  });

  it("refuses to run unpeppered rather than silently storing reversible digests", () => {
    delete process.env[ENV_KEY];
    expect(() => currentDigestVersion()).toThrowError(/IMPORT_DIGEST_PEPPERS is not configured/);
  });

  it("ignores malformed entries", () => {
    process.env[ENV_KEY] = "nonsense,0:zero-is-reserved,1:pepper-one,2:";
    expect(currentDigestVersion()).toBe(1);
  });
});

describe("digestFor", () => {
  it("does not produce the raw SHA-256 an attacker would brute-force against", () => {
    const digest = digestFor(1);
    expect(digest("STRIPE_SECRET_KEY=sk_live_abc")).not.toBe(rawSha256("STRIPE_SECRET_KEY=sk_live_abc"));
  });

  it("is stable for the same content and key", () => {
    expect(digestFor(1)("hello")).toBe(digestFor(1)("hello"));
  });

  it("distinguishes different content", () => {
    expect(digestFor(1)("hello")).not.toBe(digestFor(1)("hello "));
  });

  it("gives a different digest under a different key, so a rotation is a real rotation", () => {
    process.env[ENV_KEY] = "1:pepper-one,2:pepper-two";
    expect(digestFor(2)("hello")).not.toBe(digestFor(1)("hello"));
  });

  it("still verifies imports stored before peppering existed", () => {
    expect(digestFor(LEGACY_DIGEST_VERSION)("hello")).toBe(rawSha256("hello"));
  });

  it("keeps working for an older version once a newer key is added", () => {
    const before = digestFor(1)("hello");
    process.env[ENV_KEY] = "1:pepper-one,2:pepper-two";
    expect(digestFor(1)("hello")).toBe(before);
  });

  it("says so plainly when a retired key was dropped from the keyring", () => {
    expect(() => digestFor(7)).toThrowError(/No import digest pepper for version 7/);
  });
});
