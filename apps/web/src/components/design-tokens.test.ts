import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Token discipline (constitution III: "tokens, not literals"). Raw colors live
 * in globals.css and nowhere else; sizes come from the type/spacing scale rather
 * than arbitrary pixel values.
 */

const SRC = fileURLToPath(new URL("../", import.meta.url));

/** SVG geometry (viewBox, path data, gradient offsets) is not styling. */
const SVG_ATTRS = /\b(viewBox|d|x1|y1|x2|y2|offset|strokeWidth|width|height)=/;

/**
 * Third-party brand marks, which are the one thing tokens cannot express: their colours belong to
 * somebody else, are fixed by that owner's terms, and must not follow our theme.
 *
 * An allowlist of exact paths rather than a pattern, so adding one stays a deliberate act — and so this
 * never becomes a way to smuggle our own colours past the rule (spec 140).
 */
const VENDOR_MARKS = ["components/brand/google-mark.tsx"];

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return /\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry) ? [full] : [];
  });
}

const files = sourceFiles(SRC).map((path) => ({
  path: path.slice(SRC.length).replace(/\\/g, "/"),
  lines: readFileSync(path, "utf8").split("\n")
}));

describe("design tokens", () => {
  it("has no raw hex colors outside the token layer", () => {
    const offenders = files.flatMap(({ path, lines }) =>
      VENDOR_MARKS.includes(path)
        ? []
        : lines
            .map((line, i) => ({ line, n: i + 1 }))
            .filter(({ line }) => /#[0-9a-fA-F]{3,8}\b/.test(line) && !SVG_ATTRS.test(line))
            .map(({ n }) => `${path}:${n}`)
    );
    expect(offenders).toEqual([]);
  });

  it("has no arbitrary pixel values in class names", () => {
    const offenders = files.flatMap(({ path, lines }) =>
      lines
        .map((line, i) => ({ line, n: i + 1 }))
        .filter(({ line }) => /\[[^\]]*\d+px[^\]]*\]/.test(line))
        .map(({ n }) => `${path}:${n}`)
    );
    expect(offenders).toEqual([]);
  });

  it("has retired the orange accent from the previous design", () => {
    const offenders = files
      .filter(({ lines }) => lines.some((line) => /ff6b3d/i.test(line)))
      .map(({ path }) => path);
    expect(offenders).toEqual([]);
  });
});
