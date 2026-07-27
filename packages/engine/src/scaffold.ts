// Scaffold renderer: turns the canonical Airrow template + a resolved ProjectModel into the concrete
// invariant skeleton for a new customer project. Pure — no I/O, no env. The app enumerates the
// on-disk `template/**` files and passes them in; this module derives the interview-variable values,
// substitutes the {{TOKENS}}, and returns both the files AND a preview plan the founder must approve
// before anything is written or committed (constitution §0 — founder-in-control).

import type { FeatureId, GeneratedFile, ProjectModel } from "../../schemas/src/types.ts";
import {
  isAuthoredDocument,
  isProseSlot,
  type AuthoredDocuments,
  type AuthoredSlots
} from "../../schemas/src/authoring.ts";
import {
  aiUsageLabel,
  audienceLabel,
  authMethodLabel,
  backendSummary,
  databaseLabel,
  featureLabel,
  frameworkLabel,
  hostingLabel,
  productTypeLabel,
  repoLabel,
  tenancyLabel,
  usesSupabase
} from "./model.ts";

/** One template file as read from disk by the app. */
export interface TemplateFile {
  path: string;
  content: string;
}

/** A single derived value, with where it came from — surfaced to the founder in the preview. */
export interface ScaffoldDecision {
  token: string;
  value: string;
  source: "interview" | "default";
  rationale: string;
}

/** Everything the founder reviews before approving provisioning. */
export interface ScaffoldPlan {
  projectName: string;
  projectSlug: string;
  fileCount: number;
  tree: string[];
  decisions: ScaffoldDecision[];
  /** Unresolved tokens left as [NEEDS CLARIFICATION] markers — never guessed silently. */
  clarifications: string[];
}

export interface RenderedScaffold {
  files: GeneratedFile[];
  plan: ScaffoldPlan;
}

const TOKEN_RE = /\{\{([A-Z0-9_]+)\}\}/g;

/**
 * True when a rendered file still contains a template token. Deliberately narrower than "contains
 * `{{`": generated GitHub Actions workflows legitimately carry `${{ secrets.* }}` expressions.
 */
export function hasUnresolvedToken(content: string): boolean {
  return /\{\{[A-Z0-9_]+\}\}/.test(content);
}

interface Commands {
  CMD_DEV: string;
  CMD_BUILD: string;
  CMD_TYPECHECK: string;
  CMD_LINT: string;
  CMD_TEST: string;
}

/**
 * Package manager per framework: Next.js ships a pnpm-first toolchain, while the Vite + React
 * scaffold (`npm create vite@latest`) is npm-based. Using one everywhere left the generated
 * instructions contradicting the chosen stack.
 */
function packageManager(model: ProjectModel): "pnpm" | "npm" {
  return model.stack.framework === "vite" ? "npm" : "pnpm";
}

function cmds(model: ProjectModel): Commands {
  // Customer projects are single-app repos, so every script runs from the repo root.
  const run = packageManager(model) === "npm" ? "npm run" : "pnpm";
  return {
    CMD_DEV: `${run} dev`,
    CMD_BUILD: `${run} build`,
    CMD_TYPECHECK: `${run} typecheck`,
    CMD_LINT: `${run} lint`,
    CMD_TEST: `${run} test`
  };
}

/** `install` for the chosen package manager — the reproducible, lockfile-respecting form. */
function installCommand(model: ProjectModel, ci: boolean): string {
  if (packageManager(model) === "npm") return ci ? "npm ci" : "npm install";
  return ci ? "pnpm install --frozen-lockfile" : "pnpm install";
}

function ciSetupSteps(model: ProjectModel): string {
  // Indented to sit under `steps:` in the workflow YAML.
  const setupNode = [
    "      - uses: actions/setup-node@v4",
    "        with:",
    "          node-version: 20",
    `          cache: ${packageManager(model)}`
  ];
  const steps =
    packageManager(model) === "pnpm"
      ? ["      - uses: pnpm/action-setup@v4", "        with:", "          version: 9", ...setupNode]
      : setupNode;
  return [...steps, `      - run: ${installCommand(model, true)}`].join("\n");
}

/** Deploy steps for the chosen host. Non-Vercel targets get an explicit, honest placeholder. */
function deploySteps(model: ProjectModel): string {
  const host = hostingLabel[model.hosting];
  if (model.hosting !== "vercel") {
    return [
      `      - name: Deploy to ${host} (DEV)`,
      "        run: |",
      `          echo "::warning::No deploy steps wired for ${host} yet — add them here, then remove this guard."`,
      "          exit 0"
    ].join("\n");
  }
  const dlx = packageManager(model) === "npm" ? "npx" : "pnpm dlx";
  return [
    "      - name: Deploy to Vercel (DEV)",
    "        env:",
    "          VERCEL_TOKEN: ${{ secrets.VERCEL_TOKEN }}",
    "        run: |",
    '          if [ -z "$VERCEL_TOKEN" ]; then',
    '            echo "::warning::VERCEL_TOKEN missing — skipping DEV deploy until secrets are set."',
    "            exit 0",
    "          fi",
    `          ${dlx} vercel@latest pull --yes --environment=preview --token="$VERCEL_TOKEN"`,
    `          ${dlx} vercel@latest build --token="$VERCEL_TOKEN"`,
    `          ${dlx} vercel@latest deploy --prebuilt --token="$VERCEL_TOKEN"`
  ].join("\n");
}

function rolesText(model: ProjectModel): string {
  if (model.roles === "none") return "Single user type — no role distinctions in v1.";
  if (model.roles === "granular")
    return "Granular roles & permissions across organizations (owner / admin / member and finer grants).";
  return "Organization membership with owner / admin / member roles.";
}

/**
 * Derive the interview-variable values + their provenance from a resolved ProjectModel.
 *
 * `authored` is optional LLM-written prose (spec 65). It is merged **only** over the slots in
 * `PROSE_SLOTS`; anything else in it is ignored. That is the point rather than a detail: the
 * excluded slots are commands and setup steps a founder will run, and interview answers — the
 * authoring input — can come from an unauthenticated visitor. A `null` or empty value means the
 * interview didn't support one, so the derived value stands and the founder gets a
 * `[NEEDS CLARIFICATION]` marker instead of an invention.
 */
export function deriveScaffoldValues(
  model: ProjectModel,
  authored?: AuthoredSlots
): {
  values: Record<string, string>;
  decisions: ScaffoldDecision[];
  /** Tokens whose value came from the model rather than being derived — the manifest reports them. */
  authoredTokens: Set<string>;
} {
  const command = cmds(model);
  const hosting = hostingLabel[model.hosting];
  const summary = `${frameworkLabel(model)} · TypeScript · Tailwind + shadcn/ui · ${databaseLabel(model)} (Postgres) · ${hosting} · ${repoLabel(model)}`;
  const roles = rolesText(model);

  const values: Record<string, string> = {
    PROJECT_NAME: model.name,
    PROJECT_SLUG: model.slug,
    PROJECT_TAGLINE: model.mvpFocus || "",
    PROJECT_DESCRIPTION: model.description,
    DOMAIN_OVERVIEW: `${model.name} is ${aOrAn(productTypeLabel[model.productType])} for ${audienceLabel[model.audience]}. ${model.description}`,
    VISION: model.vision,
    MVP_FOCUS: model.mvpFocus,
    PROBLEM: model.problem,
    NON_GOALS: nonGoalsText(model),
    CAPABILITY_SCOPE: capabilityScope(model),
    CAPABILITY_SPECS: capabilitySpecs(model),
    TENANCY_MODEL: tenancyModel(model),
    AUTH_MODEL: authModelText(model),
    CORE_ENTITIES: model.coreEntities,
    INTEGRATIONS: integrationsText(model),
    SECURITY_POSTURE: securityPosture(model),
    SCALE_POSTURE: scalePosture(model),
    ROLES: roles,
    STACK_SUMMARY: summary,
    STACK_DETAIL: `${frameworkLabel(model)} · TypeScript · Tailwind + shadcn/ui · ${backendSummary(model)} · deployed to ${hosting} · code on ${repoLabel(model)}`,
    REPO_PROVIDER: repoLabel(model),
    SETUP_STEPS: setupSteps(model),
    FIRST_SPEC_HINT: firstSpecHint(model),
    DEPLOY_TARGET: hosting,
    CI_SETUP_STEPS: ciSetupSteps(model),
    DEPLOY_STEPS: deploySteps(model),
    ARCHITECTURE_INVARIANTS: architectureInvariants(model),
    DATA_INVARIANTS: dataInvariants(model),
    DESIGN_INVARIANTS:
      "- Use the design-system tokens (color, spacing, radii, type) — never hardcode values in components.\n" +
      "- Reuse shared UI components before writing a new one.",
    ARCHITECTURE_LAYERS: architectureLayers(model),
    KEY_CONVENTIONS: keyConventions(model),
    ...command
  };

  const authoredTokens = new Set<string>();
  for (const [token, prose] of Object.entries(authored ?? {})) {
    if (!isProseSlot(token)) continue;
    if (typeof prose !== "string") continue;
    const trimmed = prose.trim();
    if (trimmed === "") continue;
    values[token] = trimmed;
    authoredTokens.add(token);
  }

  const decisions: ScaffoldDecision[] = [
    dec("PROJECT_NAME", model.name, "interview", "Product name from the interview."),
    dec("STACK_SUMMARY", summary, "default", "Golden-path stack (Next.js/TS/Tailwind/Supabase), narrowed by the interview."),
    dec("CMD_TEST", command.CMD_TEST, "default", `${packageManager(model)} — the package manager the ${frameworkLabel(model)} toolchain defaults to.`),
    dec("DEPLOY_TARGET", hosting, model.hosting === "vercel" ? "default" : "interview",
      model.hosting === "vercel"
        ? "Golden-path hosting."
        : `Chosen in the interview — the DEV deploy workflow ships as a placeholder for ${hosting}.`),
    dec("TENANCY_MODEL", tenancyLabel[model.tenancy], "interview", "Data isolation model chosen in the interview — drives the access-control invariant."),
    dec("AUTH_MODEL", model.authModel.map((a) => authMethodLabel[a]).join(", "), "interview", "Sign-in methods chosen in the interview."),
    dec("ROLES", roles, model.roles === "none" ? "default" : "interview", "Derived from the tenancy and roles answers."),
    dec("CAPABILITY_SCOPE", model.features.join(", ") || "(none)", "interview", "Capabilities selected for year one, plus the identity features implied by tenancy/auth."),
    dec("SECURITY_POSTURE", model.dataSensitivity, "interview", "Data-sensitivity answer — drives the encryption/audit posture."),
    dec("SCALE_POSTURE", model.scale, "interview", "Scale target for v1 — drives the caching/database posture.")
  ];
  if (!model.mvpFocus) {
    decisions.push(dec("PROJECT_TAGLINE", "(unset)", "default", "No MVP focus given — left for the founder to fill."));
  }
  decisions.push(
    model.vision
      ? dec("VISION", model.vision, "interview", "Long-term vision from the interview.")
      : dec("VISION", "(unset)", "default", "No vision given — flagged for the founder to fill, never invented.")
  );
  decisions.push(
    model.coreEntities
      ? dec("CORE_ENTITIES", model.coreEntities, "interview", "Core objects described in the interview.")
      : dec("CORE_ENTITIES", "(unset)", "default", "No core entities given — flagged for the founder to fill, never invented.")
  );
  return { values, decisions, authoredTokens };
}

function dec(token: string, value: string, source: "interview" | "default", rationale: string): ScaffoldDecision {
  return { token, value, source, rationale };
}

/**
 * Non-goals are optional in the interview, but the slot is not: it lands in the generated CLAUDE.md,
 * where an empty value would read as "there are none" — an invitation to build anything. Unanswered
 * gets an explicit note to fill it in, matching how an unanswered vision is handled.
 */
function nonGoalsText(model: ProjectModel): string {
  return model.nonGoals || "_Not yet decided — add what this product is deliberately not doing._";
}

function aOrAn(label: string): string {
  return /^[aeiou]/i.test(label) ? `an ${label}` : `a ${label}`;
}

function capabilityScope(model: ProjectModel): string {
  if (model.features.length === 0) {
    return "Nothing beyond the core product itself — no auth, payments, or other platform capabilities in v1.";
  }
  return model.features.map((f) => `- **${featureLabel[f]}**`).join("\n");
}

/** What each selected capability's first spec must cover — one section per capability, never for an unselected one. */
function capabilitySpecs(model: ProjectModel): string {
  if (model.features.length === 0) {
    return "No platform capabilities were selected. Spec the core product flow first — see `docs/VISION.md`.";
  }
  return model.features.map((f) => `### ${featureLabel[f]}\n${capabilitySpecBrief(f, model)}`).join("\n\n");
}

function capabilitySpecBrief(feature: FeatureId, model: ProjectModel): string {
  const scoping = model.derived.multiTenant ? "organization" : "owning user";
  switch (feature) {
    case "auth":
      return `Sign-in via ${model.authModel.map((a) => authMethodLabel[a]).join(", ")}. Cover session handling, the post-signup record every other table hangs off, and what an unauthenticated request may reach.`;
    case "organizations":
      return `Organizations, membership, and invitations. Every table carries \`organization_id\`; cover the join flow, the last-owner rule, and a denial test proving a non-member sees nothing.`;
    case "roles":
      return "Role assignment and permission checks, decided server-side. Cover the default role, who may change roles, and a denial test per protected action.";
    case "payments":
      return `Plans, checkout, and the webhook that is the source of truth for entitlement. Cover the ${scoping} the subscription attaches to, failed payments, and idempotent webhook handling.`;
    case "notifications":
      return "In-app notification records, delivery, and read state. Cover per-type preferences and what happens when the recipient never opens the app.";
    case "search":
      return `Searchable fields, ranking, and the empty-result state. Cover how results stay scoped to the ${scoping}.`;
    case "storage":
      return `Uploads, allowed types and size limits, and access control on every object. Cover ${usesSupabase(model) ? "signed URLs with a short expiry" : "how you sign and expire download URLs"}, and deletion cascading with its owner row.`;
    case "ai":
      return `${model.aiUsage === "none" ? "[NEEDS CLARIFICATION: what kind of AI does this product use?]" : `AI approach: ${aiUsageLabel[model.aiUsage]}.`} Cover the provider call site (server-side only), schema validation of every model response before it is accepted, cost/rate limits, and the failure path when the model is unavailable.`;
    case "analytics":
      return "The handful of events that actually inform decisions, and who may read them. Cover what is never sent to a third party.";
    case "realtime":
      return `Which entities push live updates, the channel per ${scoping}, and reconnection behaviour. Cover authorization on subscribe — not just on read.`;
    case "email":
      return "Transactional templates, the sending provider, and bounce handling. Cover unsubscribe and what must never appear in an email body.";
    case "admin":
      return "The internal-only surface, who may reach it, and every action it can take. Cover the audit trail for privileged actions.";
    case "audit_logs":
      return "An append-only record of actor, action, entity, and timestamp. Cover retention, who may read it, and the absence of update/delete paths.";
  }
}

function tenancyModel(model: ProjectModel): string {
  const base = `Data is organized as ${tenancyLabel[model.tenancy]}.`;
  if (model.derived.multiTenant) {
    return `${base} Every table carries \`organization_id\`, access control is enforced in the database, and every new table ships with a denial test proving a non-member cannot read it.`;
  }
  if (model.tenancy === "internal") {
    return `${base} Rows belong to the organization as a whole; enforce access in the database, and keep an explicit answer for "who may see this row" on every table.`;
  }
  return `${base} Rows are scoped to their owning user and enforced in the database, not just in the application layer.`;
}

function authModelText(model: ProjectModel): string {
  if (!model.derived.needsAuth) {
    return "No accounts — the product is used without signing in. Nothing is user-scoped, so keep the data model free of per-user ownership until that changes.";
  }
  const methods = model.authModel.map((a) => authMethodLabel[a]).join(", ");
  const provider = usesSupabase(model) ? "Supabase Auth" : `your own auth layer on ${databaseLabel(model)}`;
  return `Users sign in with ${methods}, handled by ${provider}. The signed-in user id is the anchor every ${model.derived.multiTenant ? "organization membership" : "owned row"} hangs off.`;
}

function integrationsText(model: ProjectModel): string {
  if (model.integrations) return model.integrations;
  if (model.derived.hasPayments) {
    return "[NEEDS CLARIFICATION: payments were selected but no payment provider was named — decide the provider before the first payments spec.]";
  }
  return "None named in the interview. Record each external system here as you integrate it.";
}

function securityPosture(model: ProjectModel): string {
  switch (model.dataSensitivity) {
    case "regulated":
      return "Regulated data (health, finance, or minors). Security work is feature work: encrypt sensitive fields at rest, keep an audit trail of every access to regulated records, never log values, and ship deletion + export paths with the first data-bearing feature.";
    case "pii":
      return "Personal data at scale. Minimize what you collect, never log personal values, encrypt sensitive fields at rest, and ship deletion + export paths with the first data-bearing feature.";
    case "standard":
      return "Standard business data. Least privilege, secure defaults, secrets only in environment variables, and no personal data in logs beyond IDs.";
  }
}

function scalePosture(model: ProjectModel): string {
  switch (model.scale) {
    case "validate":
      return "Optimize for speed of learning, not throughput. Boring queries, no caching layer, no premature sharding — add them when a real number demands it.";
    case "growth":
      return "Build growth-ready: index every column you filter on, paginate every list, and cache the expensive read paths behind an explicit key. Conservative data modeling now beats a migration under load later.";
    case "high_scale":
      return "Expect rapid adoption. Index and paginate from day one, cache expensive reads, keep write paths idempotent, and leave headroom in the data model — measure before optimizing, but design so the measurement has somewhere to go.";
  }
}

/** The ordered first-hour setup, specific to the chosen database and host. */
function setupSteps(model: ProjectModel): string {
  const steps =
    packageManager(model) === "pnpm"
      ? [
          "1. Install **Node 20+** and **pnpm 9** (`corepack enable && corepack prepare pnpm@9 --activate`).",
          "2. Install dependencies: `pnpm install`."
        ]
      : [
          "1. Install **Node 20+** — npm ships with it, which is what this project uses.",
          "2. Install dependencies: `npm install`."
        ];
  if (usesSupabase(model)) {
    steps.push(
      "3. Create a **Supabase** project, then copy the project URL and anon key from Project Settings → API.",
      "4. Copy `.env.example` to `.env.local` and fill in those two values (plus the service-role key, server-side only — never expose it to the browser).",
      "5. Apply the database migrations to your Supabase project; every schema change from here is a committed migration, never a dashboard edit."
    );
  } else {
    steps.push(
      `3. Provision a **${databaseLabel(model)}** instance and note its connection string.`,
      "4. Copy `.env.example` to `.env.local` and fill in the connection string (server-side only — never expose it to the browser).",
      "5. Apply the database migrations; every schema change from here is a committed migration, never a hand-edit."
    );
  }
  steps.push(`6. ${deployTargetSetup(model)}, and note the credentials CI will need.`);
  return steps.join("\n");
}

/** How the founder prepares the deploy target — a hosted project, or their own server. */
function deployTargetSetup(model: ProjectModel): string {
  if (model.hosting === "self_host") return "Prepare the server you will deploy to";
  return `Create the ${hostingLabel[model.hosting]} project you will deploy to`;
}

function firstSpecHint(model: ProjectModel): string {
  if (!model.mvpFocus) {
    return "Start with the single flow the product is useless without. [NEEDS CLARIFICATION: the MVP focus was left blank — decide it before writing the first spec.]";
  }
  return `Start with the flow the MVP is useless without: **${model.mvpFocus}** Spec that one flow end to end — not the whole product.`;
}

function architectureInvariants(model: ProjectModel): string {
  const web = frameworkLabel(model);
  return (
    `- One-way data flow through the ${web} app; routes stay thin, logic lives in features, pure logic in packages.\n` +
    "- External calls (database, third-party APIs) happen server-side only, in a typed data layer — never from components.\n" +
    "- `any` is forbidden (TypeScript strict); validate every boundary with a schema; return typed errors, not thrown strings.\n" +
    "- Autogenerated files (lockfile, build output, generated types) are never hand-edited."
  );
}

function dataInvariants(model: ProjectModel): string {
  const lines = [
    model.derived.multiTenant
      ? "- Every resource hangs off `organization_id`; Row-Level Security on every table, with denial tests."
      : "- Rows are scoped to their owning user; enforce it in the database, not just the app.",
    "- Access control on every table/resource from day one; authorization decided server-side.",
    "- Migrations are the only way the schema changes: idempotent, replay cleanly from zero, committed to the repo — never hand-edited in a dashboard."
  ];
  if (model.dataSensitivity !== "standard") {
    lines.push(
      model.dataSensitivity === "regulated"
        ? "- Regulated data: encrypt sensitive fields at rest, audit every access, and never log values — only IDs."
        : "- Personal data: collect the minimum, never log values, and ship deletion + export paths with the first data-bearing feature."
    );
  }
  return lines.join("\n");
}

function architectureLayers(model: ProjectModel): string {
  return (
    `${frameworkLabel(model)} with a typed data layer:\n\n` +
    "```\nroutes / pages (server-first)\n  → components\n    → server actions / API handlers\n      → data layer (typed)\n        → database & external services\n```\n\n" +
    "External calls happen only in the data layer, server-side. Pure logic lives in packages, free of I/O and env access."
  );
}

function keyConventions(model: ProjectModel): string {
  const lines = [
    "- Server-first: server components/actions by default; client components only where interactivity needs them.",
    "- Data access only through the typed data layer — no ad-hoc queries in components.",
    "- Feature-module organization: a feature's UI, logic, and types live together."
  ];
  if (model.derived.multiTenant) lines.push("- Every query is organization-scoped; RLS + a denial test accompany every new table.");
  if (model.derived.hasAi) {
    lines.push(
      `- AI (${model.aiUsage === "none" ? "kind not yet decided" : aiUsageLabel[model.aiUsage]}): provider calls happen server-side only, and every model response is validated against a schema before it is accepted — generated text is untrusted.`
    );
  }
  if (model.dataSensitivity !== "standard") {
    lines.push("- Sensitive data: no personal values in logs; review the security posture in `docs/architecture/SYSTEM_OVERVIEW.md` before any feature that touches user data.");
  }
  if (model.scale !== "validate") lines.push("- Index what you filter on and paginate every list — the scale target assumes real growth.");
  return lines.join("\n");
}

/** Substitute {{TOKENS}} in one template string; unknown tokens become NEEDS CLARIFICATION markers. */
function substitute(
  content: string,
  values: Record<string, string>,
  missing: Set<string>
): string {
  return content.replace(TOKEN_RE, (_match, token: string) => {
    const value = values[token];
    if (value === undefined || value === "") {
      missing.add(token);
      return `[NEEDS CLARIFICATION: ${token}]`;
    }
    return value;
  });
}

/**
 * Render the full scaffold from template files + a resolved model.
 * Returns the files plus a ScaffoldPlan for the founder to approve before provisioning.
 * `EXCLUDED` meta files (e.g. .airrow-template.json) are dropped by the caller before passing in.
 */
export function renderScaffold(
  template: TemplateFile[],
  model: ProjectModel,
  authored?: AuthoredSlots,
  authoredDocuments?: AuthoredDocuments
): RenderedScaffold {
  const { values, decisions, authoredTokens } = deriveScaffoldValues(model, authored);
  const missing = new Set<string>();

  /**
   * A narrative document the model wrote end to end replaces the template's scaffolding, so the
   * headings and transitions belong to this project rather than being the same in every one. Only
   * the paths in `AUTHORED_DOCUMENTS` are eligible — everything else, including every file carrying
   * a command, renders from the template exactly as before. Substitution still runs over the result:
   * the contract rejects unrendered tokens, so it is a no-op, and if one ever slipped through the
   * founder gets a `[NEEDS CLARIFICATION]` marker rather than a literal `{{TOKEN}}`.
   */
  const bodyFor = (tf: TemplateFile): string => {
    if (!isAuthoredDocument(tf.path)) return tf.content;
    const written = authoredDocuments?.[tf.path];
    return typeof written === "string" && written.trim() !== "" ? written : tf.content;
  };

  /**
   * `authored` means the model's words are in this file — either it wrote the whole body, or the
   * template left a slot open that the model filled. Asked against the template body, before
   * substitution, because that is where the `{{TOKEN}}` still is.
   *
   * Everything else is `static`: the same words every project gets. The distinction is the point of
   * recording it — it is what tells a reader months from now which files a prompt change can move.
   */
  const files: GeneratedFile[] = template
    .map((tf) => {
      const body = bodyFor(tf);
      const fromModel =
        body !== tf.content || [...authoredTokens].some((t) => body.includes(`{{${t}}}`));
      return {
        path: tf.path,
        content: substitute(body, values, missing),
        source: fromModel ? ("authored" as const) : ("static" as const),
        templateId: `template/${tf.path}`
      };
    })
    .sort((a, b) => a.path.localeCompare(b.path));

  const plan: ScaffoldPlan = {
    projectName: model.name,
    projectSlug: model.slug,
    fileCount: files.length,
    tree: files.map((f) => f.path),
    decisions,
    clarifications: [...missing].sort().map((t) => `[NEEDS CLARIFICATION: ${t}]`)
  };

  return { files, plan };
}
