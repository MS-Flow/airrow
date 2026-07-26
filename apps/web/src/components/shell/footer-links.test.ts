import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";
import { FOOTER_LINKS } from "./footer-links";

/**
 * A footer full of dead links is worse than no footer, so every href is resolved against
 * the routes and anchors that actually exist (spec 23).
 */
const APP_DIR = fileURLToPath(new URL("../../app", import.meta.url));
const LANDING = fs.readFileSync(path.join(APP_DIR, "page.tsx"), "utf8");

/** Route groups — `(legal)` — are transparent in the URL, so they count as roots too. */
function routeRoots(): string[] {
  const groups = fs
    .readdirSync(APP_DIR, { withFileTypes: true })
    .filter((e) => e.isDirectory() && e.name.startsWith("("))
    .map((e) => path.join(APP_DIR, e.name));
  return [APP_DIR, ...groups];
}

const LINKS = FOOTER_LINKS;

describe("FOOTER_LINKS", () => {
  it("points at pages that exist", () => {
    const missing = LINKS.filter((link) => link.href.startsWith("/") && !link.href.includes("#"))
      .map((link) => link.href.replace(/^\//, "").split("/"))
      .filter(
        (segments) =>
          !routeRoots().some((root) => fs.existsSync(path.join(root, ...segments, "page.tsx")))
      );
    expect(missing).toEqual([]);
  });

  it("points at anchors the landing page renders", () => {
    const anchors = LINKS.filter((link) => link.href.includes("#")).map(
      (link) => link.href.split("#")[1]
    );
    expect(anchors.length).toBeGreaterThan(0);
    for (const anchor of anchors) {
      expect(LANDING).toContain(`id="${anchor}"`);
    }
  });

  it("has no placeholder links", () => {
    for (const link of LINKS) {
      expect(link.href).not.toBe("#");
      expect(link.href.startsWith("/")).toBe(true);
    }
  });
});
