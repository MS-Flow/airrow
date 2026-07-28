// Import analysis (spec 63). Deterministic by design: manifest files, dependency names and
// folder structure only — no LLM, no I/O, no env. The same files always yield the same
// ImportAnalysis, which is what makes this testable without a provider mock.
//
// Imported content is untrusted: every parse is total (never throws), and nothing read here is
// ever executed — it only ever becomes evidence and prefilled interview answers.

import type {
  AiUsage,
  ConflictResolution,
  Database,
  FeatureId,
  Framework,
  GeneratedFile,
  Hosting,
  ImportAnalysis,
  ImportDiff,
  ImportDiffEntry,
  ImportedFile,
  ImportedFileDigest,
  ImportEvidence,
  ImportLimits,
  InterviewAnswers,
  RepoProvider,
  Tenancy
} from "../../schemas/src/types.ts";

/** Directories excluded from the limits and from analysis — dependencies and build output. */
export const IGNORED_IMPORT_DIRECTORIES = ["node_modules", ".git", "dist", ".next"] as const;

export const IMPORT_LIMITS: ImportLimits = { maxBytes: 50 * 1024 * 1024, maxFiles: 5000 };

const byteLength = (s: string): number => new TextEncoder().encode(s).length;

export function isIgnoredImportPath(path: string): boolean {
  const ignored: readonly string[] = IGNORED_IMPORT_DIRECTORIES;
  return path.split("/").some((segment) => ignored.includes(segment));
}

/** Drop ignored directories and order by path, so every downstream step sees one canonical list. */
function analyzable(files: ImportedFile[]): ImportedFile[] {
  return files.filter((f) => !isIgnoredImportPath(f.path)).sort((a, b) => a.path.localeCompare(b.path));
}

/**
 * An archive exported from GitHub wraps everything in one top-level folder. Strip it so imported
 * paths line up with the repo-relative paths the engine generates.
 */
export function stripCommonRoot<T extends { path: string }>(files: ReadonlyArray<T>): T[] {
  const first = files[0];
  if (first === undefined) return [...files];
  const root = first.path.split("/")[0];
  if (root === undefined || root === "") return [...files];
  const shared = files.every((f) => f.path.startsWith(`${root}/`));
  return shared ? files.map((f) => ({ ...f, path: f.path.slice(root.length + 1) })) : [...files];
}

export type ImportLimitCheck =
  | { ok: true; files: ImportedFile[]; ignored: number }
  | { ok: false; error: string };

/**
 * Enforce the ceilings *before* anything is analyzed, and hand back the filtered list so no caller
 * can forget to exclude the ignored directories.
 */
export function checkImportLimits(
  files: ImportedFile[],
  limits: ImportLimits = IMPORT_LIMITS
): ImportLimitCheck {
  const kept = analyzable(files);
  if (kept.length > limits.maxFiles) {
    return {
      ok: false,
      error: `This project has ${kept.length} files — the import limit is ${limits.maxFiles} (excluding ${IGNORED_IMPORT_DIRECTORIES.join(", ")}).`
    };
  }
  const bytes = kept.reduce((sum, f) => sum + byteLength(f.content), 0);
  if (bytes > limits.maxBytes) {
    const mb = (n: number): string => `${Math.round(n / (1024 * 1024))} MB`;
    return {
      ok: false,
      error: `This project is ${mb(bytes)} — the import limit is ${mb(limits.maxBytes)} (excluding ${IGNORED_IMPORT_DIRECTORIES.join(", ")}).`
    };
  }
  return { ok: true, files: kept, ignored: files.length - kept.length };
}

/* ── Signals ──────────────────────────────────────────────────────────────── */

/** Dependency names that prove a capability. Evaluated in order; the first hit wins per field. */
const CAPABILITY_DEPENDENCIES: ReadonlyArray<readonly [FeatureId, readonly string[]]> = [
  ["payments", ["stripe", "@stripe/stripe-js", "@paddle/paddle-js"]],
  ["ai", ["@anthropic-ai/sdk", "openai", "ai", "@google/generative-ai"]],
  ["email", ["resend", "nodemailer", "@sendgrid/mail", "postmark"]],
  ["search", ["algoliasearch", "meilisearch", "typesense"]],
  ["analytics", ["posthog-js", "@vercel/analytics", "mixpanel-browser"]],
  ["realtime", ["socket.io", "pusher-js", "partysocket"]],
  ["storage", ["@aws-sdk/client-s3", "uploadthing", "@uploadthing/react"]],
  ["auth", ["next-auth", "@auth/core", "@clerk/nextjs", "@supabase/ssr"]]
];

const FRAMEWORK_DEPENDENCIES: ReadonlyArray<readonly [Framework, string]> = [
  ["nextjs", "next"],
  ["vite", "vite"]
];

const DATABASE_DEPENDENCIES: ReadonlyArray<readonly [Database, readonly string[]]> = [
  ["supabase", ["@supabase/supabase-js", "@supabase/ssr"]],
  ["postgres", ["pg", "drizzle-orm", "@prisma/client", "postgres"]]
];

/** Vector stores are the one AI shape a dependency list can actually prove. */
const RAG_DEPENDENCIES = ["@pinecone-database/pinecone", "chromadb", "weaviate-client", "pgvector"];

/** Dependency names declared in a package.json. Total: malformed JSON yields an empty set. */
function dependencyNames(content: string): Set<string> {
  const names = new Set<string>();
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    return names;
  }
  if (typeof parsed !== "object" || parsed === null) return names;
  for (const key of ["dependencies", "devDependencies"] as const) {
    const value: unknown = Reflect.get(parsed, key);
    if (typeof value !== "object" || value === null) continue;
    for (const name of Object.keys(value)) names.add(name);
  }
  return names;
}

const basename = (path: string): string => path.slice(path.lastIndexOf("/") + 1);

/** Package manifests and build files — one of these is a project, whatever language it is in. */
const MANIFEST_FILES = [
  "package.json",
  "requirements.txt",
  "pyproject.toml",
  "pipfile",
  "gemfile",
  "go.mod",
  "cargo.toml",
  "pom.xml",
  "build.gradle",
  "build.gradle.kts",
  "composer.json",
  "mix.exs",
  "pubspec.yaml",
  "dockerfile",
  "makefile"
] as const;

const MANIFEST_EXTENSIONS = [".csproj", ".sln", ".fsproj", ".vbproj", ".gemspec", ".cabal"] as const;

/** Extensions that are somebody's source code rather than somebody's documentation. */
const SOURCE_EXTENSIONS = [
  ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".vue", ".svelte",
  ".py", ".rb", ".go", ".rs", ".java", ".kt", ".kts", ".swift", ".cs", ".fs", ".vb",
  ".php", ".ex", ".exs", ".dart", ".scala", ".clj", ".c", ".h", ".cc", ".cpp", ".hpp", ".m", ".mm",
  ".sql", ".sh", ".ps1"
] as const;

/**
 * Did this archive hold a project, or only documents?
 *
 * The one question that decides which command the foundation ships (spec 91). `/cleanup` reads an
 * existing codebase and rewrites the documents to match it; handed a repository with no code it has
 * nothing to read, so that import gets `/start` instead — same as any project beginning from nothing.
 *
 * Paths only, deliberately: it must give the same answer for the archive being imported and for the
 * digests stored from it, and the content of those files is never kept (§II). Deliberately *not*
 * "did we recognise the stack" — a Rails or .NET project is code we cannot name, and a founder with
 * one still has a codebase for `/cleanup` to read.
 */
export function hasCodeSignal(paths: readonly string[]): boolean {
  return paths.some((path) => {
    if (isIgnoredImportPath(path)) return false;
    const name = basename(path).toLowerCase();
    const manifests: readonly string[] = MANIFEST_FILES;
    if (manifests.includes(name)) return true;
    const suffixes: readonly string[] = [...MANIFEST_EXTENSIONS, ...SOURCE_EXTENSIONS];
    return suffixes.some((ext) => name.endsWith(ext));
  });
}

/* ── Analysis ─────────────────────────────────────────────────────────────── */

/**
 * Derive what the interview would otherwise ask for. Only questions the project actually answers
 * are filled in — an undetectable question is left for the founder rather than guessed.
 */
export function analyzeImport(files: ImportedFile[], alreadyIgnored = 0): ImportAnalysis {
  const kept = analyzable(files);
  const answers: InterviewAnswers = {};
  const evidence: ImportEvidence[] = [];
  const notes: string[] = [];

  function record<K extends keyof InterviewAnswers>(
    field: K,
    value: InterviewAnswers[K],
    label: string,
    source: string
  ): void {
    answers[field] = value;
    evidence.push({ field, value: label, source });
  }

  const paths = kept.map((f) => f.path);
  const has = (predicate: (path: string) => boolean): boolean => paths.some(predicate);

  // Dependencies from every package.json in the tree (monorepos declare them per workspace).
  const deps = new Set<string>();
  for (const file of kept) {
    if (basename(file.path) !== "package.json") continue;
    for (const name of dependencyNames(file.content)) deps.add(name);
  }

  for (const [framework, dep] of FRAMEWORK_DEPENDENCIES) {
    if (!deps.has(dep)) continue;
    record("framework", framework, framework === "nextjs" ? "Next.js" : "Vite", `package.json → ${dep}`);
    break;
  }

  for (const [database, candidates] of DATABASE_DEPENDENCIES) {
    const hit = candidates.find((d) => deps.has(d));
    if (hit === undefined) continue;
    record("database", database, database === "supabase" ? "Supabase" : "PostgreSQL", `package.json → ${hit}`);
    break;
  }

  const capabilities: FeatureId[] = [];
  for (const [capability, candidates] of CAPABILITY_DEPENDENCIES) {
    const hit = candidates.find((d) => deps.has(d));
    if (hit === undefined) continue;
    capabilities.push(capability);
    evidence.push({ field: "capabilities", value: capability, source: `package.json → ${hit}` });
  }
  if (capabilities.length > 0) answers.capabilities = capabilities;

  // The *kind* of AI is only provable by a vector store; otherwise the founder answers it.
  if (capabilities.includes("ai")) {
    const hit = RAG_DEPENDENCIES.find((d) => deps.has(d));
    if (hit !== undefined) {
      const rag: AiUsage = "rag";
      record("aiUsage", rag, "retrieval-augmented generation", `package.json → ${hit}`);
    }
  }

  const hosting: Hosting | null = has((p) => basename(p) === "vercel.json")
    ? "vercel"
    : has((p) => basename(p) === "azure-pipelines.yml")
      ? "azure"
      : null;
  if (hosting !== null) {
    record("hosting", hosting, hosting === "vercel" ? "Vercel" : "Azure", hosting === "vercel" ? "vercel.json" : "azure-pipelines.yml");
  }

  const repoProvider: RepoProvider | null = has((p) => p.startsWith(".github/workflows/"))
    ? "github"
    : has((p) => basename(p) === "azure-pipelines.yml")
      ? "azure_devops"
      : null;
  if (repoProvider !== null) {
    record(
      "repoProvider",
      repoProvider,
      repoProvider === "github" ? "GitHub" : "Azure DevOps",
      repoProvider === "github" ? ".github/workflows/" : "azure-pipelines.yml"
    );
  }

  // An org/tenant column in the migrations is hard evidence of a multi-tenant data model.
  const tenantMigration = kept.find(
    (f) =>
      f.path.endsWith(".sql") &&
      f.path.includes("migrations/") &&
      (f.content.includes("organization_id") || f.content.includes("tenant_id"))
  );
  if (tenantMigration !== undefined) {
    const tenancy: Tenancy = "organizations";
    record("tenancy", tenancy, "multi-tenant with organizations", tenantMigration.path);
  }

  if (has((p) => p.endsWith(".csproj") || p.endsWith(".sln"))) {
    notes.push(
      "A .NET project was detected. Airrow has no .NET stack profile yet, so the stack questions are left for you to answer."
    );
  }
  if (deps.size === 0 && !has((p) => p.endsWith(".csproj"))) {
    notes.push("No package manifest was found, so nothing could be prefilled from dependencies.");
  }

  return {
    answers,
    stackDetected: hasCodeSignal(paths),
    evidence,
    notes,
    filesAnalyzed: kept.length,
    // Callers that already dropped ignored directories (the archive reader does, to avoid
    // decompressing them) pass their count in so the founder sees the true total.
    filesIgnored: files.length - kept.length + alreadyIgnored
  };
}

/* ── Diff ─────────────────────────────────────────────────────────────────── */

/**
 * Reduce imported files to what Airrow is willing to keep: path, size and a content digest. The
 * digest function is injected so this module stays free of crypto and of any runtime dependency.
 */
export function digestImported(
  files: ImportedFile[],
  digest: (content: string) => string
): ImportedFileDigest[] {
  return analyzable(files).map((f) => ({
    path: f.path,
    bytes: byteLength(f.content),
    digest: digest(f.content)
  }));
}

/**
 * Measure generated output against the imported project. A path that already exists with different
 * content lands in `conflicts` and is written only once the founder decides — never silently.
 * Comparison is by digest, because the imported content itself is never stored.
 */
export function diffAgainstExisting(
  generated: GeneratedFile[],
  existing: ImportedFileDigest[],
  digest: (content: string) => string
): ImportDiff {
  const existingByPath = new Map(existing.map((f) => [f.path, f]));
  const diff: ImportDiff = { added: [], identical: [], conflicts: [] };

  for (const file of generated) {
    const current = existingByPath.get(file.path);
    const entry: ImportDiffEntry = {
      path: file.path,
      generatedBytes: byteLength(file.content),
      existingBytes: current === undefined ? null : current.bytes
    };
    if (current === undefined) diff.added.push(entry);
    else if (current.digest === digest(file.content)) diff.identical.push(entry);
    else diff.conflicts.push(entry);
  }

  const byPath = (a: ImportDiffEntry, b: ImportDiffEntry): number => a.path.localeCompare(b.path);
  diff.added.sort(byPath);
  diff.identical.sort(byPath);
  diff.conflicts.sort(byPath);
  return diff;
}

/* ── Preview tree ─────────────────────────────────────────────────────────── */

/**
 * Where a file in the preview comes from, and — when both sides have it — which version the
 * download will contain. The two conflict states carry the founder's decision, so the UI needs no
 * second lookup and cannot get the two out of step (spec 75).
 */
export type PreviewFileSource =
  | "yours"
  | "airrow"
  | "conflict_keeps_yours"
  | "conflict_takes_airrow";

export interface PreviewFileEntry {
  path: string;
  source: PreviewFileSource;
}

/**
 * A node in the preview tree. No sizes and no content: the founder's half is described by path
 * alone, which is all Airrow ever stores of it.
 */
export type PreviewTreeNode =
  | { kind: "file"; name: string; path: string; source: PreviewFileSource }
  | {
      kind: "directory";
      name: string;
      path: string;
      /** True when nothing beneath can be opened, so the whole branch reads as the founder's. */
      yoursOnly: boolean;
      children: PreviewTreeNode[];
    };

/**
 * The founder's files and Airrow's as one list, each tagged with where it comes from. `conflicts`
 * is `diffAgainstExisting`'s verdict — the single place that decides what a collision is — so a path
 * present on both sides with identical content is simply Airrow's file, not a conflict.
 */
export function mergePreviewFiles(
  yours: ReadonlyArray<{ path: string }>,
  airrow: ReadonlyArray<{ path: string }>,
  conflicts: ReadonlyArray<string>,
  resolutions: ReadonlyMap<string, ConflictResolution>
): PreviewFileEntry[] {
  const conflicting = new Set(conflicts);
  const generated = new Set(airrow.map((f) => f.path));

  const entries: PreviewFileEntry[] = airrow.map((f) => ({
    path: f.path,
    source: !conflicting.has(f.path)
      ? "airrow"
      : resolutions.get(f.path) === "use_generated"
        ? "conflict_takes_airrow"
        : "conflict_keeps_yours"
  }));

  for (const f of yours) {
    if (!generated.has(f.path)) entries.push({ path: f.path, source: "yours" });
  }

  return entries.sort((a, b) => a.path.localeCompare(b.path));
}

/** Directories before files, then alphabetical — a stable order the UI can render as-is. */
function sortTree(nodes: PreviewTreeNode[]): PreviewTreeNode[] {
  nodes.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === "directory" ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  for (const node of nodes) if (node.kind === "directory") sortTree(node.children);
  return nodes;
}

/** A branch reads as the founder's only when nothing inside it can be opened. */
function markYoursOnly(nodes: PreviewTreeNode[]): boolean {
  let allYours = true;
  for (const node of nodes) {
    const yours =
      node.kind === "file" ? node.source === "yours" : markYoursOnly(node.children);
    if (node.kind === "directory") node.yoursOnly = yours;
    if (!yours) allYours = false;
  }
  return allYours;
}

/**
 * Build the directory tree the paths describe. Pure: tagged paths in, sorted tree out — the whole
 * project's shape, with no trace of what any of the founder's files contain.
 */
export function buildPreviewTree(
  entries: ReadonlyArray<PreviewFileEntry>
): PreviewTreeNode[] {
  const roots: PreviewTreeNode[] = [];
  const directories = new Map<string, PreviewTreeNode[]>();

  /** The children of the directory a path sits in, creating it and its ancestors on the way down. */
  function directoryAt(segments: string[]): PreviewTreeNode[] {
    let siblings = roots;
    let prefix = "";
    for (const segment of segments) {
      prefix = prefix === "" ? segment : `${prefix}/${segment}`;
      let children = directories.get(prefix);
      if (children === undefined) {
        children = [];
        directories.set(prefix, children);
        siblings.push({ kind: "directory", name: segment, path: prefix, yoursOnly: true, children });
      }
      siblings = children;
    }
    return siblings;
  }

  for (const entry of entries) {
    const segments = entry.path.split("/").filter((s) => s !== "");
    const name = segments.pop();
    if (name === undefined) continue;
    directoryAt(segments).push({ kind: "file", name, path: entry.path, source: entry.source });
  }

  markYoursOnly(roots);
  return sortTree(roots);
}

/**
 * The merged delivery: the founder's own files with Airrow's laid over the top. `ours` is whatever
 * the server deemed safe to write (`applyResolutions`), so overlaying is exactly right — an
 * undecided conflict never reaches this function and the founder's file survives untouched.
 */
export function mergeOverlay<T extends { path: string }>(
  theirs: ReadonlyArray<T>,
  ours: ReadonlyArray<T>
): T[] {
  const overlaid = new Set(ours.map((f) => f.path));
  return [...theirs.filter((f) => !overlaid.has(f.path)), ...ours].sort((a, b) =>
    a.path.localeCompare(b.path)
  );
}

/**
 * How much of the imported project a re-picked archive still accounts for, 0–1. Used to catch the
 * founder choosing the wrong folder at download time; paths only, because the stored digests are
 * peppered server-side and cannot be recomputed in a browser (spec 68).
 */
export function pathOverlap(expected: ReadonlyArray<string>, actual: ReadonlyArray<string>): number {
  if (expected.length === 0) return 1;
  const present = new Set(actual);
  return expected.filter((p) => present.has(p)).length / expected.length;
}

/**
 * The path a generated file takes when the founder's file already holds the real one.
 *
 * `README.md` → `README.airrow.md`; the suffix goes before the extension so the file still opens as
 * what it is. A name with no extension (`Dockerfile`) and a dotfile (`.gitignore`, whose leading dot
 * is not an extension) both take the suffix at the end.
 */
/**
 * Whether an undecided conflict on this path delivers Airrow's version beside the founder's.
 *
 * Markdown only. A sidecar exists so `/cleanup` can reconcile two versions of a document, and
 * markdown is exactly the set it may rewrite. Anything else would be inert at best and live at
 * worst: `ci.airrow.yml` in `.github/workflows/` is a second pipeline GitHub Actions runs, failing
 * on commands the project may not have — a red build the founder never asked for, in the one file
 * `/cleanup` is forbidden to fix.
 */
export function deliversSidecar(path: string): boolean {
  return path.endsWith(".md");
}

export function sidecarPath(path: string): string {
  const slash = path.lastIndexOf("/");
  const name = path.slice(slash + 1);
  const dot = name.lastIndexOf(".");
  const renamed = dot <= 0 ? `${name}.airrow` : `${name.slice(0, dot)}.airrow${name.slice(dot)}`;
  return path.slice(0, slash + 1) + renamed;
}

/**
 * Apply the founder's conflict decisions. A file of theirs is never overwritten by one they did not
 * explicitly ask for — that is the promise from spec 63 and it is unchanged.
 *
 * What changed (spec 91) is what happens to Airrow's version of an **undecided** conflict. It used to
 * be dropped, which left an imported project with, say, no `CLAUDE.md` at all and `/cleanup` with
 * nothing to reconcile against — the foundation's own documents were missing from the foundation. It
 * now ships alongside as `README.airrow.md`, which overwrites nothing and leaves both versions on disk
 * for `/cleanup` to work through — for markdown, see below. An **explicit** "keep mine" still
 * delivers nothing: the founder decided, and a sidecar they said they did not want is still a file
 * they did not want.
 */
export function applyResolutions(
  generated: GeneratedFile[],
  existing: ImportedFileDigest[],
  resolutions: ReadonlyMap<string, ConflictResolution>
): GeneratedFile[] {
  const existingPaths = new Set(existing.map((f) => f.path));
  const written: GeneratedFile[] = [];
  for (const file of generated) {
    if (!existingPaths.has(file.path)) {
      written.push(file);
      continue;
    }
    const decision = resolutions.get(file.path);
    if (decision === "use_generated") written.push(file);
    else if (decision === undefined && deliversSidecar(file.path)) {
      written.push({ ...file, path: sidecarPath(file.path) });
    }
  }
  return written;
}
