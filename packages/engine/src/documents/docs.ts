// Product docs: vision, roadmap, getting started, architecture, tech stack, database.

import type { FeatureId, GeneratedFile, ProjectModel } from "../../../schemas/src/types.ts";
import {
  aiUsageLabel,
  audienceLabel,
  authSummary,
  databaseLabel,
  featureLabel,
  frameworkLabel,
  hostingLabel,
  isSpaFramework,
  productTypeLabel,
  repoLabel,
  teamLabel,
  usesSupabase
} from "../model.ts";

const authored = (path: string, templateId: string, content: string): GeneratedFile => ({
  path,
  templateId,
  source: "authored",
  content: content.trimStart()
});

export function vision(m: ProjectModel): GeneratedFile {
  return authored(
    "docs/VISION.md",
    "docs/vision",
    `
# ${m.name} — Vision

## What we're building

${m.description}

${m.name} is a ${productTypeLabel[m.productType]} for ${audienceLabel[m.audience]}.

## The long-term vision

> ${m.vision || "[NEEDS CLARIFICATION: long-term vision]"}

This is the destination. Every milestone below is a step toward it — build for this, not just the MVP.

## The MVP promise

> ${m.mvpFocus}

Everything in the first milestones serves this promise. Features that don't serve it wait.

## Guiding principles

1. **Ship the promise first.** The MVP focus above beats every "nice to have."
2. **${m.scale === "validate" ? "Learn before scaling." : "Build growth-ready."}** ${m.scale === "validate" ? "Optimize for speed of learning; scale when signal demands it." : "Expect rapid adoption: conservative data modeling, boring proven infrastructure, headroom in the architecture."}
3. **Foundation over improvisation.** Specs before code; decisions recorded; AI context maintained. That's how ${teamLabel[m.team]} stays fast without chaos.
${m.security === "elevated" ? "4. **Trust is the product.** Elevated data sensitivity means security work is feature work, never overhead." : ""}
`
  );
}

const featureMilestoneOrder: FeatureId[] = [
  "auth",
  "organizations",
  "roles",
  "storage",
  "search",
  "payments",
  "email",
  "notifications",
  "ai",
  "realtime",
  "analytics",
  "admin",
  "audit_logs"
];

export function roadmap(m: ProjectModel): GeneratedFile {
  const ordered = featureMilestoneOrder.filter((f) => m.features.includes(f));
  const core = ordered.slice(0, Math.min(4, ordered.length));
  const later = ordered.slice(core.length);
  return authored(
    "docs/ROADMAP.md",
    "docs/roadmap",
    `
# ${m.name} — Roadmap

Work strictly top to bottom. Each feature: spec → implement → review → document (see \`docs/workflows/FEATURE_WORKFLOW.md\`).

## Milestone 0 — Setup (you are here)

- Environment per \`docs/GETTING_STARTED.md\`
- ${frameworkLabel(m)} scaffold with design tokens + CI to ${hostingLabel[m.hosting]}
- Supabase project, initial schema + RLS baseline

## Milestone 1 — MVP core

Goal: *"${m.mvpFocus}"*

${core.map((f, i) => `${i + 1}. **${featureLabel[f]}** — spec: \`specs/mvp/${f}.md\``).join("\n")}
${core.length === 0 ? "1. Define the single core workflow that delivers the MVP promise; spec it first." : ""}

Exit: the MVP promise works end-to-end for a real ${m.audience === "b2b" || m.audience === "internal" ? "team" : "user"}.

## Milestone 2 — Complete the experience

${later.length > 0 ? later.map((f, i) => `${i + 1}. **${featureLabel[f]}** — spec: \`specs/mvp/${f}.md\``).join("\n") : "- Polish, onboarding, and the highest-signal feedback from Milestone 1."}

## Milestone 3 — Launch readiness

- Error tracking + analytics baseline
- Security review (\`docs/standards/SECURITY_STANDARDS.md\` checklist)
- Performance pass, empty/error states, legal pages
- Public launch toward the vision: *"${m.vision}"*

## Later (direction, not commitments)

Ideas go here — never straight into a milestone. Re-prioritize at each milestone boundary.
`
  );
}

export function gettingStarted(m: ProjectModel): GeneratedFile {
  const isGh = m.stack.repoProvider === "github";
  return authored(
    "docs/GETTING_STARTED.md",
    "docs/getting-started",
    `
# Getting Started

From zero to running locally. ~45 minutes.

## 1. Install tools

- **VS Code** — https://code.visualstudio.com
- **Node.js 20+** — https://nodejs.org (verify: \`node --version\`)
- **pnpm** — \`npm install -g pnpm\`
- **Git** — https://git-scm.com (verify: \`git --version\`)
- **Claude Code** — \`npm install -g @anthropic-ai/claude-code\`, then \`claude login\`
- **Supabase CLI** — https://supabase.com/docs/guides/cli

## 2. Create your repository

${
  isGh
    ? `1. Create a new private repo on GitHub named \`${m.slug}\`.
2. In this folder: \`git init && git add -A && git commit -m "chore: engineering foundation"\`
3. \`git remote add origin git@github.com:<you>/${m.slug}.git && git push -u origin main\``
    : `1. Create a project + repo named \`${m.slug}\` in Azure DevOps.
2. In this folder: \`git init && git add -A && git commit -m "chore: engineering foundation"\`
3. \`git remote add origin https://dev.azure.com/<org>/${m.slug}/_git/${m.slug} && git push -u origin main\``
}

## 3. Create the database

${
  usesSupabase(m)
    ? `1. https://supabase.com → New project (name: \`${m.slug}\`).
2. Save the project URL, anon key, and service-role key — you'll add them to \`.env.local\` when the app scaffold exists.
3. \`supabase init\` in this repo; migrations will live in \`supabase/migrations/\`.`
    : `1. Provision a **${databaseLabel(m)}** PostgreSQL database and save its connection string for \`.env.local\`.
2. Wire Auth and file Storage yourself (Auth.js/Clerk + S3/R2, or use Supabase for those) — the golden path is Supabase for all of it.
3. Keep migrations in \`supabase/migrations/\` (plain SQL) and apply them with your preferred Postgres migration tool.`
}

## 4. Scaffold the application (first Claude Code session)

Open this folder in VS Code, run \`claude\`, and use the **Kickoff** prompt from \`prompts/PROMPT_LIBRARY.md\`. It instructs Claude to read this foundation and scaffold ${frameworkLabel(m)} per \`docs/architecture/TECH_STACK.md\` — as Milestone 0 of \`docs/ROADMAP.md\`, spec first.

## 5. Deploy early

Connect the repo to ${hostingLabel[m.hosting]}${m.hosting === "vercel" ? ` (framework preset: ${m.stack.framework === "nextjs" ? "Next.js" : "Vite"}) so every PR gets a preview URL from day one` : " and wire CI/CD for preview deploys (the generated workflow defaults to Vercel — adjust it)"}.

## Daily loop

\`git pull\` → pick top roadmap item → spec → Claude Code implements → review against spec → update \`context/PROGRESS.md\` → PR → merge.
`
  );
}

export function architectureDoc(m: ProjectModel): GeneratedFile {
  return authored(
    "docs/architecture/ARCHITECTURE.md",
    "docs/architecture",
    `
# ${m.name} — Architecture

## Shape

${
  isSpaFramework(m)
    ? `A ${productTypeLabel[m.productType]} built as a Vite + React SPA deployed on ${hostingLabel[m.hosting]}, talking directly to ${databaseLabel(m)} (PostgreSQL) through a typed data layer. Server-side needs are covered by ${usesSupabase(m) ? "Supabase Edge Functions" : "your own server functions"}.`
    : `A ${productTypeLabel[m.productType]} built as ${frameworkLabel(m)} on ${hostingLabel[m.hosting]}, with ${databaseLabel(m)} (PostgreSQL) as the backend. Server Components render by default; Server Actions handle mutations; client components exist only where interactivity demands.`
}

## Modules

Organize by feature, not by layer. Each feature owns its UI, data access, and types:

\`\`\`
src/features/<feature>/
  components/   UI for this feature
  ${isSpaFramework(m) ? "api.ts        typed Supabase calls" : "actions.ts    server actions (mutations)\n  queries.ts    data reads"}
  types.ts
\`\`\`

Planned features map 1:1 to modules: ${m.features.map((f) => `\`${f}\``).join(", ")}.

## Data & tenancy

${
  m.derived.multiTenant
    ? `Multi-tenant. Every domain table carries \`organization_id\`. RLS scopes all access through an \`is_org_member()\` helper. Roles (${m.roles}) enforced in policies for writes. Users get a personal organization at signup so the model is uniform.`
    : `User-scoped. Domain tables carry \`user_id\`; RLS restricts rows to their owner. If teams arrive later, introduce organizations behind the same RLS pattern — an additive migration.`
}

See \`docs/architecture/DATABASE.md\` for the starting schema.

${m.derived.needsAuth ? `## Identity & access\n\nSign-in methods: ${authSummary(m)}, via Supabase Auth. ${m.derived.multiTenant ? `Access is scoped through ${m.tenancy === "marketplace" ? "marketplace-side roles" : `organization membership (roles: ${m.roles})`}.` : "Rows are scoped to their owning user."}\n` : ""}
${m.integrations ? `## Integrations\n\nPlanned external systems: ${m.integrations}. Each lives behind a typed module with server-side secrets only — never called from the client.\n` : ""}
${m.derived.hasPayments ? `## Payments\n\nStripe ${m.audience === "b2c" ? "Checkout" : "Billing (subscriptions)"}. The webhook handler is the single source of truth for entitlement state — client callbacks are UX hints only. Store Stripe IDs on your own tables; never derive access from the client.\n` : ""}
${m.derived.hasAi ? `## AI features\n\n${m.aiUsage !== "none" ? `Approach: ${aiUsageLabel[m.aiUsage]}. ` : ""}All LLM calls server-side${isSpaFramework(m) ? " (Supabase Edge Functions)" : " (Server Actions / Route Handlers)"}. Prompts live in \`prompts/\` and are versioned like code. Outputs are Zod-validated before touching the database or UI. Log token usage per call from day one.\n` : ""}
${m.derived.hasRealtime ? `## Realtime\n\nSupabase Realtime channels, scoped per ${m.derived.multiTenant ? "organization" : "user"}. Subscribe narrowly (specific rows/topics), never table-wide from the client.\n` : ""}
## Cross-cutting rules

- Zod at every boundary; types inferred from schemas, never duplicated.
- Migrations are the only schema change path.
- Errors surface typed; user-facing failures always have designed states.
- ${m.scale === "validate" ? "Validation posture: prefer the simplest correct implementation; add caching/optimization only on measured need." : m.scale === "high_scale" ? "High-scale posture: paginate and index from day one; design for horizontal scale; load-test the critical path; cache deliberately." : "Growth posture: paginate every list from day one; index every foreign key; avoid N+1 with explicit joins."}
`
  );
}

export function techStack(m: ProjectModel): GeneratedFile {
  return authored(
    "docs/architecture/TECH_STACK.md",
    "docs/tech-stack",
    `
# Tech Stack

Decided in ADR-0001. Changes require a superseding ADR.

| Layer | Choice | Notes |
|-------|--------|-------|
| Framework | ${frameworkLabel(m)} | ${isSpaFramework(m) ? "SPA; Edge Functions for server needs" : "App Router, RSC-first"} |
| Language | TypeScript (strict) | \`any\` forbidden |
| Styling | Tailwind CSS | design tokens as CSS variables |
| Components | shadcn/ui | owned in-repo, themed |
| Database | ${databaseLabel(m)} | PostgreSQL + RLS${usesSupabase(m) ? `${m.derived.needsAuth ? ", Auth" : ""}${m.features.includes("storage") ? ", Storage" : ""}${m.derived.hasRealtime ? ", Realtime" : ""}` : " — bring your own Auth/Storage"} |
| Validation | Zod | every boundary |
${m.derived.hasPayments ? "| Payments | Stripe | webhooks = source of truth |\n" : ""}${m.derived.hasAi ? "| AI | Anthropic Claude API | server-side only, prompts versioned |\n" : ""}| Deployment | ${hostingLabel[m.hosting]} | ${m.hosting === "vercel" ? "preview per PR" : "adjust the generated deploy workflow (defaults to Vercel)"} |
| Repository | ${repoLabel(m)} | trunk-based, PRs |
| Editor / AI | VS Code + Claude Code | context system in \`context/\` |

## Version policy

Pin exact versions in package.json. Upgrade deliberately (dedicated PRs), never incidentally.
`
  );
}

export function databaseDoc(m: ProjectModel): GeneratedFile {
  const mt = m.derived.multiTenant;
  return authored(
    "docs/architecture/DATABASE.md",
    "docs/database",
    `
# Database Design — starting point

PostgreSQL on Supabase. Conventions: \`id uuid pk default gen_random_uuid()\`, \`created_at\`/\`updated_at\` timestamptz, snake_case, **RLS on every table**.

## Core schema v0

\`\`\`sql
-- profiles mirror auth.users
create table profiles (
  id uuid primary key references auth.users on delete cascade,
  display_name text,
  created_at timestamptz not null default now()
);
${
  mt
    ? `
create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table organization_members (
  organization_id uuid references organizations on delete cascade,
  user_id uuid references profiles on delete cascade,
  role text not null check (role in (${m.roles === "granular" ? "'owner','admin','member','viewer'" : "'owner','admin','member'"})),
  primary key (organization_id, user_id)
);`
    : ""
}
\`\`\`

Domain tables follow as features are specced — each spec's Architecture Notes must include its migration.

## RLS pattern

${
  mt
    ? `\`\`\`sql
create function is_org_member(org uuid) returns boolean
language sql security definer stable as $$
  select exists (
    select 1 from organization_members
    where organization_id = org and user_id = auth.uid()
  );
$$;

-- every domain table:
alter table <t> enable row level security;
create policy "<t>_member_read" on <t> for select using (is_org_member(organization_id));
create policy "<t>_member_write" on <t> for all using (is_org_member(organization_id));
\`\`\`

Write policies additionally check role where the spec requires it${m.roles === "granular" ? " (granular roles: keep a permission matrix in the relevant spec)" : ""}.`
    : `\`\`\`sql
alter table <t> enable row level security;
create policy "<t>_owner" on <t> for all using (user_id = auth.uid());
\`\`\``
}

**Every RLS policy gets a denial test** — assert that a non-member/non-owner receives zero rows.

## Rules

- Migrations only (\`supabase/migrations/\`) — never dashboard-edit production schema.
- Index every foreign key${m.scale !== "validate" ? "; paginate every list query" : ""}.
${m.features.includes("audit_logs") ? "- `audit_logs` table is append-only (no update/delete policies) recording actor, action, entity, timestamp." : ""}
${m.security === "elevated" ? "- Personal/sensitive fields: minimize collection, never log values, plan deletion/export paths from the first migration." : ""}
`
  );
}
