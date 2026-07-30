// Pure types shared across Airrow. No runtime dependencies.

export type ProductType =
  | "saas"
  | "marketplace"
  | "ai_agent"
  | "mobile_app"
  | "api"
  | "internal_tool"
  | "browser_extension"
  | "hobby";

export type Audience = "b2b" | "b2c" | "both" | "internal";

export type FeatureId =
  | "auth"
  | "organizations"
  | "roles"
  | "payments"
  | "notifications"
  | "search"
  | "storage"
  | "ai"
  | "analytics"
  | "realtime"
  | "email"
  | "admin"
  | "audit_logs";

/** `custom` means the founder described their own stack in `frameworkOther`. */
export type Framework = "nextjs" | "vite" | "custom";
export type RepoProvider = "github" | "azure_devops";
export type TeamShape = "solo" | "small_team" | "startup" | "agency";
export type SecurityLevel = "standard" | "elevated";
export type ScaleExpectation = "validate" | "growth" | "high_scale";

/** How data is organized & isolated — drives the data model and RLS strategy. */
export type Tenancy = "single_user" | "organizations" | "marketplace" | "internal";
/** How users authenticate (multi-select; `public` means no accounts). */
export type AuthMethod = "email_password" | "magic_link" | "social" | "sso" | "public";
/** Kind of AI in the product; the model stores `"none"` when AI is not selected. */
export type AiUsage = "llm_calls" | "rag" | "agents" | "ml_models";
/** Data sensitivity / compliance posture. */
export type DataSensitivity = "standard" | "pii" | "regulated";
/** Deploy target. */
export type Hosting = "vercel" | "azure" | "self_host";
/** Database provider — all PostgreSQL, to keep RLS + SQL migrations (constitution §II). */
export type Database = "supabase" | "postgres";

/** Raw interview answers, keyed by question id. Order mirrors the interview flow. */
export interface InterviewAnswers {
  productType?: ProductType;
  problem?: string;
  vision?: string;
  mvpFocus?: string;
  audience?: Audience;
  coreEntities?: string;
  nonGoals?: string;
  tenancy?: Tenancy;
  authModel?: AuthMethod[];
  roles?: "simple" | "granular";
  capabilities?: FeatureId[];
  /** `"none"` lets the founder back out of AI after selecting the capability. */
  aiUsage?: AiUsage | "none";
  integrations?: string;
  dataSensitivity?: DataSensitivity;
  scale?: ScaleExpectation;
  framework?: Framework;
  /** Free-text stack, when `framework` is `custom`. */
  frameworkOther?: string;
  database?: Database;
  hosting?: Hosting;
  repoProvider?: RepoProvider;
  team?: TeamShape;
  /** How the product should look, feel, and move — free text, feeds `UI_ARCHITECTURE.md` and `/start`. */
  uiDirection?: string;
}

/**
 * Where a project came from, and — for an import — whether the analysis found code to read.
 *
 * It decides which command the foundation ships (spec 91): a project started from nothing gets
 * `/start`, which scaffolds a stack; an imported one that already has a stack gets `/cleanup`, which
 * reads it and rewrites the documents to match. An import with nothing but documents in it has
 * nothing to read, so it gets `/start` like any other empty project.
 */
export type ProjectOrigin = { kind: "new" } | { kind: "imported"; stackDetected: boolean };

/** Fully resolved, validated model the engine generates from. */
export interface ProjectModel {
  schemaVersion: "1";
  name: string;
  slug: string;
  description: string;
  origin: ProjectOrigin;
  vision: string;
  productType: ProductType;
  audience: Audience;
  tenancy: Tenancy;
  authModel: AuthMethod[];
  /** Projected capability list (includes derived `auth`/`organizations`). */
  features: FeatureId[];
  roles: "simple" | "granular" | "none";
  aiUsage: AiUsage | "none";
  integrations: string;
  hosting: Hosting;
  stack: {
    framework: Framework;
    /**
     * The founder's own words for their stack, when `framework` is `custom`; empty otherwise.
     * Nothing derives commands or setup steps from it — those are authored (`TOOLCHAIN_SLOTS`),
     * because no amount of string matching knows what `manage.py` is.
     */
    customFramework: string;
    language: "typescript";
    styling: "tailwind";
    ui: "shadcn/ui";
    backend: "supabase";
    database: Database;
    deployment: "vercel";
    repoProvider: RepoProvider;
    editor: "vscode";
    ai: "claude-code";
  };
  team: TeamShape;
  /** Raw sensitivity answer — `security` is its coarse projection, kept for callers that only need the level. */
  dataSensitivity: DataSensitivity;
  security: SecurityLevel;
  scale: ScaleExpectation;
  mvpFocus: string;
  coreEntities: string;
  /** The problem and who has it. Empty when unanswered — never inferred. */
  problem: string;
  /** How the product should look, feel, and move. Empty when unanswered — never inferred. */
  uiDirection: string;
  /** What the product deliberately is not doing. Empty when unanswered. */
  nonGoals: string;
  derived: {
    multiTenant: boolean;
    hasPayments: boolean;
    hasAi: boolean;
    hasRealtime: boolean;
    hasAdmin: boolean;
    needsAuth: boolean;
    isWeb: boolean;
  };
}

export interface GeneratedFile {
  path: string;
  content: string;
  source: "static" | "authored";
  templateId: string;
}

/**
 * What wrote the prose in this generation (spec 65). `null` when nothing did — no API key, a failed
 * call, a rejected response — and every file is then deterministic.
 *
 * Recorded because a generated file has to be attributable (constitution §II): the same answers put
 * through a different prompt or a different model produce different documents, and without this a
 * regression months from now has nothing to point at.
 */
export interface AuthoringRecord {
  /** Bumped when the prompt changes in a way that would produce different prose from same answers. */
  promptVersion: string;
  /** Model id as sent to the API, e.g. `claude-haiku-4-5`. */
  model: string;
}

export interface Manifest {
  engineVersion: string;
  schemaVersion: string;
  generatedAt: string;
  projectSlug: string;
  fileCount: number;
  /** Provenance for every file marked `authored` below. */
  authoring: AuthoringRecord | null;
  files: Array<{
    path: string;
    source: "static" | "authored";
    templateId: string;
    templateVersion: string;
    bytes: number;
  }>;
}

export interface GenerationResult {
  files: GeneratedFile[];
  manifest: Manifest;
}

/* ── Importing an existing project (spec 63) ──────────────────────────────── */

/** One file read out of an imported project. `path` is repo-relative with `/` separators. */
export interface ImportedFile {
  path: string;
  content: string;
}

/** Ceilings on what may be imported; the values live with the engine (`IMPORT_LIMITS`). */
export interface ImportLimits {
  /** Total decompressed bytes of the files actually analyzed. */
  maxBytes: number;
  maxFiles: number;
}

/** Why the analysis prefilled an answer — shown beside it so the founder can judge the guess. */
export interface ImportEvidence {
  field: keyof InterviewAnswers;
  /** Human-readable form of the derived value. */
  value: string;
  /** Where it came from, e.g. `package.json → dependencies.next`. */
  source: string;
}

export interface ImportAnalysis {
  /** Prefill for the interview. Only questions the analysis could answer are present. */
  answers: InterviewAnswers;
  /**
   * Whether the archive held code at all — a manifest or source, as opposed to documents. It decides
   * which command the foundation ships (spec 91); see `ProjectOrigin`.
   */
  stackDetected: boolean;
  evidence: ImportEvidence[];
  /** Detected but not mappable onto the current model — surfaced, never silently dropped. */
  notes: string[];
  filesAnalyzed: number;
  filesIgnored: number;
}

export type ImportSourceKind = "zip" | "repo";
export type ImportSourceStatus = "analyzed" | "failed";

/**
 * What Airrow keeps about an imported file once analysis is done: its path and a content digest,
 * never the content itself. Enough to diff generated output against the project; nothing of the
 * customer's source survives the request (constitution §II, customer IP).
 */
export interface ImportedFileDigest {
  path: string;
  bytes: number;
  digest: string;
}

/** What the founder chose for a file that already exists with different content. */
export type ConflictResolution = "keep_existing" | "use_generated";

export interface ImportDiffEntry {
  path: string;
  generatedBytes: number;
  /** `null` when the imported project has no file at this path. */
  existingBytes: number | null;
}

/**
 * Generated output measured against the imported project. `conflicts` is the only bucket that
 * needs a decision — nothing in it is written until the founder picks (spec 63).
 */
export interface ImportDiff {
  added: ImportDiffEntry[];
  identical: ImportDiffEntry[];
  conflicts: ImportDiffEntry[];
}

export type JobStage = "resolve" | "author" | "assemble" | "validate" | "manifest";
export type JobStatus = "queued" | "running" | "completed" | "failed";

export interface JobProgress {
  stage: JobStage;
  stagesDone: JobStage[];
  filesAuthored: number;
  totalFiles: number;
  currentPath?: string;
}
