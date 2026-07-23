// Stage 1: resolve. Wizard + interview answers → validated, derived ProjectModel.
// Pure. No I/O, no env, no external deps (F-101 FR-7).

import type {
  Audience,
  FeatureId,
  Framework,
  InterviewAnswers,
  ProductType,
  ProjectModel
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
  const features: FeatureId[] = [...(a.features ?? [])];

  // Auth is implied by almost everything user-facing.
  if (!features.includes("auth") && productType !== "api") features.unshift("auth");

  const audience: Audience = productType === "internal_tool" ? "internal" : (a.audience ?? "b2b");

  const framework: Framework =
    a.framework ?? (productType === "mobile_app" || productType === "browser_extension" ? "vite" : "nextjs");

  const multiTenant = features.includes("organizations");

  return {
    schemaVersion: "1",
    name: input.name.trim(),
    slug: slugify(input.name),
    description: input.description.trim(),
    productType,
    audience,
    features,
    roles: multiTenant ? (a.roles ?? "simple") : "none",
    stack: {
      framework,
      language: "typescript",
      styling: "tailwind",
      ui: "shadcn/ui",
      backend: "supabase",
      database: "postgresql",
      deployment: "vercel",
      repoProvider: a.repoProvider ?? "github",
      editor: "vscode",
      ai: "claude-code"
    },
    team: a.team ?? "solo",
    security: a.security ?? "standard",
    scale: a.scale ?? "validate",
    mvpFocus: (a.mvpFocus ?? "").trim(),
    goal90: (a.goal90 ?? "").trim(),
    derived: {
      multiTenant,
      hasPayments: features.includes("payments"),
      hasAi: features.includes("ai"),
      hasRealtime: features.includes("realtime"),
      hasAdmin: features.includes("admin"),
      needsAuth: features.includes("auth"),
      isWeb: productType !== "mobile_app"
    }
  };
}

// ── Label helpers used across document authors ──────────────────────────────

export const productTypeLabel: Record<ProductType, string> = {
  saas: "SaaS product",
  marketplace: "marketplace",
  ai_agent: "AI product",
  mobile_app: "mobile app",
  api: "API / developer platform",
  internal_tool: "internal tool",
  browser_extension: "browser extension"
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
  return m.stack.framework === "nextjs" ? "Next.js (App Router)" : "Vite + React";
}

export function repoLabel(m: ProjectModel): string {
  return m.stack.repoProvider === "github" ? "GitHub" : "Azure DevOps";
}

export function featureList(m: ProjectModel): string {
  return m.features.map((f) => featureLabel[f]).join(", ");
}
