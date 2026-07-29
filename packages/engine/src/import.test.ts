// Import analysis + diff (spec 63). Deterministic: no provider mock, no network, no clock.
import { describe, it, expect } from "vitest";
import type { ConflictResolution, GeneratedFile, ImportedFile } from "../../schemas/src/types.ts";
import {
  analyzeImport,
  applyResolutions,
  buildPreviewTree,
  checkImportLimits,
  mergeOverlay,
  mergePreviewFiles,
  pathOverlap,
  diffAgainstExisting,
  digestImported,
  hasCodeSignal,
  isIgnoredImportPath,
  sidecarPath,
  stripCommonRoot,
  IMPORT_LIMITS
} from "./import.ts";
import type { PreviewFileEntry, PreviewTreeNode } from "./import.ts";

const file = (path: string, content = "x"): ImportedFile => ({ path, content });

const pkg = (deps: Record<string, string>): ImportedFile =>
  file("package.json", JSON.stringify({ name: "app", dependencies: deps }));

describe("isIgnoredImportPath", () => {
  it("ignores dependency and build directories at any depth", () => {
    expect(isIgnoredImportPath("node_modules/react/index.js")).toBe(true);
    expect(isIgnoredImportPath("apps/web/.next/build.js")).toBe(true);
    expect(isIgnoredImportPath(".git/HEAD")).toBe(true);
    expect(isIgnoredImportPath("src/dist-helper.ts")).toBe(false);
    expect(isIgnoredImportPath("src/index.ts")).toBe(false);
  });
});

describe("stripCommonRoot", () => {
  it("removes the wrapper folder a GitHub archive adds", () => {
    const stripped = stripCommonRoot([file("repo-main/README.md"), file("repo-main/src/app.ts")]);
    expect(stripped.map((f) => f.path)).toEqual(["README.md", "src/app.ts"]);
  });

  it("leaves paths alone when there is no single shared root", () => {
    const files = [file("README.md"), file("src/app.ts")];
    expect(stripCommonRoot(files).map((f) => f.path)).toEqual(["README.md", "src/app.ts"]);
  });
});

describe("checkImportLimits", () => {
  it("rejects a project with more files than the limit, before any analysis", () => {
    const many = Array.from({ length: IMPORT_LIMITS.maxFiles + 1 }, (_, i) => file(`src/f${i}.ts`));
    const result = checkImportLimits(many);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain(String(IMPORT_LIMITS.maxFiles));
  });

  it("rejects a project over the byte limit and names the limit in the error", () => {
    const result = checkImportLimits([file("big.txt", "a".repeat(2048))], {
      maxBytes: 1024,
      maxFiles: 10
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("import limit");
  });

  it("excludes ignored directories from both counts and reports them", () => {
    const result = checkImportLimits(
      [file("src/app.ts"), file("node_modules/react/index.js", "a".repeat(5000))],
      { maxBytes: 1024, maxFiles: 1 }
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.files.map((f) => f.path)).toEqual(["src/app.ts"]);
      expect(result.ignored).toBe(1);
    }
  });
});

describe("analyzeImport", () => {
  it("derives the framework and database from dependencies, with evidence", () => {
    const analysis = analyzeImport([pkg({ next: "15.0.0", "@supabase/supabase-js": "2.0.0" })]);
    expect(analysis.answers.framework).toBe("nextjs");
    expect(analysis.answers.database).toBe("supabase");
    expect(analysis.evidence).toContainEqual({
      field: "framework",
      value: "Next.js",
      source: "package.json → next"
    });
  });

  it("derives capabilities from the dependencies that prove them", () => {
    const analysis = analyzeImport([pkg({ stripe: "17.0.0", resend: "4.0.0" })]);
    expect(analysis.answers.capabilities).toEqual(["payments", "email"]);
  });

  it("answers the AI question only when a vector store proves the kind", () => {
    const llmOnly = analyzeImport([pkg({ "@anthropic-ai/sdk": "0.30.0" })]);
    expect(llmOnly.answers.capabilities).toContain("ai");
    expect(llmOnly.answers.aiUsage).toBeUndefined();

    const withRag = analyzeImport([pkg({ "@anthropic-ai/sdk": "0.30.0", chromadb: "1.9.0" })]);
    expect(withRag.answers.aiUsage).toBe("rag");
  });

  it("reads an org column in the migrations as a multi-tenant data model", () => {
    const analysis = analyzeImport([
      file("supabase/migrations/0001_init.sql", "create table projects (organization_id uuid);")
    ]);
    expect(analysis.answers.tenancy).toBe("organizations");
  });

  it("derives the repo provider from the workflows directory", () => {
    const analysis = analyzeImport([file(".github/workflows/ci.yml", "on: push")]);
    expect(analysis.answers.repoProvider).toBe("github");
  });

  it("leaves questions it cannot prove unanswered rather than guessing", () => {
    const analysis = analyzeImport([pkg({ next: "15.0.0" })]);
    expect(analysis.answers.productType).toBeUndefined();
    expect(analysis.answers.vision).toBeUndefined();
    expect(analysis.answers.team).toBeUndefined();
  });

  it("surfaces a .NET project as a note instead of forcing it into the stack questions", () => {
    const analysis = analyzeImport([file("Api/Api.csproj", "<Project Sdk=\"Microsoft.NET.Sdk\" />")]);
    expect(analysis.answers.framework).toBeUndefined();
    expect(analysis.notes.join(" ")).toContain(".NET");
  });

  it("survives a malformed package.json without throwing", () => {
    const analysis = analyzeImport([file("package.json", "{ not json")]);
    expect(analysis.answers.framework).toBeUndefined();
    expect(analysis.notes.join(" ")).toContain("No package manifest");
  });

  it("is deterministic: the same files in any order give the same analysis", () => {
    const files = [pkg({ next: "15.0.0", stripe: "17.0.0" }), file(".github/workflows/ci.yml")];
    expect(analyzeImport(files)).toEqual(analyzeImport([...files].reverse()));
  });

  it("counts ignored files without analyzing them", () => {
    const analysis = analyzeImport([pkg({ next: "15.0.0" }), file("node_modules/next/package.json")]);
    expect(analysis.filesAnalyzed).toBe(1);
    expect(analysis.filesIgnored).toBe(1);
  });

  it("reports whether the archive held code at all", () => {
    expect(analyzeImport([pkg({ next: "15.0.0" })]).stackDetected).toBe(true);
    expect(analyzeImport([file("README.md", "# Notes")]).stackDetected).toBe(false);
  });
});

// Which of the two first-run commands a foundation ships hangs on this one answer (spec 91), so it
// is tested as its own predicate rather than only through the analysis that reports it.
describe("hasCodeSignal", () => {
  it("is true for a manifest, whatever language it belongs to", () => {
    for (const path of ["package.json", "go.mod", "Cargo.toml", "pyproject.toml", "src/Api/Api.csproj", "Dockerfile"]) {
      expect(hasCodeSignal([path])).toBe(true);
    }
  });

  it("is true for source files, including stacks the analysis cannot name", () => {
    for (const path of ["src/app.ts", "app/models/user.rb", "cmd/main.go", "lib/parser.ex", "db/schema.sql"]) {
      expect(hasCodeSignal([path])).toBe(true);
    }
  });

  it("is false for an archive of documents", () => {
    expect(
      hasCodeSignal(["README.md", "docs/vision.md", "LICENSE", ".gitignore", ".editorconfig", "notes.txt"])
    ).toBe(false);
  });

  it("is false for an empty archive", () => {
    expect(hasCodeSignal([])).toBe(false);
  });

  it("ignores dependencies and build output — vendored code is not this project's stack", () => {
    expect(hasCodeSignal(["node_modules/next/package.json", "dist/bundle.js", ".next/server/page.js"])).toBe(false);
  });

  it("does not depend on the order of the files", () => {
    const paths = ["README.md", "src/main.py", "docs/setup.md"];
    expect(hasCodeSignal(paths)).toBe(hasCodeSignal([...paths].reverse()));
  });

  it("matches regardless of case, so an uppercase MAKEFILE still counts", () => {
    expect(hasCodeSignal(["MAKEFILE"])).toBe(true);
    expect(hasCodeSignal(["src/App.TSX"])).toBe(true);
  });
});

describe("mergePreviewFiles", () => {
  const yours = [{ path: "README.md" }, { path: "src/app.ts" }, { path: "package.json" }];
  const airrow = [{ path: "README.md" }, { path: "CLAUDE.md" }, { path: "package.json" }];
  const noDecisions = new Map<string, ConflictResolution>();

  it("lists both sides once, in path order", () => {
    const merged = mergePreviewFiles(yours, airrow, [], noDecisions);
    // Collated like every other list in the engine: case-insensitive, so `package.json` < `README.md`.
    expect(merged.map((e) => e.path)).toEqual([
      "CLAUDE.md",
      "package.json",
      "README.md",
      "src/app.ts"
    ]);
  });

  it("tags each file with the side it came from", () => {
    const merged = mergePreviewFiles(yours, airrow, [], noDecisions);
    const source = (path: string) => merged.find((e) => e.path === path)?.source;
    expect(source("CLAUDE.md")).toBe("airrow");
    expect(source("src/app.ts")).toBe("yours");
  });

  it("treats a shared path with identical content as Airrow's file, not a conflict", () => {
    // `diffAgainstExisting` reported no conflict, so there is no decision to make.
    const merged = mergePreviewFiles(yours, airrow, [], noDecisions);
    expect(merged.find((e) => e.path === "README.md")?.source).toBe("airrow");
  });

  it("carries the founder's decision on a conflict, so the row can state the outcome", () => {
    const decided = new Map<string, ConflictResolution>([["README.md", "use_generated"]]);
    const merged = mergePreviewFiles(yours, airrow, ["README.md", "package.json"], decided);
    const source = (path: string) => merged.find((e) => e.path === path)?.source;
    expect(source("README.md")).toBe("conflict_takes_airrow");
    expect(source("package.json")).toBe("conflict_keeps_yours");
  });

  it("keeps an explicit 'keep mine' on the founder's side, like the download does", () => {
    const decided = new Map<string, ConflictResolution>([["README.md", "keep_existing"]]);
    const merged = mergePreviewFiles(yours, airrow, ["README.md"], decided);
    expect(merged.find((e) => e.path === "README.md")?.source).toBe("conflict_keeps_yours");
  });

  it("is exactly today's tree for a project that was never imported", () => {
    const merged = mergePreviewFiles([], airrow, [], noDecisions);
    expect(merged.every((e) => e.source === "airrow")).toBe(true);
    expect(merged).toHaveLength(airrow.length);
  });
});

describe("buildPreviewTree", () => {
  const entry = (path: string, source: PreviewFileEntry["source"]): PreviewFileEntry => ({
    path,
    source
  });

  const tree = () =>
    buildPreviewTree([
      entry("src/components/ui/button.tsx", "yours"),
      entry("src/app.ts", "yours"),
      entry("package.json", "yours"),
      entry("docs/VISION.md", "airrow"),
      entry("src/components/Card.tsx", "airrow")
    ]);

  const children = (node: PreviewTreeNode | undefined): PreviewTreeNode[] =>
    node?.kind === "directory" ? node.children : [];

  it("nests files under the directories their paths describe", () => {
    const [docs, src, pkg] = tree();
    expect(docs?.name).toBe("docs");
    expect(src?.name).toBe("src");
    expect(pkg?.name).toBe("package.json");
    expect(children(src).map((n) => n.name)).toEqual(["components", "app.ts"]);
  });

  it("puts directories before files, then alphabetical", () => {
    const components = children(tree()[1])[0];
    expect(children(components).map((n) => n.name)).toEqual(["ui", "Card.tsx"]);
  });

  it("marks a directory as the founder's only when nothing inside can be opened", () => {
    const src = tree()[1];
    const components = children(src)[0];
    const ui = children(components)[0];
    expect(src?.kind === "directory" && src.yoursOnly).toBe(false);
    expect(components?.kind === "directory" && components.yoursOnly).toBe(false);
    expect(ui?.kind === "directory" && ui.yoursOnly).toBe(true);
  });

  it("carries the source down to every file node, for the rail to render", () => {
    const card = children(children(tree()[1])[0]).find((n) => n.name === "Card.tsx");
    expect(card?.kind === "file" && card.source).toBe("airrow");
  });

  it("carries the full path on every node, for stable React keys", () => {
    const ui = children(children(tree()[1])[0])[0];
    expect(ui?.path).toBe("src/components/ui");
  });

  it("describes shape only — no node carries file content or size", () => {
    const json = JSON.stringify(tree());
    expect(json).not.toContain("content");
    expect(json).not.toContain("bytes");
  });

  it("handles an empty project", () => {
    expect(buildPreviewTree([])).toEqual([]);
  });
});

describe("mergeOverlay", () => {
  const f = (path: string, tag: string) => ({ path, tag });

  it("keeps the founder's files and lays Airrow's over the top", () => {
    const merged = mergeOverlay(
      [f("README.md", "theirs"), f("src/app.ts", "theirs")],
      [f("README.md", "ours"), f("CLAUDE.md", "ours")]
    );
    expect(merged.map((x) => `${x.path}:${x.tag}`)).toEqual([
      "CLAUDE.md:ours",
      "README.md:ours",
      "src/app.ts:theirs"
    ]);
  });

  it("leaves the founder's file alone when Airrow sends nothing for that path", () => {
    const merged = mergeOverlay([f("README.md", "theirs")], []);
    expect(merged).toEqual([f("README.md", "theirs")]);
  });
});

describe("pathOverlap", () => {
  it("is 1 when the same project is re-picked", () => {
    expect(pathOverlap(["a.ts", "b.ts"], ["a.ts", "b.ts", "c.ts"])).toBe(1);
  });

  it("is near zero for a different project, which is what the warning keys off", () => {
    expect(pathOverlap(["a.ts", "b.ts", "c.ts", "d.ts"], ["x.ts", "y.ts"])).toBe(0);
  });

  it("tolerates the founder having edited some files since importing", () => {
    expect(pathOverlap(["a.ts", "b.ts", "c.ts", "d.ts"], ["a.ts", "b.ts", "c.ts"])).toBe(0.75);
  });

  it("treats an empty expectation as a match rather than dividing by zero", () => {
    expect(pathOverlap([], ["a.ts"])).toBe(1);
  });
});

// A digest that is its own input: keeps the tests readable while exercising the real code path.
const identityDigest = (content: string): string => content;

describe("digestImported", () => {
  it("keeps only path, size and digest — never the content", () => {
    const [entry] = digestImported([file("src/app.ts", "hello")], () => "d1");
    expect(entry).toEqual({ path: "src/app.ts", bytes: 5, digest: "d1" });
    expect(JSON.stringify(entry)).not.toContain("hello");
  });

  it("excludes ignored directories", () => {
    const digests = digestImported([file("src/a.ts"), file("node_modules/b.js")], identityDigest);
    expect(digests.map((d) => d.path)).toEqual(["src/a.ts"]);
  });
});

describe("diffAgainstExisting", () => {
  const generated = (path: string, content: string): GeneratedFile => ({
    path,
    content,
    source: "static",
    templateId: "t"
  });

  it("separates new files, unchanged files and conflicts", () => {
    const diff = diffAgainstExisting(
      [generated("README.md", "new"), generated("CLAUDE.md", "same"), generated("docs/X.md", "fresh")],
      digestImported([file("README.md", "old"), file("CLAUDE.md", "same")], identityDigest),
      identityDigest
    );
    expect(diff.conflicts.map((e) => e.path)).toEqual(["README.md"]);
    expect(diff.identical.map((e) => e.path)).toEqual(["CLAUDE.md"]);
    expect(diff.added.map((e) => e.path)).toEqual(["docs/X.md"]);
  });

  it("reports both sizes for a conflict so the review screen can show them", () => {
    const diff = diffAgainstExisting(
      [generated("README.md", "abcd")],
      digestImported([file("README.md", "ab")], identityDigest),
      identityDigest
    );
    expect(diff.conflicts[0]).toEqual({ path: "README.md", generatedBytes: 4, existingBytes: 2 });
  });
});

describe("applyResolutions", () => {
  const generated = (path: string): GeneratedFile => ({
    path,
    content: "generated",
    source: "static",
    templateId: "t"
  });
  const existing = (...paths: string[]): ReturnType<typeof digestImported> =>
    digestImported(paths.map((p) => file(p, "old")), identityDigest);

  it("never takes the existing file's path when the founder has not decided", () => {
    const written = applyResolutions(
      [generated("README.md"), generated("docs/NEW.md")],
      existing("README.md"),
      new Map()
    );
    expect(written.map((f) => f.path)).toEqual(["README.airrow.md", "docs/NEW.md"]);
  });

  it("still delivers Airrow's version of an undecided conflict, beside theirs", () => {
    const written = applyResolutions([generated("CLAUDE.md")], existing("CLAUDE.md"), new Map());
    // Dropping it left an imported project with no CLAUDE.md at all and /cleanup nothing to
    // reconcile against — the foundation missing its own documents (spec 91).
    expect(written).toHaveLength(1);
    expect(written[0]?.content).toBe("generated");
  });

  it("sidecars every conflicting document, not just the README", () => {
    const written = applyResolutions(
      [generated("README.md"), generated("CLAUDE.md"), generated("docs/architecture/SYSTEM_OVERVIEW.md")],
      existing("README.md", "CLAUDE.md", "docs/architecture/SYSTEM_OVERVIEW.md"),
      new Map()
    );
    expect(written.map((f) => f.path)).toEqual([
      "README.airrow.md",
      "CLAUDE.airrow.md",
      "docs/architecture/SYSTEM_OVERVIEW.airrow.md"
    ]);
  });

  it("never sidecars a workflow file — Actions would run it as a second pipeline", () => {
    const written = applyResolutions(
      [generated(".github/workflows/ci.yml"), generated("README.md")],
      existing(".github/workflows/ci.yml", "README.md"),
      new Map()
    );
    expect(written.map((f) => f.path)).toEqual(["README.airrow.md"]);
  });

  it("takes an existing file's own path only where that was explicitly chosen", () => {
    const written = applyResolutions(
      [generated("README.md"), generated("CLAUDE.md")],
      existing("README.md", "CLAUDE.md"),
      new Map([["README.md", "use_generated" as const]])
    );
    expect(written.map((f) => f.path)).toEqual(["README.md", "CLAUDE.airrow.md"]);
  });

  it("delivers nothing at all for a file the founder chose to keep — not even a sidecar", () => {
    const written = applyResolutions(
      [generated("README.md")],
      existing("README.md"),
      new Map([["README.md", "keep_existing" as const]])
    );
    expect(written).toEqual([]);
  });
});

describe("sidecarPath", () => {
  it("puts the suffix before the extension, so the file still opens as what it is", () => {
    expect(sidecarPath("README.md")).toBe("README.airrow.md");
    expect(sidecarPath(".github/workflows/ci.yml")).toBe(".github/workflows/ci.airrow.yml");
  });

  it("appends it when there is no extension to sit before", () => {
    expect(sidecarPath("Dockerfile")).toBe("Dockerfile.airrow");
  });

  it("does not read a dotfile's leading dot as an extension", () => {
    expect(sidecarPath(".gitignore")).toBe(".gitignore.airrow");
    expect(sidecarPath("config/.env")).toBe("config/.env.airrow");
  });
});
