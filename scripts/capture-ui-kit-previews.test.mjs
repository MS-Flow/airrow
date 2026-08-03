import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  readKits,
  readPinnedCli,
  specimenPage,
  themeCss,
  withScreenshots
} from "./capture-ui-kit-previews.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE = fs.readFileSync(path.join(ROOT, "packages/schemas/src/ui-kits.ts"), "utf8");

// The script itself needs a browser and the network, so what is testable here is everything that
// happens before and after that: reading the kits, building the theme and the specimen, and writing
// the result back. Those are also the parts that fail silently — a regex that stops matching reports
// "nothing to do" rather than an error.

/** One kit's block of the source, from its id to the `source:` line that closes it. */
function sliceKit(source, id) {
  const start = source.indexOf(`id: "${id}"`);
  if (start === -1) return "";
  const end = source.indexOf("    source:", start);
  return source.slice(start, end === -1 ? undefined : end);
}

describe("reading the kits out of the real source", () => {
  const kits = readKits(SOURCE);

  it("finds every direction, with what a capture needs", () => {
    expect(kits.length).toBeGreaterThan(0);
    for (const kit of kits) {
      expect(kit.id).toMatch(/^[a-z_]+$/);
      expect(kit.name, `${kit.id} has no name`).toBeTruthy();
      expect(kit.baseColor, `${kit.id} has no base colour`).toBeTruthy();
      expect(kit.design.radius, `${kit.id} has no radius`).toMatch(/rem$/);
      expect(kit.design.logo, `${kit.id} has no brand treatment`).toBeTruthy();
      expect(kit.design.surfaces, `${kit.id} has no surface treatment`).toBeTruthy();
      for (const palette of [kit.light, kit.dark]) {
        expect(Object.keys(palette ?? {}).length, `${kit.id} palette`).toBeGreaterThanOrEqual(6);
      }
    }
  });

  it("reads dark-first per direction rather than for all of them", () => {
    // A single greedy match across the file would make every kit look dark-first, and every capture
    // would be taken in the wrong theme with nothing to say so.
    expect(new Set(kits.map((k) => k.darkFirst)).size).toBe(2);
  });

  it("keeps each direction's palette and design its own", () => {
    expect(new Set(kits.map((k) => k.light.bg)).size).toBe(kits.length);
    expect(new Set(kits.map((k) => k.design.logo)).size).toBe(kits.length);
  });

  it("reads the pinned CLI, so a capture is never of a version nobody ships", () => {
    expect(readPinnedCli(SOURCE)).toMatch(/^[a-z-]+@\d+\.\d+\.\d+$/);
  });

  it("finds nothing in a source that no longer declares one", () => {
    expect(readKits("export const UI_KITS = [];")).toEqual([]);
    expect(readPinnedCli("const x = 1;")).toBeNull();
  });
});

describe("the theme it writes over what init produced", () => {
  const kits = readKits(SOURCE);

  it("sets the variables the components actually read", () => {
    const css = themeCss(kits[0]);
    for (const name of ["--background", "--foreground", "--primary", "--border", "--radius"]) {
      expect(css).toContain(name);
    }
    expect(css).toContain(":root {");
    expect(css).toContain(".dark {");
  });

  it("photographs a dark-first direction in its dark palette", () => {
    const dark = kits.find((k) => k.darkFirst);
    const light = kits.find((k) => !k.darkFirst);
    // `:root` is what renders untoggled, so a dark-first theme has to put its dark values there.
    expect(themeCss(dark).split(".dark {")[0]).toContain(dark.dark.bg);
    expect(themeCss(light).split(".dark {")[0]).toContain(light.light.bg);
  });
});

describe("the specimen it photographs", () => {
  const kits = readKits(SOURCE);

  it("shows the visual language and never an application", () => {
    // The point of the rewrite: a founder picking a look must not be picking a layout. No navigation,
    // no sidebar, no table of rows — those come from what they wrote about their product.
    for (const kit of kits) {
      const page = specimenPage(kit);
      for (const layout of ["sidebar", "<nav", "<table", "SidebarProvider", "breadcrumb"]) {
        expect(page.toLowerCase(), `${kit.id} specimen renders ${layout}`).not.toContain(
          layout.toLowerCase()
        );
      }
    }
  });

  it("builds everything from theme tokens, so each direction colours it", () => {
    for (const kit of kits) {
      const page = specimenPage(kit);
      for (const token of ["bg-background", "text-foreground", "bg-primary", "text-muted-foreground"]) {
        expect(page, `${kit.id}`).toContain(token);
      }
      // A literal colour would look right in one direction and wrong in the other two.
      expect(page, `${kit.id} hardcodes a colour`).not.toMatch(/#[0-9a-f]{3,6}/i);
    }
  });

  it("leads with the Airrow mark, in this direction's own way", () => {
    const seen = new Set();
    for (const kit of kits) {
      // Case-insensitive: the terminal direction's mark is a shell prompt, and `$ airrow` in title
      // case would be the one thing on that page that had never been typed into a shell.
      expect(specimenPage(kit).toLowerCase(), kit.id).toContain("airrow");
      seen.add(kit.design.logo);
    }
    // Three directions, three brand treatments — the picker would be a colour choice otherwise.
    expect(seen.size).toBe(kits.length);
  });

  it("composes each direction differently, not one page in three palettes", () => {
    // Composition is part of the visual language and the part visible in a thumbnail. Three
    // near-identical pages would make this question a colour picker with extra steps.
    const pages = kits.map((k) => specimenPage(k));
    expect(new Set(pages).size).toBe(kits.length);
    expect(new Set(kits.map((k) => k.design.composition)).size).toBe(kits.length);
    // And the composition is actually expressed, not merely recorded.
    const byComposition = Object.fromEntries(kits.map((k, i) => [k.design.composition, pages[i]]));
    expect(byComposition.centred).toContain("items-center");
    expect(byComposition.terminal).toContain("font-mono");
    expect(byComposition["left-stacked"]).toContain("max-w-3xl");
  });

  it("gives the terminal direction a terminal, not a page dressed as one", () => {
    const page = specimenPage(kits.find((k) => k.design.composition === "terminal"));
    // The character: a real session, monospace, a cursor.
    expect(page).toContain("airrow init");
    expect(page).toContain("font-mono");
    // But still a page a product could be built in — a headline, and prose that is not output.
    expect(page).toContain("<h1");
    expect(page).toContain("Start free");
  });

  it("refuses a composition it has no specimen for", () => {
    // Adding a fourth composition to the schema without a page to render is a broken capture, and
    // it should say so rather than photograph whichever one happened to be first.
    expect(() => specimenPage({ id: "x", design: { composition: "diagonal" } })).toThrow(/diagonal/);
  });

  it("separates surfaces the way the direction says it does", () => {
    const expected = {
      "hairline borders": "border border-border",
      "flat, separated by colour": "ring-1 ring-primary/20",
      "single-pixel outlines": "border border-primary/30"
    };
    for (const kit of kits) {
      expect(specimenPage(kit), kit.id).toContain(expected[kit.design.surfaces]);
    }
  });

  it("refuses a surface treatment it has no classes for", () => {
    // Same reason as the composition guard: a fourth option in the schema with nothing to render it
    // should be a broken capture, not a page quietly missing its borders.
    expect(() =>
      specimenPage({ id: "x", design: { composition: "centred", surfaces: "embossed", radius: "0rem" } })
    ).toThrow(/embossed/);
  });

  it("is valid JSX, not HTML attributes", () => {
    expect(specimenPage(kits[0])).not.toMatch(/\sclass="/);
  });
});

describe("pointing the kits at their captures", () => {
  const first = readKits(SOURCE)[0].id;

  it("adds the field once, and updates rather than duplicating on a re-run", () => {
    const once = withScreenshots(SOURCE, { [first]: `${first}.jpg` });
    expect(once).toContain(`screenshot: "/ui-directions/${first}.jpg"`);

    const twice = withScreenshots(once, { [first]: `${first}.jpg` });
    expect(twice.match(new RegExp(`screenshot: "/ui-directions/${first}\\.jpg"`, "g"))).toHaveLength(1);
  });

  it("replaces a stale path instead of leaving both", () => {
    const once = withScreenshots(SOURCE, { [first]: "old.jpg" });
    const twice = withScreenshots(once, { [first]: "new.jpg" });
    expect(twice).toContain("/ui-directions/new.jpg");
    expect(twice).not.toContain("/ui-directions/old.jpg");
  });

  it("touches only the kit it was given", () => {
    // Counting `screenshot:` occurrences would pass for the wrong reason once every kit has one.
    // What matters is that patching one leaves the others exactly as they were.
    const marked = withScreenshots(SOURCE, { [first]: "ONLY-THIS-ONE.jpg" });
    expect(marked.match(/ONLY-THIS-ONE\.jpg/g)).toHaveLength(1);

    for (const kit of readKits(SOURCE).filter((k) => k.id !== first)) {
      const before = /^ {4}screenshot: "[^"]*",$/m.exec(sliceKit(SOURCE, kit.id));
      const after = /^ {4}screenshot: "[^"]*",$/m.exec(sliceKit(marked, kit.id));
      expect(after?.[0], `${kit.id} was touched`).toBe(before?.[0]);
    }
  });

  it("leaves the source alone when the kit is not there", () => {
    expect(withScreenshots(SOURCE, { no_such_kit: "x.jpg" })).toBe(SOURCE);
  });
});
