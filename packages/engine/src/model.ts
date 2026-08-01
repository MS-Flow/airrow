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
  ProjectOrigin,
  SecurityLevel,
  Tenancy
} from "../../schemas/src/types.ts";
import {
  MAX_UI_REFERENCE_LINKS,
  STANDARD_STACK,
  splitReferenceLinks
} from "../../schemas/src/questions.ts";

export const ENGINE_VERSION = "0.1.0";

export interface ResolveInput {
  name: string;
  description: string;
  answers: InterviewAnswers;
  /**
   * Where the project came from (spec 91). Omitted means new: a project with no import source *is*
   * one started from nothing, so the default is a fact rather than a guess.
   */
  origin?: ProjectOrigin;
  /**
   * How many UI reference images the founder attached (spec 159). Passed in rather than read,
   * because the rows live in the app's database and this function is pure — the count is all the
   * brief needs to say honestly where its design direction came from.
   */
  referenceImageCount?: number;
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

  // Tenancy drives multi-tenancy explicitly (was inferred from a feature checkbox). A described
  // model (`other`) is deliberately not multi-tenant: the founder's own words are what the data
  // documents are written from, and inferring shared access from an answer nothing here understood
  // is the one inference with a security consequence (spec 159).
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

  // Unanswered only for a draft saved before the stack question was asked of every product type.
  // The fallback is the same table the interview recommends from, so an old draft resolves to what
  // the founder would have been shown — never to a web SPA because nothing better was reachable.
  const standard = STANDARD_STACK[productType];
  const framework: Framework = a.framework ?? standard.framework;

  const hosting: Hosting = a.hosting ?? "vercel";
  const database: Database = a.database ?? "supabase";

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
    origin: input.origin ?? { kind: "new" },
    vision: (a.vision ?? "").trim(),
    productType,
    productTypeOther: productType === "other" ? (a.productTypeOther ?? "").trim() : "",
    audience,
    tenancy,
    tenancyOther: tenancy === "other" ? (a.tenancyOther ?? "").trim() : "",
    authModel,
    features,
    capabilitiesOther: features.includes("other") ? (a.capabilitiesOther ?? "").trim() : "",
    roles: multiTenant ? (a.roles ?? "simple") : "none",
    aiUsage,
    integrations: (a.integrations ?? "").trim(),
    hosting,
    hostingOther: hosting === "other" ? (a.hostingOther ?? "").trim() : "",
    databaseOther: database === "other" ? (a.databaseOther ?? "").trim() : "",
    stack: {
      framework,
      customFramework:
        framework === "custom" ? (a.frameworkOther ?? "").trim() || (standard.describe ?? "") : "",
      language: "typescript",
      styling: "tailwind",
      ui: "shadcn/ui",
      backend: "supabase",
      database,
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
    uiDirection: (a.uiDirection ?? "").trim(),
    uiReferenceLinks: splitReferenceLinks(a.uiReferenceLinks ?? "").slice(0, MAX_UI_REFERENCE_LINKS),
    // Set by the caller that knows — the app, which owns the rows. The engine renders a brief that
    // says whether there was anything to look at; it never sees the images themselves (spec 159).
    uiReferenceImageCount: input.referenceImageCount ?? 0,
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
  hobby: "side project",
  // Never rendered on its own — `productTypeName` below prefers the founder's own words, and this is
  // what a document falls back to when they left the field empty.
  other: "software product"
};

/**
 * What to call this product in prose (spec 159).
 *
 * A founder who picked "something else" told us what it is; the eight-option label would then be a
 * worse description than the one already on file. Everything the scaffold renders about the product
 * type goes through here so no document can quietly say "software product" at a founder who wrote
 * "a turn-based strategy game".
 */
export function productTypeName(m: ProjectModel): string {
  if (m.productType === "other" && m.productTypeOther) return m.productTypeOther;
  return productTypeLabel[m.productType];
}

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
  audit_logs: "Audit logs",
  other: "The capability you described"
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

/**
 * The one command this foundation ships, and the only place that decision is made (spec 91).
 *
 * `/start` scaffolds a stack and takes the project to the bare minimum that runs; `/cleanup` reads
 * the stack that is already there and rewrites the documents to match it. Shipping both would hand a
 * founder two commands with opposite assumptions about their repository, so a foundation gets
 * exactly one — and an import with no code in it gets `/start`, because there is nothing to read.
 */
export function commandFor(m: ProjectModel): "start" | "cleanup" {
  return m.origin.kind === "imported" && m.origin.stackDetected ? "cleanup" : "start";
}

/** Where that command lives in the generated repository. */
export function commandPath(m: ProjectModel): string {
  return `.claude/commands/${commandFor(m)}.md`;
}

/** The command as the founder types it — for the documents that tell them to run it. */
export function commandName(m: ProjectModel): string {
  return `/${commandFor(m)}`;
}

/**
 * True when this foundation lands in a codebase that already exists.
 *
 * Asked through `commandFor` rather than `origin.kind`: an import with nothing but documents in it
 * has no existing codebase to describe, so every document should read as it does for a new project.
 */
export function shipsCleanup(m: ProjectModel): boolean {
  return commandFor(m) === "cleanup";
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
  internal: "a single internal organization",
  other: "an isolation model of your own"
};

/** The tenancy in prose — the founder's own description when they wrote one (spec 159). */
export function tenancyName(m: ProjectModel): string {
  if (m.tenancy === "other" && m.tenancyOther) return m.tenancyOther;
  return tenancyLabel[m.tenancy];
}

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
  self_host: "self-hosted",
  // Only ever read when the founder left the field empty — `hostingName` prefers their own words.
  other: "your own deploy target"
};

/** The deploy target in prose — the founder's own words when they named one (spec 159). */
export function hostingName(m: ProjectModel): string {
  if (m.hosting === "other" && m.hostingOther) return m.hostingOther;
  return hostingLabel[m.hosting];
}

const DATABASE_LABEL: Record<Database, string> = {
  supabase: "Supabase",
  postgres: "PostgreSQL (self-hosted)",
  other: "the database you described"
};

/** The database in prose — the founder's own words when they named one (spec 159). */
export function databaseLabel(m: ProjectModel): string {
  if (m.stack.database === "other" && m.databaseOther) return m.databaseOther;
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
