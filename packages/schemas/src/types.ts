// Pure types shared across Arrow. No runtime dependencies.

export type ProductType =
  | "saas"
  | "marketplace"
  | "ai_agent"
  | "mobile_app"
  | "api"
  | "internal_tool"
  | "browser_extension";

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
export type ScaleExpectation = "validate" | "growth";

/** Raw interview answers, keyed by question id. */
export interface InterviewAnswers {
  productType?: ProductType;
  audience?: Audience;
  features?: FeatureId[];
  roles?: "simple" | "granular";
  framework?: Framework;
  repoProvider?: RepoProvider;
  team?: TeamShape;
  security?: SecurityLevel;
  scale?: ScaleExpectation;
  mvpFocus?: string;
  goal90?: string;
}

/** Fully resolved, validated model the engine generates from. */
export interface ProjectModel {
  schemaVersion: "1";
  name: string;
  slug: string;
  description: string;
  productType: ProductType;
  audience: Audience;
  features: FeatureId[];
  roles: "simple" | "granular" | "none";
  stack: {
    framework: Framework;
    language: "typescript";
    styling: "tailwind";
    ui: "shadcn/ui";
    backend: "supabase";
    database: "postgresql";
    deployment: "vercel";
    repoProvider: RepoProvider;
    editor: "vscode";
    ai: "claude-code";
  };
  team: TeamShape;
  security: SecurityLevel;
  scale: ScaleExpectation;
  mvpFocus: string;
  goal90: string;
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
