// Reading an uploaded archive (spec 63). The archive is untrusted, so these cover the refusals
// as much as the happy path. Deterministic: fixtures are built in-process, no network, no clock.
import { describe, it, expect } from "vitest";
import JSZip from "jszip";
import { IMPORT_LIMITS } from "@airrow/engine";
import { normalizePath, readArchive, sha256 } from "./archive";

async function archiveOf(entries: Record<string, string>): Promise<ArrayBuffer> {
  const zip = new JSZip();
  for (const [path, content] of Object.entries(entries)) zip.file(path, content);
  const bytes = await zip.generateAsync({ type: "uint8array" });
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}

/**
 * The same, but with the backslash separators Windows' `Compress-Archive` writes — including the
 * bare folder entries it emits for directories that contain only subdirectories.
 */
async function windowsArchiveOf(entries: Record<string, string>): Promise<ArrayBuffer> {
  const backslash = String.fromCharCode(92);
  const renamed = Object.fromEntries(
    Object.entries(entries).map(([path, content]) => [path.replace(/\//g, backslash), content])
  );
  return archiveOf(renamed);
}

describe("readArchive", () => {
  it("reads the files of a project archive", async () => {
    const result = await readArchive(
      await archiveOf({ "package.json": "{}", "src/app.ts": "export {}" })
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.files.map((f) => f.path)).toEqual(["package.json", "src/app.ts"]);
  });

  it("strips the wrapper folder a GitHub archive adds", async () => {
    const result = await readArchive(
      await archiveOf({ "loop-crm-main/package.json": "{}", "loop-crm-main/src/app.ts": "x" })
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.files.map((f) => f.path)).toEqual(["package.json", "src/app.ts"]);
  });

  it("skips dependency and build directories and reports how many", async () => {
    const result = await readArchive(
      await archiveOf({ "package.json": "{}", "node_modules/react/index.js": "x", ".next/build": "y" })
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.files.map((f) => f.path)).toEqual(["package.json"]);
      expect(result.ignored).toBe(2);
    }
  });

  // Regression: JSZip's `dir` flag is false for every folder in a Windows-written archive, so
  // filtering on it alone stored directories as zero-byte files and inflated the file count.
  it("does not treat a Windows archive's folder entries as files", async () => {
    const result = await readArchive(
      await windowsArchiveOf({
        "proj/.github/": "",
        "proj/.github/workflows/ci.yml": "on: push",
        "proj/package.json": "{}",
        "proj/src/app.ts": "export {}"
      })
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.files.map((f) => f.path)).toEqual([
        ".github/workflows/ci.yml",
        "package.json",
        "src/app.ts"
      ]);
      expect(result.files.every((f) => !f.path.endsWith("/"))).toBe(true);
    }
  });

  it("reads a Windows archive's paths with forward slashes", async () => {
    const result = await readArchive(
      await windowsArchiveOf({ "proj/src/lib/util.ts": "x", "proj/package.json": "{}" })
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.files.map((f) => f.path)).toEqual(["package.json", "src/lib/util.ts"]);
  });

  it("refuses a file that is not a ZIP archive", async () => {
    const notAZip = new TextEncoder().encode("this is not a zip");
    const result = await readArchive(notAZip.buffer);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("ZIP");
  });

  it("refuses an archive whose contents exceed the byte limit once decompressed", async () => {
    // Highly compressible content: small on the wire, over the limit when expanded.
    const result = await readArchive(
      await archiveOf({ "big.txt": "a".repeat(IMPORT_LIMITS.maxBytes + 1) })
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("import limit");
  });
});

describe("normalizePath", () => {
  it("refuses an entry that walks out of the project tree", () => {
    expect(normalizePath("../../etc/passwd")).toBeNull();
    expect(normalizePath("src/../../secrets")).toBeNull();
  });

  it("normalises separators and leading noise", () => {
    expect(normalizePath("src\\lib\\app.ts")).toBe("src/lib/app.ts");
    expect(normalizePath("./README.md")).toBe("README.md");
    expect(normalizePath("/absolute.md")).toBe("absolute.md");
  });

  it("refuses an empty name", () => {
    expect(normalizePath("")).toBeNull();
  });
});

describe("sha256", () => {
  it("is stable for the same content and different for different content", () => {
    expect(sha256("hello")).toBe(sha256("hello"));
    expect(sha256("hello")).not.toBe(sha256("hello "));
  });
});
