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
  vision?: string;
  mvpFocus?: string;
  audience?: Audience;
  coreEntities?: string;
  tenancy?: Tenancy;
  authModel?: AuthMethod[];
  roles?: "simple" | "granular";
  capabilities?: FeatureId[];
  aiUsage?: AiUsage;
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
  security: SecurityLevel;
  scale: ScaleExpectation;
  mvpFocus: string;
  coreEntities: string;
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

export interface Manifest {
  engineVersion: string;
  schemaVersion: string;
  generatedAt: string;
  projectSlug: string;
  fileCount: number;
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
