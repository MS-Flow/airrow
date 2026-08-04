// Pure types shared across Airrow. No runtime dependencies.

import type { UiKit } from "./ui-kits.ts";

/** `other` means the founder described their product themselves, in `productTypeOther` (spec 159). */
export type ProductType =
  | "saas"
  | "marketplace"
  | "ai_agent"
  | "mobile_app"
  | "api"
  | "internal_tool"
  | "browser_extension"
  | "hobby"
  | "other";

export type Audience = "b2b" | "b2c" | "both" | "internal";

/** `other` means the founder described a capability of their own, in `capabilitiesOther` (spec 159). */
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
  | "audit_logs"
  | "other";

/** `custom` means the founder described their own stack in `frameworkOther`. */
export type Framework = "nextjs" | "vite" | "custom";
export type RepoProvider = "github" | "azure_devops";
export type TeamShape = "solo" | "small_team" | "startup" | "agency";
export type SecurityLevel = "standard" | "elevated";
export type ScaleExpectation = "validate" | "growth" | "high_scale";

/**
 * How data is organized & isolated — drives the data model and RLS strategy.
 *
 * `other` means the founder described their own isolation model in `tenancyOther` (spec 159). It is
 * deliberately *not* treated as multi-tenant: what a described model implies about `organization_id`
 * is the founder's own words to read, and guessing "everyone shares" from an answer we did not
 * understand is the one guess with a security consequence.
 */
export type Tenancy = "single_user" | "organizations" | "marketplace" | "internal" | "other";
/** How users authenticate (multi-select; `public` means no accounts). */
export type AuthMethod = "email_password" | "magic_link" | "social" | "sso" | "public";
/** Kind of AI in the product; the model stores `"none"` when AI is not selected. */
export type AiUsage = "llm_calls" | "rag" | "agents" | "ml_models";
/** Data sensitivity / compliance posture. */
export type DataSensitivity = "standard" | "pii" | "regulated";
/** Deploy target. `other` means the founder named their own, in `hostingOther` (spec 159). */
export type Hosting = "vercel" | "azure" | "self_host" | "other";
/**
 * Database provider. The two golden paths are PostgreSQL, which is what keeps RLS and SQL migrations
 * available (constitution §II); `other` is the founder's own, named in `databaseOther`, and the
 * generated documents then describe *their* database rather than assuming Postgres of it (spec 159).
 */
export type Database = "supabase" | "postgres" | "other";

/** Raw interview answers, keyed by question id. Order mirrors the interview flow. */
export interface InterviewAnswers {
  productType?: ProductType;
  /** The founder's own words for what they are building, when `productType` is `other`. */
  productTypeOther?: string;
  problem?: string;
  vision?: string;
  mvpFocus?: string;
  audience?: Audience;
  coreEntities?: string;
  nonGoals?: string;
  tenancy?: Tenancy;
  /** The founder's own isolation model, when `tenancy` is `other`. */
  tenancyOther?: string;
  authModel?: AuthMethod[];
  roles?: "simple" | "granular";
  capabilities?: FeatureId[];
  /** The capability no option covered, when `capabilities` includes `other`. */
  capabilitiesOther?: string;
  /** The founder's own database, when `database` is `other`. */
  databaseOther?: string;
  /** The founder's own deploy target, when `hosting` is `other`. */
  hostingOther?: string;
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
  /**
   * How the product should look, feel, and move — free text, feeds `UI_ARCHITECTURE.md` and `/start`.
   *
   * One answer, whether the founder wrote it from nothing or started from one of the directions the
   * question offers: picking one writes its words here, and they are theirs to edit from that moment
   * (spec 159). Which direction was picked is recorded separately, in `uiKit`.
   */
  uiDirection?: string;
  /**
   * Which curated direction the founder picked, if they picked one (spec 165).
   *
   * Spec 159 derived this from the prose — the option stayed highlighted while the text still began
   * with its prefill — and that was honest while the pick had no consequence beyond a highlight. It
   * now decides which theme `/start` installs, and a founder rewriting their opening sentence must
   * not silently cancel an install they chose. So it is stored, and only the "my own words" option
   * clears it.
   *
   * An imported project has a fourth answer the other paths do not: `KEEP_EXISTING_UI` — the look is
   * already there, and the foundation describes it rather than proposing one (spec 199). It is a
   * value of this field rather than a flag beside it, so one field still decides the theme and there
   * is nothing for a second field to disagree with. `uiKitFor` returns null for it, which is what
   * makes "described, never installed" hold without a branch anywhere.
   *
   * Not a question of its own: there is one design screen, and this is set from the picker on it.
   * `SATELLITE_ANSWERS` in `questions.ts` is what keeps it alive through `pruneHiddenAnswers`.
   */
  uiKit?: string;
  /**
   * How an imported foundation lands: alongside the founder's code, or inside one folder git ignores
   * (spec 187, asked first by spec 199).
   *
   * **Transient.** It is asked as a question, so it lives here — but it is never kept here. The save
   * writes it through to `import_sources.delivery`, which stays the one durable record and the one
   * thing the engine reads, and strips it from the answers blob (`TRANSIENT_ANSWERS`). Two copies of
   * a decision this consequential would eventually disagree, and the engine would read the wrong one.
   */
  deliveryLayout?: DeliveryLayout["kind"];
  /** The folder a hidden foundation nests under. Transient for the same reason as `deliveryLayout`. */
  hiddenFolder?: string;
  /**
   * What to do about the documents and conventions the project already has — a README, ADRs, an
   * existing assistant instruction file (spec 199). Asked only of an imported project, and only when
   * the foundation lands integrated: a hidden one may change nothing outside its folder, so
   * `describe` would be the only answer available and a question with one answer is not a question.
   */
  existingDocs?: "describe" | "adopt" | "leave";
  /**
   * Products the founder pointed at, as they typed them — whitespace-separated, at most five.
   *
   * Words, and only ever words: nothing here is fetched (see the spec's _Design decision_ 4). A URL
   * from an interview anyone can answer, resolved from our servers, is an SSRF surface that buys
   * markup saying little about how a page looks.
   */
  uiReferenceLinks?: string;
}

/**
 * One image the founder attached, ready for the authoring provider's vision block.
 *
 * Lives here rather than in the app because the app's authoring provider and its data layer both
 * speak it. **The engine never sees one** — `packages/engine` takes strings and stays synchronous
 * and pure (§I); what reaches a document is the model's *description* of an image, never an image.
 */
export interface UiReferenceImage {
  mediaType: "image/png" | "image/jpeg" | "image/webp";
  /** Raw bytes, base64-encoded — the shape the Claude API's image block takes. */
  base64: string;
}

/** One question's id — what the interview keys an answer by, and what names an answer elsewhere. */
export type AnswerId = keyof InterviewAnswers;

/**
 * How a foundation lands in the project that already exists (spec 187).
 *
 * `integrated` is the original shape: generated files take their own paths in the founder's tree,
 * collide with what is there, and are resolved file by file. `hidden` nests every one of them under
 * a single folder the founder names, which git is told to ignore — so a developer can bring Airrow
 * into a codebase they share without changing a line their team will see. The folder is carried
 * here rather than derived at delivery because the founder chose it, and a value they chose is not
 * something to recompute.
 */
export type DeliveryLayout = { kind: "integrated" } | { kind: "hidden"; folder: string };

/**
 * Where a project came from, and — for an import — whether the analysis found code to read.
 *
 * It decides which command the foundation ships (spec 91): a project started from nothing gets
 * `/start`, which scaffolds a stack; an imported one that already has a stack gets `/cleanup`, which
 * reads it and rewrites the documents to match. An import with nothing but documents in it has
 * nothing to read, so it gets `/start` like any other empty project.
 *
 * `delivery` hangs off the imported arm alone (spec 187): a project begun from nothing has a
 * repository of its own and nobody to hide from, so there is no layout to choose.
 */
export type ProjectOrigin =
  | { kind: "new" }
  | { kind: "imported"; stackDetected: boolean; delivery: DeliveryLayout };

/** Fully resolved, validated model the engine generates from. */
export interface ProjectModel {
  schemaVersion: "1";
  name: string;
  slug: string;
  description: string;
  origin: ProjectOrigin;
  vision: string;
  productType: ProductType;
  /** The founder's own words for their product type; empty unless `productType` is `other`. */
  productTypeOther: string;
  audience: Audience;
  tenancy: Tenancy;
  /** The founder's own isolation model; empty unless `tenancy` is `other`. */
  tenancyOther: string;
  authModel: AuthMethod[];
  /** Projected capability list (includes derived `auth`/`organizations`). */
  features: FeatureId[];
  /** The capability no option covered; empty unless `features` includes `other`. */
  capabilitiesOther: string;
  roles: "simple" | "granular" | "none";
  aiUsage: AiUsage | "none";
  integrations: string;
  hosting: Hosting;
  /** The founder's own deploy target; empty unless `hosting` is `other`. */
  hostingOther: string;
  /** The founder's own database; empty unless `stack.database` is `other`. */
  databaseOther: string;
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
  /**
   * The curated direction's theme, when one was picked (spec 165).
   *
   * Null covers every way of not picking: "my own words", a skipped question, an answer saved before
   * this existed, and a stack this theme cannot install into. All four mean the same thing to
   * everything downstream — name no theme, install nothing extra — which is why they share a value.
   */
  uiKit: UiKit | null;
  /** Products the founder pointed at, normalised to at most five entries. Never fetched. */
  uiReferenceLinks: string[];
  /**
   * How many images the founder attached. The bytes stay in the app (see `UiReferenceImage`); the
   * engine only needs to know whether the brief it renders had anything to look at.
   */
  uiReferenceImageCount: number;
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
