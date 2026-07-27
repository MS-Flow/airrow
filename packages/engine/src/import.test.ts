// Import analysis + diff (spec 63). Deterministic: no provider mock, no network, no clock.
import { describe, it, expect } from "vitest";
import type { GeneratedFile, ImportedFile } from "../../schemas/src/types.ts";
import {
  analyzeImport,
  applyResolutions,
  buildFileTree,
  checkImportLimits,
  mergeOverlay,
  pathOverlap,
  diffAgainstExisting,
  digestImported,
  isIgnoredImportPath,
  stripCommonRoot,
  IMPORT_LIMITS
} from "./import.ts";

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
});

describe("buildFileTree", () => {
  const tree = () =>
    buildFileTree([
      { path: "src/components/ui/button.tsx", bytes: 100 },
      { path: "src/app.ts", bytes: 20 },
      { path: "package.json", bytes: 10 },
      { path: "src/components/Card.tsx", bytes: 50 }
    ]);

  it("nests files under the directories their paths describe", () => {
    const [src, pkg] = tree();
    expect(pkg?.name).toBe("package.json");
    expect(src?.name).toBe("src");
    expect(src?.children?.map((n) => n.name)).toEqual(["components", "app.ts"]);
  });

  it("puts directories before files, then alphabetical", () => {
    const components = tree()[0]?.children?.[0];
    expect(components?.children?.map((n) => n.name)).toEqual(["ui", "Card.tsx"]);
  });

  it("rolls sizes up so a collapsed directory still says how big it is", () => {
    const src = tree()[0];
    expect(src?.bytes).toBe(170);
    expect(src?.children?.find((n) => n.name === "components")?.bytes).toBe(150);
  });

  it("carries the full path on every node, for stable React keys", () => {
    const ui = tree()[0]?.children?.[0]?.children?.[0];
    expect(ui?.path).toBe("src/components/ui");
  });

  it("describes shape only — no node carries file content", () => {
    expect(JSON.stringify(tree())).not.toContain("content");
  });

  it("handles an empty project", () => {
    expect(buildFileTree([])).toEqual([]);
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

  it("keeps the existing file when the founder has not decided", () => {
    const written = applyResolutions(
      [generated("README.md"), generated("docs/NEW.md")],
      existing("README.md"),
      new Map()
    );
    expect(written.map((f) => f.path)).toEqual(["docs/NEW.md"]);
  });

  it("overwrites only the files explicitly chosen", () => {
    const written = applyResolutions(
      [generated("README.md"), generated("CLAUDE.md")],
      existing("README.md", "CLAUDE.md"),
      new Map([["README.md", "use_generated" as const]])
    );
    expect(written.map((f) => f.path)).toEqual(["README.md"]);
  });

  it("never writes a file the founder chose to keep", () => {
    const written = applyResolutions(
      [generated("README.md")],
      existing("README.md"),
      new Map([["README.md", "keep_existing" as const]])
    );
    expect(written).toEqual([]);
  });
});
