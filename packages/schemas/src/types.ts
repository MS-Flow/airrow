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

export type Framework = "nextjs" | "vite";
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
  database?: Database;
  hosting?: Hosting;
  repoProvider?: RepoProvider;
  team?: TeamShape;
}

/** Fully resolved, validated model the engine generates from. */
export interface ProjectModel {
  schemaVersion: "1";
  name: string;
  slug: string;
  description: string;
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

export type JobStage = "resolve" | "author" | "assemble" | "validate" | "manifest";
export type JobStatus = "queued" | "running" | "completed" | "failed";

export interface JobProgress {
  stage: JobStage;
  stagesDone: JobStage[];
  filesAuthored: number;
  totalFiles: number;
  currentPath?: string;
}
