import { describe, it, expect } from "vitest";
import { resolvePreviewLink } from "./links";

describe("resolving a link inside a previewed file", () => {
  it("resolves a sibling against the file's own directory", () => {
    expect(resolvePreviewLink("docs/VISION.md", "SYSTEM_OVERVIEW.md")).toEqual({
      kind: "file",
      path: "docs/SYSTEM_OVERVIEW.md"
    });
  });

  it("resolves a link from a file at the repo root", () => {
    expect(resolvePreviewLink("START_HERE.md", "CLAUDE.md")).toEqual({
      kind: "file",
      path: "CLAUDE.md"
    });
  });

  it("climbs out of a directory with ..", () => {
    expect(resolvePreviewLink("docs/architecture/BRANCHING.md", "../../CLAUDE.md")).toEqual({
      kind: "file",
      path: "CLAUDE.md"
    });
  });

  it("handles the deep relative links the generated commands actually use", () => {
    expect(resolvePreviewLink(".claude/commands/start.md", "../../START_HERE.md")).toEqual({
      kind: "file",
      path: "START_HERE.md"
    });
    expect(
      resolvePreviewLink(".claude/commands/start.md", "../../docs/architecture/BRANCHING.md")
    ).toEqual({ kind: "file", path: "docs/architecture/BRANCHING.md" });
  });

  it("treats a leading slash as the repo root, not the site root", () => {
    expect(resolvePreviewLink("docs/guides/DEVELOPER_GUIDE.md", "/specs/README.md")).toEqual({
      kind: "file",
      path: "specs/README.md"
    });
  });

  it("clamps at the root rather than escaping the repo", () => {
    expect(resolvePreviewLink("CLAUDE.md", "../../../etc/passwd")).toEqual({
      kind: "file",
      path: "etc/passwd"
    });
  });

  it("drops a fragment or query — they point into the file, not at another one", () => {
    expect(resolvePreviewLink("START_HERE.md", "CLAUDE.md#commands")).toEqual({
      kind: "file",
      path: "CLAUDE.md"
    });
  });

  it("leaves a same-document anchor to the browser", () => {
    expect(resolvePreviewLink("START_HERE.md", "#the-loop")).toEqual({ kind: "anchor" });
  });

  it("leaves external links alone", () => {
    for (const href of [
      "https://example.com/x",
      "http://example.com",
      "//example.com",
      "mailto:a@b.c"
    ]) {
      expect(resolvePreviewLink("START_HERE.md", href), href).toEqual({ kind: "external" });
    }
  });
});
