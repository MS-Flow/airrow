// Scaffold renderer: turns the canonical Airrow template + a resolved ProjectModel into the concrete
// invariant skeleton for a new customer project. Pure — no I/O, no env. The app enumerates the
// on-disk `template/**` files and passes them in; this module derives the interview-variable values,
// substitutes the {{TOKENS}}, and returns both the files AND a preview plan the founder must approve
// before anything is written or committed (constitution §0 — founder-in-control).

import type { GeneratedFile, ProjectModel } from "../../schemas/src/types.ts";
import { databaseLabel, frameworkLabel, hostingLabel, repoLabel } from "./model.ts";

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

interface Commands {
  CMD_DEV: string;
  CMD_BUILD: string;
  CMD_TYPECHECK: string;
  CMD_LINT: string;
  CMD_TEST: string;
}

function cmds(): Commands {
  // Customer projects are single-app repos; the golden path is pnpm-based.
  return {
    CMD_DEV: "pnpm dev",
    CMD_BUILD: "pnpm build",
    CMD_TYPECHECK: "pnpm typecheck",
    CMD_LINT: "pnpm lint",
    CMD_TEST: "pnpm test"
  };
}

function ciSetupSteps(): string {
  // Indented to sit under `steps:` in the workflow YAML.
  return [
    "      - uses: pnpm/action-setup@v4",
    "        with:",
    "          version: 9",
    "      - uses: actions/setup-node@v4",
    "        with:",
    "          node-version: 20",
    "          cache: pnpm",
    "      - run: pnpm install --frozen-lockfile"
  ].join("\n");
}

function deploySteps(): string {
  return [
    "      - name: Deploy to Vercel (DEV)",
    "        env:",
    "          VERCEL_TOKEN: ${{ secrets.VERCEL_TOKEN }}",
    "        run: |",
    '          if [ -z "$VERCEL_TOKEN" ]; then',
    '            echo "::warning::VERCEL_TOKEN missing — skipping DEV deploy until secrets are set."',
    "            exit 0",
    "          fi",
    '          pnpm dlx vercel@latest pull --yes --environment=preview --token="$VERCEL_TOKEN"',
    '          pnpm dlx vercel@latest build --token="$VERCEL_TOKEN"',
    '          pnpm dlx vercel@latest deploy --prebuilt --token="$VERCEL_TOKEN"'
  ].join("\n");
}

function rolesText(model: ProjectModel): string {
  if (model.roles === "none") return "Single user type — no role distinctions in v1.";
  if (model.roles === "granular")
    return "Granular roles & permissions across organizations (owner / admin / member and finer grants).";
  return "Organization membership with owner / admin / member roles.";
}

/** Derive the interview-variable values + their provenance from a resolved ProjectModel. */
export function deriveScaffoldValues(model: ProjectModel): {
  values: Record<string, string>;
  decisions: ScaffoldDecision[];
} {
  const command = cmds();
  const hosting = hostingLabel[model.hosting];
  const summary = `${frameworkLabel(model)} · TypeScript · Tailwind + shadcn/ui · ${databaseLabel(model)} (Postgres) · ${hosting} · ${repoLabel(model)}`;
  const roles = rolesText(model);

  const values: Record<string, string> = {
    PROJECT_NAME: model.name,
    PROJECT_SLUG: model.slug,
    PROJECT_TAGLINE: model.mvpFocus || "",
    PROJECT_DESCRIPTION: model.description,
    DOMAIN_OVERVIEW: `${model.name} is ${aOrAn(model.productType)} for ${audienceText(model)}. ${model.description}${model.vision ? ` The long-term vision: ${model.vision}` : ""}`,
    CORE_ENTITIES: model.coreEntities,
    ROLES: roles,
    STACK_SUMMARY: summary,
    STACK_DETAIL: summary,
    DEPLOY_TARGET: hosting,
    CI_SETUP_STEPS: ciSetupSteps(),
    DEPLOY_STEPS: deploySteps(),
    ARCHITECTURE_INVARIANTS: architectureInvariants(model),
    DATA_INVARIANTS: dataInvariants(model),
    DESIGN_INVARIANTS:
      "- Use the design-system tokens (color, spacing, radii, type) — never hardcode values in components.\n" +
      "- Reuse shared UI components before writing a new one.",
    ARCHITECTURE_LAYERS: architectureLayers(model),
    KEY_CONVENTIONS: keyConventions(model),
    ...command
  };

  const decisions: ScaffoldDecision[] = [
    dec("PROJECT_NAME", model.name, "interview", "Product name from the interview."),
    dec("STACK_SUMMARY", summary, "default", "Golden-path stack (Next.js/TS/Tailwind/Supabase), narrowed by the interview."),
    dec("CMD_TEST", command.CMD_TEST, "default", "pnpm-based golden-path commands."),
    dec("DEPLOY_TARGET", hosting, model.hosting === "vercel" ? "default" : "interview",
      model.hosting === "vercel"
        ? "Golden-path hosting."
        : `Chosen in the interview — the generated deploy workflow targets Vercel, so adjust it for ${hosting}.`),
    dec("ROLES", roles, model.roles === "none" ? "default" : "interview", "Derived from selected features/roles.")
  ];
  if (!model.mvpFocus) {
    decisions.push(dec("PROJECT_TAGLINE", "(unset)", "default", "No MVP focus given — left for the founder to fill."));
  }
  decisions.push(
    model.coreEntities
      ? dec("CORE_ENTITIES", model.coreEntities, "interview", "Core objects described in the interview.")
      : dec("CORE_ENTITIES", "(unset)", "default", "No core entities given — flagged for the founder to fill, never invented.")
  );
  return { values, decisions };
}

function dec(token: string, value: string, source: "interview" | "default", rationale: string): ScaffoldDecision {
  return { token, value, source, rationale };
}

function aOrAn(productType: ProjectModel["productType"]): string {
  const label = productType.replace(/_/g, " ");
  return /^[aeiou]/.test(label) ? `an ${label}` : `a ${label}`;
}

function audienceText(model: ProjectModel): string {
  switch (model.audience) {
    case "b2b": return "businesses";
    case "b2c": return "consumers";
    case "both": return "businesses and consumers";
    case "internal": return "internal users";
  }
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
  const base =
    "- Access control on every table/resource from day one; authorization decided server-side.\n" +
    "- Migrations are the only way the schema changes: idempotent, replay cleanly from zero, committed to the repo — never hand-edited in a dashboard.";
  if (model.derived.multiTenant)
    return "- Every resource hangs off `organization_id`; Row-Level Security on every table, with denial tests.\n" + base;
  return "- Rows are scoped to their owning user; enforce it in the database, not just the app.\n" + base;
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
  if (model.derived.hasAi) lines.push("- Validate all LLM output against a schema before acceptance; treat generated text as untrusted.");
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
export function renderScaffold(template: TemplateFile[], model: ProjectModel): RenderedScaffold {
  const { values, decisions } = deriveScaffoldValues(model);
  const missing = new Set<string>();

  const files: GeneratedFile[] = template
    .map((tf) => ({
      path: tf.path,
      content: substitute(tf.content, values, missing),
      source: "static" as const,
      templateId: `template/${tf.path}`
    }))
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
