import { describe, it, expect } from "vitest";
import { FOUNDATION_HIGHLIGHTS, SPEC_LOOP } from "./copy";
import { readFoundation } from "./foundation";

/**
 * The spec-driven section is only honest while it reads the real scaffold. If a template
 * file is renamed or its frontmatter drops, this fails here rather than rendering an
 * empty card in production (spec 23).
 */
describe("readFoundation", () => {
  const foundation = readFoundation();

  it("reads the shipped lifecycle commands in loop order", () => {
    expect(foundation.loop.map((s) => s.name)).toEqual(SPEC_LOOP);
    for (const step of foundation.loop) {
      expect(step.description.length).toBeGreaterThan(0);
    }
  });

  it("highlights files the template actually contains", () => {
    expect(foundation.highlights).toEqual(FOUNDATION_HIGHLIGHTS);
    expect(foundation.fileCount).toBeGreaterThan(foundation.highlights.length);
  });

  it("quotes descriptions that fit the landing page's voice", () => {
    // These render verbatim on the homepage, so they answer to the same dash rule.
    const offenders = foundation.loop.filter(
      (s) => s.description.includes("—") || s.description.includes("--")
    );
    expect(offenders).toEqual([]);
  });
});
