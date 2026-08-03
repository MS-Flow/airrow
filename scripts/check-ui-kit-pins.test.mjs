import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { isBehind, readPins } from "./check-ui-kit-pins.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE = fs.readFileSync(path.join(ROOT, "packages/schemas/src/ui-kits.ts"), "utf8");

describe("reading the pins out of the source", () => {
  it("finds the real ones, and reads an exact version off each", () => {
    // The check exits non-zero on an empty read, so this is what stands between "nothing has moved"
    // and "the regex stopped matching and nobody noticed".
    const pins = readPins(SOURCE);
    expect(pins.length).toBeGreaterThan(0);
    for (const pin of pins) {
      expect(pin.pkg).toBeTruthy();
      expect(pin.version).toMatch(/^\d+\.\d+\.\d+$/);
    }
  });

  it("finds nothing in a source that no longer declares one", () => {
    expect(readPins('const x = { name: "shadcn", release: "4.16.1" };')).toEqual([]);
  });
});

describe("deciding whether a pin has fallen behind", () => {
  it("compares each part as a number, not as text", () => {
    // The failure a string compare makes: "4.9.0" > "4.16.1" lexically, so a real bump reads as fine.
    expect(isBehind("4.9.0", "4.16.1")).toBe(true);
    expect(isBehind("4.16.1", "4.9.0")).toBe(false);
  });

  it("is quiet when the pin is current or ahead", () => {
    expect(isBehind("4.16.1", "4.16.1")).toBe(false);
    expect(isBehind("5.0.0", "4.16.1")).toBe(false);
  });

  it("reports a bump at every level", () => {
    expect(isBehind("4.16.1", "4.16.2")).toBe(true);
    expect(isBehind("4.16.1", "4.17.0")).toBe(true);
    expect(isBehind("4.16.1", "5.0.0")).toBe(true);
  });

  it("says nothing rather than throwing on a version it cannot parse", () => {
    // A prerelease tag is not a reason to open an issue, and not a reason to fail the workflow.
    expect(isBehind("4.16.1", "next")).toBe(false);
    expect(isBehind("", "4.16.1")).toBe(false);
  });
});
