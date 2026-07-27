// Stage 1: resolve. Wizard + interview answers → validated, derived ProjectModel.
// Pure. No I/O, no env, no external deps (F-101 FR-7).

import type {
  AiUsage,
  Audience,
  AuthMethod,
  Database,
  DataSensitivity,
  FeatureId,
  Framework,
  Hosting,
  InterviewAnswers,
  ProductType,
  ProjectModel,
  SecurityLevel,
  Tenancy
} from "../../schemas/src/types.ts";

export const ENGINE_VERSION = "0.1.0";

export interface ResolveInput {
  name: string;
  description: string;
  answers: InterviewAnswers;
}

export function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "project"
  );
}

export function resolveProjectModel(input: ResolveInput): ProjectModel {
  const a = input.answers;
  const productType: ProductType = a.productType ?? "saas";

  // Tenancy drives multi-tenancy explicitly (was inferred from a feature checkbox).
  const tenancy: Tenancy = a.tenancy ?? (productType === "internal_tool" ? "internal" : "single_user");
  const multiTenant = tenancy === "organizations" || tenancy === "marketplace";

  // Auth model: default to email+password; "public"-only means no accounts.
  const authModel: AuthMethod[] = a.authModel && a.authModel.length > 0 ? [...a.authModel] : ["email_password"];
  const needsAuth = productType !== "api" && !(authModel.length === 1 && authModel[0] === "public");

  // Project the capability list into the engine's FeatureId set: selected capabilities
  // plus the identity-adjacent features derived from tenancy/auth. Answering "none" on the AI
  // question backs the founder out of AI entirely, so the capability goes with it.
  const selected = a.capabilities ?? [];
  const capabilities: FeatureId[] =
    a.aiUsage === "none" ? selected.filter((c) => c !== "ai") : [...selected];
  const features: FeatureId[] = [...capabilities];
  if (multiTenant && !features.includes("organizations")) features.unshift("organizations");
  if (needsAuth && !features.includes("auth")) features.unshift("auth");

  const audience: Audience =
    productType === "internal_tool"
      ? "internal"
      : (a.audience ?? (productType === "hobby" ? "b2c" : "b2b"));

  const framework: Framework =
    a.framework ?? (productType === "mobile_app" || productType === "browser_extension" ? "vite" : "nextjs");

  const dataSensitivity: DataSensitivity = a.dataSensitivity ?? "standard";
  const security: SecurityLevel = dataSensitivity === "standard" ? "standard" : "elevated";
  const hasAi = capabilities.includes("ai");
  // The kind of AI is only meaningful when AI is selected — and is never guessed when it was skipped.
  const aiUsage: AiUsage | "none" = hasAi ? (a.aiUsage ?? "none") : "none";

  return {
    schemaVersion: "1",
    name: input.name.trim(),
    slug: slugify(input.name),
    description: input.description.trim(),
    vision: (a.vision ?? "").trim(),
    productType,
    audience,
    tenancy,
    authModel,
    features,
    roles: multiTenant ? (a.roles ?? "simple") : "none",
    aiUsage,
    integrations: (a.integrations ?? "").trim(),
    hosting: a.hosting ?? "vercel",
    stack: {
      framework,
      customFramework: framework === "custom" ? (a.frameworkOther ?? "").trim() : "",
      language: "typescript",
      styling: "tailwind",
      ui: "shadcn/ui",
      backend: "supabase",
      database: a.database ?? "supabase",
      deployment: "vercel",
      repoProvider: a.repoProvider ?? "github",
      editor: "vscode",
      ai: "claude-code"
    },
    team: a.team ?? "solo",
    dataSensitivity,
    security,
    scale: a.scale ?? "validate",
    mvpFocus: (a.mvpFocus ?? "").trim(),
    coreEntities: (a.coreEntities ?? "").trim(),
    problem: (a.problem ?? "").trim(),
    nonGoals: (a.nonGoals ?? "").trim(),
    derived: {
      multiTenant,
      hasPayments: features.includes("payments"),
      hasAi,
      hasRealtime: features.includes("realtime"),
      hasAdmin: features.includes("admin"),
      needsAuth,
      isWeb: productType !== "mobile_app"
    }
  };
}

// ── Label helpers used by the scaffold renderer ─────────────────────────────

export const productTypeLabel: Record<ProductType, string> = {
  saas: "SaaS product",
  marketplace: "marketplace",
  ai_agent: "AI product",
  mobile_app: "mobile app",
  api: "API / developer platform",
  internal_tool: "internal tool",
  browser_extension: "browser extension",
  hobby: "side project"
};

export const audienceLabel: Record<Audience, string> = {
  b2b: "businesses (B2B)",
  b2c: "consumers (B2C)",
  both: "both businesses and consumers",
  internal: "internal users at your company"
};

export const featureLabel: Record<FeatureId, string> = {
  auth: "User accounts & authentication",
  organizations: "Organizations & teams (multi-tenant)",
  roles: "Roles & permissions",
  payments: "Payments & billing",
  notifications: "Notifications",
  search: "Search",
  storage: "File storage",
  ai: "AI features",
  analytics: "Analytics",
  realtime: "Realtime",
  email: "Transactional email",
  admin: "Admin panel",
  audit_logs: "Audit logs"
};

export const teamLabel: Record<ProjectModel["team"], string> = {
  solo: "a solo founder working with AI assistants",
  small_team: "a founding team of 2–5",
  startup: "a growing startup team",
  agency: "an agency delivering for clients"
};

export function frameworkLabel(m: ProjectModel): string {
  // A custom stack is named by the founder, so it is echoed rather than mapped — the whole point is
  // that the documents say what they actually build in.
  if (m.stack.framework === "custom") return m.stack.customFramework || "your stack";
  return m.stack.framework === "nextjs" ? "Next.js (App Router)" : "Vite + React";
}

/** True when the founder described their own stack, so nothing about its toolchain can be derived. */
export function isCustomStack(m: ProjectModel): boolean {
  return m.stack.framework === "custom";
}

export function repoLabel(m: ProjectModel): string {
  return m.stack.repoProvider === "github" ? "GitHub" : "Azure DevOps";
}

/**
 * True when the founder's code, work items and pipelines live in Azure DevOps.
 *
 * This decides more than a label. The whole spec workflow is expressed in a provider's own
 * vocabulary and CLI — issues vs work items, `gh` vs `az repos`, Actions vs Pipelines — and a
 * foundation that ships GitHub Actions to an Azure DevOps team is documentation about someone
 * else's project.
 */
export function usesAzureRepos(m: ProjectModel): boolean {
  return m.stack.repoProvider === "azure_devops";
}

export const tenancyLabel: Record<Tenancy, string> = {
  single_user: "per-user (each person sees only their own data)",
  organizations: "multi-tenant with teams / organizations",
  marketplace: "a two-sided marketplace",
  internal: "a single internal organization"
};

export const authMethodLabel: Record<AuthMethod, string> = {
  email_password: "email & password",
  magic_link: "magic link",
  social: "social login",
  sso: "enterprise SSO (SAML/OIDC)",
  public: "no accounts (public)"
};

export const aiUsageLabel: Record<AiUsage, string> = {
  llm_calls: "LLM calls (prompt-in, text-out)",
  rag: "retrieval-augmented generation over your data",
  agents: "autonomous, tool-using agents",
  ml_models: "custom ML models"
};

export const hostingLabel: Record<Hosting, string> = {
  vercel: "Vercel",
  azure: "Azure",
  self_host: "self-hosted"
};

const DATABASE_LABEL: Record<Database, string> = {
  supabase: "Supabase",
  postgres: "PostgreSQL (self-hosted)"
};

export function databaseLabel(m: ProjectModel): string {
  return DATABASE_LABEL[m.stack.database];
}

/** Supabase is the golden path; other providers are raw Postgres (bring-your-own Auth/Storage/Realtime). */
export function usesSupabase(m: ProjectModel): boolean {
  return m.stack.database === "supabase";
}

/** One-line backend description for stack summaries — accurate for every database provider. */
export function backendSummary(m: ProjectModel): string {
  const extras = [
    m.derived.needsAuth ? "Auth" : null,
    m.features.includes("storage") ? "Storage" : null,
    m.derived.hasRealtime ? "Realtime" : null
  ].filter((x): x is string => x !== null);
  if (usesSupabase(m)) {
    return `Supabase (PostgreSQL${extras.length ? ", " + extras.join(", ") : ""})`;
  }
  return `${databaseLabel(m)} (PostgreSQL)${extras.length ? ` — wire ${extras.join(", ")} yourself` : ""}`;
}
