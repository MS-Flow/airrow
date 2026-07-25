import { describe, it, expect } from "vitest";
import * as copy from "./copy";
import { FOOTER_LINKS } from "@/components/shell/footer-links";

/**
 * The landing page renders nothing but these strings, so the voice can be checked here
 * once instead of read out of JSX (spec 23): no single AI tool is named, and no sentence
 * leans on the em dash that marks copy as machine-written.
 */
function strings(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(strings);
  if (value && typeof value === "object") return Object.values(value).flatMap(strings);
  return [];
}

const LANDING_STRINGS = [...strings(copy), ...FOOTER_LINKS.map((l) => l.label)];

describe("landing copy", () => {
  it("has strings to check", () => {
    expect(LANDING_STRINGS.length).toBeGreaterThan(30);
  });

  it("names no single AI assistant", () => {
    // CLAUDE.md is a real filename in the output and stays; the product name does not.
    const offenders = LANDING_STRINGS.filter((s) => /claude code/i.test(s));
    expect(offenders).toEqual([]);
  });

  it("uses no em dash or double hyphen", () => {
    const offenders = LANDING_STRINGS.filter((s) => s.includes("—") || s.includes("--"));
    expect(offenders).toEqual([]);
  });
});
