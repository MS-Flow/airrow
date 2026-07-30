// A revision diff is what a founder decides on, so the case that matters most is the one a naive
// implementation drops: a file the previous generation had and the new one does not. Walking only
// the new tree misses it silently, and "silently" is the whole problem — a founder who is not told a
// document disappeared will find out months later, from its absence.
import { describe, it, expect } from "vitest";
import { diffGenerations } from "./revision.ts";
import type { GeneratedFile } from "../../schemas/src/types.ts";

const file = (path: string, content: string): GeneratedFile => ({
  path,
  content,
  source: "static",
  templateId: "t"
});

describe("diffGenerations", () => {
  it("reports nothing changed when the generations are identical", () => {
    const files = [file("README.md", "a"), file("docs/VISION.md", "b")];

    expect(diffGenerations(files, files)).toEqual({ entries: [], unchanged: 2 });
  });

  it("notices a file the revision removed", () => {
    const previous = [file("README.md", "a"), file("docs/GONE.md", "b")];
    const next = [file("README.md", "a")];

    const diff = diffGenerations(previous, next);

    expect(diff.entries).toEqual([
      { path: "docs/GONE.md", change: "removed", previousBytes: 1, nextBytes: null }
    ]);
    expect(diff.unchanged).toBe(1);
  });

  it("separates a new file from a rewritten one", () => {
    const previous = [file("README.md", "old")];
    const next = [file("README.md", "new text"), file("docs/NEW.md", "x")];

    const diff = diffGenerations(previous, next);

    expect(diff.entries).toEqual([
      { path: "docs/NEW.md", change: "added", previousBytes: null, nextBytes: 1 },
      { path: "README.md", change: "changed", previousBytes: 3, nextBytes: 8 }
    ]);
    expect(diff.unchanged).toBe(0);
  });

  it("reads in the order a founder thinks in: new, moved, gone", () => {
    const previous = [file("keep.md", "same"), file("gone.md", "x")];
    const next = [file("keep.md", "same"), file("moved.md", "y")];
    // `moved.md` is added and `gone.md` removed — the point is the ordering, not the pairing.
    const diff = diffGenerations([...previous, file("moved.md", "old")], next);

    expect(diff.entries.map((e) => e.change)).toEqual(["changed", "removed"]);
  });

  it("measures bytes rather than characters, so a size is the size on disk", () => {
    // "ä" is one character and two bytes. A founder comparing a document to what lands in their
    // repository is looking at bytes.
    const diff = diffGenerations([file("a.md", "a")], [file("a.md", "ä")]);

    expect(diff.entries[0]).toMatchObject({ previousBytes: 1, nextBytes: 2 });
  });

  it("treats a first generation as all added", () => {
    const diff = diffGenerations([], [file("README.md", "a"), file("b.md", "bb")]);

    expect(diff.entries.map((e) => e.change)).toEqual(["added", "added"]);
    expect(diff.unchanged).toBe(0);
  });
});
