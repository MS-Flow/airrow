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
import { uiKitFor } from "../../schemas/src/ui-kits.ts";

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

/**
 * A hidden delivery's folder name from whatever the founder typed, or `null` when there is nothing
 * usable in it (spec 187).
 *
 * Deliberately *not* `slugify`, whose empty case falls back to `"project"`. That fallback is right
 * for a project slug, which must exist and which nobody reads as a promise; it is wrong here,
 * because it would answer a founder who typed punctuation with a folder called `project` that they
 * never chose and would not recognise in their own repository. Nothing usable is an answer, and the
 * caller decides what to do with it — refuse a submission, or fill a prefill.
 */
export function hiddenFolderFrom(raw: string): string | null {
  const folder = raw
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48)
    .replace(/-+$/, "");
  return folder === "" ? null : folder;
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

  // Same test `hasExistingCode` applies to the finished model, asked here because `uiKit` is
  // resolved before there is a model to ask.
  // An origin with no delivery is normalised here rather than trusted to arrive complete: the field
  // is newer than the callers (spec 187), and every import that predates it was delivered
  // integrated — so the fill-in is what actually happened, not a guess. Doing it once, at the only
  // door into the model, is what lets `hiddenFolder` read the field without defending itself.
  const given: ProjectOrigin = input.origin ?? { kind: "new" };
  const origin: ProjectOrigin =
    given.kind === "imported" ? { ...given, delivery: given.delivery ?? { kind: "integrated" } } : given;
  const imported = origin.kind === "imported" && origin.stackDetected;
  const hidden = hiddenFolderOf(origin);

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
    origin,
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
    // A theme only means something where something installs it. Two cases where nothing does: a
    // stack the founder named themselves, which brings its own conventions and gets no second design
    // system on top of them; and an imported project, whose `/cleanup` changes no code and installs
    // nothing at all. Resolving both to null here — rather than at each place that reads it — is
    // what makes "prose-only, and say so" one decision instead of several chances to disagree.
    uiKit:
      framework === "custom" || imported ? null : uiKitFor(a.uiKit),
    uiReferenceLinks: splitReferenceLinks(a.uiReferenceLinks ?? "").slice(0, MAX_UI_REFERENCE_LINKS),
    // Set by the caller that knows — the app, which owns the rows. The engine renders a brief that
    // says whether there was anything to look at; it never sees the images themselves (spec 159).
    uiReferenceImageCount: input.referenceImageCount ?? 0,
    nonGoals: (a.nonGoals ?? "").trim(),
    // Only an integrated import is asked, and only it may act on the answer: a hidden foundation
    // changes nothing outside its folder, so `describe` is the only thing it could ever do, and a
    // greenfield project has no existing documents for the question to be about (spec 212).
    // Gated on the origin rather than on `imported`, which means "arrived with code": a
    // documents-only import has documents precisely because that is all it brought.
    existingDocs: origin.kind === "imported" && hidden === null ? (a.existingDocs ?? "describe") : "describe",
    // The mirror image: only a hidden import is asked, because only there does the answer change a
    // document. Null everywhere else means "this foundation's own branch model", which is what a
    // greenfield repository and an adopted integrated one both get.
    branching:
      hidden !== null && a.branchingModel !== undefined
        ? {
            model: a.branchingModel,
            describedByFounder:
              a.branchingModel === "other" ? (a.branchingModelOther ?? "").trim() : ""
          }
        : null,
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

/** A command a founder runs once, before the spec loop takes over (specs 91, 214). */
export type FirstRunCommand = "start" | "sync" | "cleanup";

/**
 * The first-run commands this foundation ships, and the only place that decision is made
 * (specs 91, 214).
 *
 * Three sets, one per kind of project:
 *
 * - **From nothing** — `/start` alone. It scaffolds a stack and takes the project to the bare
 *   minimum that runs. An import with no code in it lands here too: there is nothing to read.
 * - **Existing code, integrated** — `/sync` then `/cleanup`. One reads the project and writes the
 *   documents from it; the other reorganises the tree and clears out what nothing uses. They are
 *   split along observing versus mutating, which is what makes each explainable in a sentence.
 * - **Existing code, hidden** — `/sync` alone. Restructuring a repository the team shares is the one
 *   thing this layout exists to never do (spec 187), so the mutating half does not ship.
 *
 * `/start` is never paired with either: a repository holding both would be a repository where one of
 * them is wrong about whether a stack exists, and nothing in it says which.
 */
export function firstRunCommands(m: ProjectModel): FirstRunCommand[] {
  if (!hasExistingCode(m)) return ["start"];
  return hiddenFolder(m) === null ? ["sync", "cleanup"] : ["sync"];
}

/**
 * The command that opens the first session — the one the documents tell the founder to type.
 *
 * `firstRunCommands` is ordered, and the order is the sequence: `/cleanup` reads what `/sync` wrote,
 * so `/sync` is what a founder starts with wherever both ship.
 */
export function firstCommand(m: ProjectModel): FirstRunCommand {
  // `firstRunCommands` never returns an empty set — every branch of it names at least one command —
  // but the index signature cannot say so, and defaulting is cheaper than a non-null assertion.
  return firstRunCommands(m)[0] ?? "start";
}

/** Where those commands live in the generated repository, before the layout is applied. */
export function commandPaths(m: ProjectModel): string[] {
  return firstRunCommands(m).map((c) => `.claude/commands/${c}.md`);
}

/** Where the first of them lives — for the documents that name a file rather than a command. */
export function commandPath(m: ProjectModel): string {
  return `.claude/commands/${firstCommand(m)}.md`;
}

/**
 * The folder a hidden delivery nests under, or `null` when the foundation takes the tree as its own.
 *
 * The single place the layout is read. Everything downstream — the paths, what ships, what the
 * documents say about where to stand — asks this rather than unpacking `origin` again, so there is
 * one answer to "is this hidden" and not four that can drift (spec 187).
 */
export function hiddenFolder(m: ProjectModel): string | null {
  return hiddenFolderOf(m.origin);
}

/**
 * The same answer, from the origin alone. `resolveProjectModel` needs it while building the model it
 * would otherwise have to pass — one implementation rather than two that agree today (spec 212).
 */
function hiddenFolderOf(origin: ProjectOrigin): string | null {
  if (origin.kind !== "imported") return null;
  return origin.delivery.kind === "hidden" ? origin.delivery.folder : null;
}

/**
 * Where a generated file actually lands.
 *
 * Integrated, that is the path the template gave it. Hidden, everything moves together under one
 * folder — which is why the documents' own relative links keep resolving: the whole foundation
 * moved, not parts of it.
 */
export function deliveredPath(m: ProjectModel, path: string): string {
  const folder = hiddenFolder(m);
  return folder === null ? path : `${folder}/${path}`;
}

/** The command as the founder types it — for the documents that tell them to run it. */
export function commandName(m: ProjectModel): string {
  return `/${firstCommand(m)}`;
}

/**
 * The one thing this product has to do — `/start`'s ceiling, from wherever it is actually written.
 *
 * `mvpFocus` stopped being a question when the vision question absorbed it (spec 165), so the field
 * is now usually empty and the answer lives in `vision`, which asks for both. The description is the
 * last resort, as it always was. One helper rather than the same `||` chain at four call sites: this
 * decides what gets built, and four copies of it is four chances for one to fall out of step.
 */
export function coreAction(m: ProjectModel): string {
  return m.mvpFocus || m.vision || m.description;
}

/**
 * True when this foundation lands in a codebase that already exists.
 *
 * Asked through the origin rather than through what ships: an import with nothing but documents in
 * it has no existing codebase to describe, so every document should read as it does for a new
 * project. This is the question almost all document wording keys off.
 */
export function hasExistingCode(m: ProjectModel): boolean {
  return m.origin.kind === "imported" && m.origin.stackDetected;
}

/**
 * True when this foundation ships `/cleanup` — which is *not* the same as arriving at existing code
 * (spec 214).
 *
 * A hidden delivery has all the code in the world and still ships no `/cleanup`, because
 * restructuring a repository the team shares is the change that layout promises never to make. The
 * distinction matters wherever a document names the command rather than describing the project:
 * naming it in a hidden foundation would point the founder at a file that was never delivered.
 */
export function shipsCleanup(m: ProjectModel): boolean {
  return firstRunCommands(m).includes("cleanup");
}

/**
 * True when the founder brought a project of their own, whether or not it held code.
 *
 * The distinction from `shipsCleanup` matters in exactly one place and is easy to get backwards
 * (spec 212). Most document wording keys off *code*: present tense, "what this is", the setup that
 * already exists — a documents-only import has none of that and reads like a new project, which is
 * why `shipsCleanup` is the usual question. But the founder's **own documents** are what a
 * documents-only import consists of, and questions about them (`existingDocs`) are asked of it like
 * any other import. Answering them by the wrong test would drop the answer for the one project whose
 * whole import was documents.
 */
export function isImport(m: ProjectModel): boolean {
  return m.origin.kind === "imported";
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
