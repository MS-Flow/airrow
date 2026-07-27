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

/* ── File tree ────────────────────────────────────────────────────────────── */

/**
 * A node in the imported project's structure. Directories carry the rolled-up size of everything
 * beneath them; files carry their own. No content — the tree describes shape only (spec 68).
 */
export interface FileTreeNode {
  name: string;
  path: string;
  bytes: number;
  /** Absent on files. Directories always have one, even when empty. */
  children?: FileTreeNode[];
}

/** Directories before files, then alphabetical — a stable order the UI can render as-is. */
function sortTree(nodes: FileTreeNode[]): FileTreeNode[] {
  nodes.sort((a, b) => {
    const aDir = a.children !== undefined;
    const bDir = b.children !== undefined;
    if (aDir !== bDir) return aDir ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  for (const node of nodes) if (node.children) sortTree(node.children);
  return nodes;
}

/**
 * Build the directory tree an imported project's paths describe. Pure: paths and sizes in, sorted
 * tree out — everything the structure view needs, and nothing the founder didn't already give us.
 */
export function buildFileTree(files: ReadonlyArray<{ path: string; bytes: number }>): FileTreeNode[] {
  const roots: FileTreeNode[] = [];
  const directories = new Map<string, FileTreeNode>();

  /** The directory node for a path, creating it and its ancestors on the way down. */
  function directoryAt(segments: string[]): FileTreeNode[] {
    let siblings = roots;
    let prefix = "";
    for (const segment of segments) {
      prefix = prefix === "" ? segment : `${prefix}/${segment}`;
      let node = directories.get(prefix);
      if (node === undefined) {
        node = { name: segment, path: prefix, bytes: 0, children: [] };
        directories.set(prefix, node);
        siblings.push(node);
      }
      // `children` is always set for directory nodes, above.
      siblings = node.children ?? [];
    }
    return siblings;
  }

  for (const file of files) {
    const segments = file.path.split("/").filter((s) => s !== "");
    const name = segments.pop();
    if (name === undefined) continue;

    directoryAt(segments).push({ name, path: file.path, bytes: file.bytes });

    // Roll the size up every ancestor so a collapsed directory still says how big it is.
    let prefix = "";
    for (const segment of segments) {
      prefix = prefix === "" ? segment : `${prefix}/${segment}`;
      const directory = directories.get(prefix);
      if (directory) directory.bytes += file.bytes;
    }
  }

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
 * Apply the founder's conflict decisions. Unresolved conflicts keep the existing file — the safe
 * default — so a half-answered review can never overwrite work.
 */
export function applyResolutions(
  generated: GeneratedFile[],
  existing: ImportedFileDigest[],
  resolutions: ReadonlyMap<string, ConflictResolution>
): GeneratedFile[] {
  const existingPaths = new Set(existing.map((f) => f.path));
  return generated.filter(
    (file) => !existingPaths.has(file.path) || resolutions.get(file.path) === "use_generated"
  );
}
