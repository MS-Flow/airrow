// Reading a repository, and the one guarantee that matters about it (spec 67): a repository and an
// uploaded ZIP of the same project must produce the *same* import. If these two ever diverge there
// are two import truths, and every rule the ZIP path enforces has to be re-proved for the other one.
import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import { analyzeImport } from "@airrow/engine";
import type { GitHubReader, GitHubResult } from "@/lib/github";
import { readArchive } from "./archive";
import { readRepository } from "./repo";

const PROJECT: Record<string, string> = {
  "package.json": JSON.stringify({ dependencies: { next: "15.0.0", stripe: "16.0.0" } }),
  "src/app/page.tsx": "export default function Page() { return null; }",
  ".github/workflows/ci.yml": "name: ci",
  "node_modules/left-pad/index.js": "module.exports = () => {};"
};

/** A ZIP as the founder would upload it: paths at the root. */
async function uploadedZip(): Promise<ArrayBuffer> {
  const zip = new JSZip();
  for (const [path, content] of Object.entries(PROJECT)) zip.file(path, content);
  return zip.generateAsync({ type: "arraybuffer" });
}

/** A ZIP as GitHub serves it: everything inside one `owner-repo-sha/` folder. */
async function zipball(files: Record<string, string> = PROJECT): Promise<ArrayBuffer> {
  const zip = new JSZip();
  for (const [path, content] of Object.entries(files)) zip.file(`ada-loop-crm-9f2c1a/${path}`, content);
  return zip.generateAsync({ type: "arraybuffer" });
}

/** The deterministic double the constitution asks for — no network anywhere in this file. */
function reader(download: () => Promise<GitHubResult<ArrayBuffer>>): GitHubReader {
  return {
    listPublicRepos: () => Promise.resolve({ ok: true, value: { repos: [], hasMore: false } }),
    downloadZipball: () => download()
  };
}

const ok = (bytes: ArrayBuffer): GitHubResult<ArrayBuffer> => ({ ok: true, value: bytes });

describe("readRepository", () => {
  it("analyses a repository exactly as it analyses the same project uploaded as a ZIP", async () => {
    const fromZip = await readArchive(await uploadedZip());
    const fromRepo = await readRepository(reader(async () => ok(await zipball())), "t", "ada", "loop-crm");

    expect(fromZip.ok && fromRepo.ok).toBe(true);
    if (!fromZip.ok || !fromRepo.ok) return;

    expect(fromRepo.files).toEqual(fromZip.files);
    expect(analyzeImport(fromRepo.files, fromRepo.ignored)).toEqual(
      analyzeImport(fromZip.files, fromZip.ignored)
    );
  });

  it("strips GitHub's wrapper folder, so paths are repo-relative", async () => {
    const read = await readRepository(reader(async () => ok(await zipball())), "t", "ada", "loop-crm");

    expect(read.ok && read.files.map((f) => f.path)).toEqual([
      ".github/workflows/ci.yml",
      "package.json",
      "src/app/page.tsx"
    ]);
  });

  it("skips dependency directories without decompressing them", async () => {
    const read = await readRepository(reader(async () => ok(await zipball())), "t", "ada", "loop-crm");

    expect(read.ok && read.files.some((f) => f.path.includes("node_modules"))).toBe(false);
    expect(read.ok && read.ignored).toBe(1);
  });

  it("reads a repository with no commits as an empty project, not as a failure", async () => {
    const read = await readRepository(reader(async () => ok(await zipball({}))), "t", "ada", "empty");

    expect(read.ok && read.files).toEqual([]);
    // The analysis says it derived nothing, which is what makes the interview ask everything.
    expect(read.ok && analyzeImport(read.files).filesAnalyzed).toBe(0);
  });

  it("passes GitHub's own explanation through instead of inventing one", async () => {
    const read = await readRepository(
      reader(async () => ({ ok: false, error: { kind: "not_found", message: "That repository is no longer public, or no longer exists." } })),
      "t",
      "ada",
      "vanished"
    );

    expect(read).toEqual({ ok: false, error: "That repository is no longer public, or no longer exists." });
  });

  it("names the repository, not an archive, when it is too big", async () => {
    const zip = new JSZip();
    zip.file("big.txt", "x".repeat(51 * 1024 * 1024));
    const read = await readRepository(
      reader(async () => ok(await zip.generateAsync({ type: "arraybuffer" }))),
      "t",
      "ada",
      "huge"
    );

    expect(read.ok).toBe(false);
    expect(!read.ok && read.error).toContain("repository");
  });
});
