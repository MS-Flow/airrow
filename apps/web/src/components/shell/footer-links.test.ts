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

/**
 * Route groups — `(public)`, `(legal)` — are transparent in the URL, so they count as roots too.
 * Nested since spec 158, where `(public)/(legal)/terms/page.tsx` is what serves `/terms`, so the
 * walk recurses instead of looking one level down.
 */
function routeRoots(dir: string = APP_DIR): string[] {
  const groups = fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && e.name.startsWith("("))
    .flatMap((e) => routeRoots(path.join(dir, e.name)));
  return [dir, ...groups];
}

/** `/` itself: the one `page.tsx` sitting at a route root, wherever the groups have put it. */
function landingSource(): string {
  const found = routeRoots()
    .map((root) => path.join(root, "page.tsx"))
    .find((file) => fs.existsSync(file));
  if (!found) throw new Error("no page.tsx at any route root — where did `/` go?");
  return fs.readFileSync(found, "utf8");
}

const LANDING = landingSource();

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
