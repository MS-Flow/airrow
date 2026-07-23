// Standards, workflow, templates, prompts, checklist, ADR-0001.
// Standards are mostly stable best practice (static-ish) with model-specific inserts.

import type { GeneratedFile, ProjectModel } from "../../../schemas/src/types.ts";
import { frameworkLabel, repoLabel, teamLabel } from "../model.ts";

const doc = (
  path: string,
  templateId: string,
  source: "static" | "authored",
  content: string
): GeneratedFile => ({ path, templateId, source, content: content.trimStart() });

export function standards(m: ProjectModel): GeneratedFile[] {
  const coding = doc(
    "docs/standards/CODING_STANDARDS.md",
    "standards/coding",
    "authored",
    `
# Coding Standards

## TypeScript

- \`strict: true\`; \`any\` forbidden — use \`unknown\` + narrowing. \`as\` casts need a justifying comment.
- Types inferred from Zod schemas (\`z.infer\`) wherever data crosses a boundary; never duplicate shapes.
- Discriminated unions over meaning-laden booleans.

## Structure

- Feature modules own their UI, data access, and types (see \`docs/architecture/ARCHITECTURE.md\`).
- ${m.stack.framework === "nextjs" ? "Routes stay thin — composition only. Logic lives in features. Server Components by default; `\"use client\"` requires a reason. No `useEffect` data fetching." : "Components stay thin; business logic in plain typed modules. Data access only through each feature's `api.ts`."}
- All database access through the feature's typed data layer. No queries in components.

## Style

- Prettier + ESLint enforced in CI — zero style debate in review.
- Intention-revealing names, no abbreviations. Comments explain *why*.
- Small single-purpose functions. Dead code is deleted, not commented out.

## AI-assisted work

- AI-generated code meets the same bar and is reviewed against the spec like any code.
- When code and spec disagree: stop, fix the spec first (\`context/CONSTRAINTS.md\` rule 2).
`
  );

  const testing = doc(
    "docs/standards/TESTING_STANDARDS.md",
    "standards/testing",
    "authored",
    `
# Testing Standards

Test what breaks the product: business logic, data integrity, the critical user path. Coverage is a byproduct, not a target.

| Layer | Tool | Required for |
|-------|------|--------------|
| Unit | Vitest | business logic, validation, utilities |
| Integration | Vitest + Supabase local | data layer, **every RLS policy (access + denial)** |
| E2E | Playwright | the critical path: ${m.mvpFocus ? `"${m.mvpFocus}"` : "the core MVP workflow"} |

## Rules

- Each spec's Testing section defines what's tested; the feature checklist enforces it.
- Bug fixes ship with a regression test that failed before the fix.
- Failing or skipped tests never merge.
- Test names read as behavior: \`denies access to non-members\`, not \`test rls 3\`.
${m.derived.hasPayments ? "- Stripe webhook handlers get integration tests with recorded events — entitlement bugs are revenue bugs." : ""}
${m.derived.hasAi ? "- LLM-dependent behavior: test the validation/contract layer deterministically; live-model checks run nightly, never in PR CI." : ""}
`
  );

  const security = doc(
    "docs/standards/SECURITY_STANDARDS.md",
    "standards/security",
    "authored",
    `
# Security Standards

${m.security === "elevated" ? "**This project handles sensitive data. Security work is feature work.** Every spec's Security section is reviewed before implementation, no exceptions.\n" : "Least privilege, defense in depth, secure defaults. Every spec has a Security section.\n"}
## Non-negotiables

1. RLS on every table${m.derived.multiTenant ? ", scoped through organization membership" : ", scoped to the owning user"} — with denial tests.
2. Zod validation at every boundary: forms, ${m.stack.framework === "nextjs" ? "server actions, route handlers" : "Edge Functions"}, webhooks${m.derived.hasAi ? ", LLM outputs" : ""}.
3. Secrets only in environment variables (Vercel/Supabase). Never in code, bundles, or logs.
4. Authorization is server-side; never trust client-supplied IDs without RLS + explicit checks.
5. Dependencies: lockfile committed; automated advisories enabled; high severity blocks release.
${m.derived.hasPayments ? "6. Payment state only via verified Stripe webhook signatures. Client success callbacks are UX, not truth." : ""}
${m.security === "elevated" ? `${m.derived.hasPayments ? "7" : "6"}. Data minimization: collect only what the MVP needs; no personal data in logs; deletion + export paths ship with the first data-bearing feature.` : ""}

## Review cadence

Security checklist runs at every milestone boundary (see \`checklists/FEATURE_CHECKLIST.md\` for per-feature items).
`
  );

  const git = doc(
    "docs/standards/GIT_STANDARDS.md",
    "standards/git",
    "authored",
    `
# Git Standards — ${repoLabel(m)}

## Branching

Trunk-based. \`main\` is always deployable and protected (PR + green CI). Feature branches: \`feat/<slug>\`, \`fix/<slug>\` — days, not weeks.

## Commits

Conventional Commits (\`feat:\`, \`fix:\`, \`docs:\`, \`chore:\`, \`refactor:\`, \`test:\`). Atomic and buildable. Reference the spec in the body.

## Pull Requests

- Use \`templates/PR_TEMPLATE.md\`; every feature PR references its spec.
- Small PRs — one feature or coherent slice.
- Docs + \`context/PROGRESS.md\` updates ship **in the same PR** as the change.
- ${m.team === "solo" ? "Solo: still open PRs — the discipline creates review points for you and your AI assistant, and preview deploys per change." : "At least one human review; review against the spec, not taste."}
- Squash-merge with a clean conventional title.
`
  );

  const documentation = doc(
    "docs/standards/DOCUMENTATION_STANDARDS.md",
    "standards/documentation",
    "static",
    `
# Documentation Standards

Four layers, one job each:

1. **Specs** (\`specs/\`) — source of truth for features. Written before code.
2. **Docs** (\`docs/\`) — explain product, architecture, standards. Curated.
3. **ADRs** (\`adr/\`) — immutable decision records. Append-only.
4. **Context** (\`context/\`, \`CLAUDE.md\`) — short, current, pointer-rich state for AI and humans. Updated with every state-changing PR.

## Rules

- Single source of truth: facts live in one file; everything else links.
- Update-with-change: doc updates ship in the same PR as the code.
- Written for a cold reader (human or AI) with zero conversation history.
- Short beats complete. Stale documentation is a bug, fixed immediately, not backlogged.
`
  );

  return [coding, testing, security, git, documentation];
}

export function workflow(m: ProjectModel): GeneratedFile {
  return doc(
    "docs/workflows/FEATURE_WORKFLOW.md",
    "workflows/feature",
    "authored",
    `
# Feature Workflow

The loop ${teamLabel[m.team]} repeats for every feature. It is the same loop your AI assistant is instructed to follow in \`CLAUDE.md\`.

\`\`\`
read context → spec → implement → review vs spec → document → merge
\`\`\`

## 1. Read

\`context/PROGRESS.md\` for state; \`docs/ROADMAP.md\` for the next feature. Never pick features out of order without updating the roadmap first.

## 2. Specify

Draft from \`templates/SPEC_TEMPLATE.md\` into \`specs/\`. Claude can draft it — you make the decisions. A spec with an empty Security or Edge Cases section is not done.

## 3. Implement

One branch. Point Claude Code at the spec (prompts in \`prompts/PROMPT_LIBRARY.md\`). If reality disagrees with the spec, stop and fix the spec first.

## 4. Review

Review the diff against the spec, requirement by requirement. Run tests. ${m.team === "solo" ? "Use the Review prompt — making Claude review against the spec catches what tired eyes miss." : "Reviewer verdict is 'meets spec' or a fix list — not stylistic taste."}

## 5. Document & merge

Update the spec's status + Implementation Notes, \`context/PROGRESS.md\`, and any affected docs — same PR. Squash-merge. Repeat.

**Checklist form:** \`checklists/FEATURE_CHECKLIST.md\`.
`
  );
}

export function checklist(): GeneratedFile {
  return doc(
    "checklists/FEATURE_CHECKLIST.md",
    "checklists/feature",
    "static",
    `
# Feature Checklist

## Before

- [ ] Read \`context/PROGRESS.md\` + the roadmap
- [ ] Spec complete in \`specs/\` (every section filled or justified N/A)
- [ ] New decisions recorded as ADRs

## During

- [ ] Branch per feature; conventional commits
- [ ] Spec updated first on any divergence
- [ ] Tests written per the spec's Testing section

## Before merge

- [ ] All acceptance criteria demonstrably pass
- [ ] Security section implemented (RLS + denial tests where data changed)
- [ ] Docs + \`context/PROGRESS.md\` updated in this PR
- [ ] Reviewed against the spec

## After

- [ ] Deployed preview verified
- [ ] Follow-ups filed to the roadmap's Later section
`
  );
}

export function templates(): GeneratedFile[] {
  const spec = doc(
    "templates/SPEC_TEMPLATE.md",
    "templates/spec",
    "static",
    `
# Spec: <Feature Name>

> Milestone: <M#> · Priority: <P#> · Owner: <name>

## Problem

## Business Goal

## User Story

As a <role>, I want <capability>, so that <outcome>.

## Functional Requirements

- FR-1:

## Non-Functional Requirements

- NFR-1:

## Acceptance Criteria

- [ ] AC-1: Given <context>, when <action>, then <result>.

## Architecture Notes

<Modules touched, migration SQL, interfaces. Link ADRs.>

## UX Notes

<States: loading, empty, error. One primary action.>

## Dependencies

## Risks

## Edge Cases

## Security

<Authz, validation, RLS impact. Never blank.>

## Testing

## Definition of Done

- [ ] All AC pass · tests green · security done · docs + context updated · reviewed vs spec

## Implementation Notes

## Review Notes

## Completion Status

Status: Draft | Ready | In Progress | In Review | Done
`
  );

  const adrT = doc(
    "templates/ADR_TEMPLATE.md",
    "templates/adr",
    "static",
    `
# ADR-XXXX: <Decision>

> Status: Proposed | Accepted | Superseded · Date: YYYY-MM-DD

## Context

## Options Considered

1. **<A>** — pros / cons
2. **<B>** — pros / cons

## Decision

## Consequences
`
  );

  const pr = doc(
    "templates/PR_TEMPLATE.md",
    "templates/pr",
    "static",
    `
## Spec

Implements: \`specs/<path>\`

## What changed

## Checklist

- [ ] Spec up to date (divergences in Implementation Notes)
- [ ] Acceptance criteria pass
- [ ] Tests green
- [ ] Security section addressed
- [ ] Docs + \`context/PROGRESS.md\` updated
`
  );

  return [spec, adrT, pr];
}

export function adr0001(m: ProjectModel): GeneratedFile {
  return doc(
    "adr/0001-stack.md",
    "adr/0001",
    "authored",
    `
# ADR-0001: Technology stack

> Status: Accepted · Date: ${new Date().toISOString().slice(0, 10)}

## Context

${m.name} is a ${m.productType === "saas" ? "SaaS product" : "product"} built by ${teamLabel[m.team]}, developed primarily with AI assistance (Claude Code). The stack must maximize AI-assistant fluency, minimize operations, and ship the MVP promise fast: "${m.mvpFocus}".

## Decision

- **${frameworkLabel(m)}** + TypeScript strict + Tailwind + shadcn/ui
- **Supabase** (PostgreSQL + RLS${m.derived.needsAuth ? ", Auth" : ""}${m.features.includes("storage") ? ", Storage" : ""}${m.derived.hasRealtime ? ", Realtime" : ""}) — managed backend, tenancy enforced in the database
- **Vercel** deployment (preview per PR) · **${repoLabel(m)}** for code
${m.derived.hasPayments ? "- **Stripe** for payments — webhooks as entitlement source of truth" : ""}
${m.derived.hasAi ? "- **Anthropic Claude API** for AI features — server-side, prompts versioned in-repo" : ""}

## Why

These are the tools AI assistants know best, with the largest high-quality training corpus and strongest conventions — which directly improves generated-code quality. Managed platforms remove ops burden from ${teamLabel[m.team]}.

## Consequences

Platform lock-in accepted knowingly (plain Postgres + standard React keep exit costs sane). All future stack changes require a superseding ADR.
`
  );
}

export function promptLibrary(m: ProjectModel): GeneratedFile {
  return doc(
    "prompts/PROMPT_LIBRARY.md",
    "prompts/library",
    "authored",
    `
# Prompt Library — ${m.name}

Proven prompts for Claude Code sessions in this repo. Refine them as you learn; they're code.

## Kickoff (first session, Milestone 0)

> Read CLAUDE.md, context/, docs/ROADMAP.md and docs/architecture/TECH_STACK.md. Then scaffold the application for Milestone 0: ${frameworkLabel(m)} with TypeScript strict, Tailwind with dark-first design tokens, shadcn/ui setup, Supabase client wiring, and CI to Vercel. Write the Milestone 0 spec first from templates/SPEC_TEMPLATE.md, show it to me for approval, then implement.

## Session start (every session)

> Read CLAUDE.md and context/PROGRESS.md. Summarize where we are and the single next action per docs/ROADMAP.md. Don't start until I confirm.

## Write a spec

> We're starting <feature> from docs/ROADMAP.md. Read the relevant architecture docs and any neighboring specs, then draft specs/<milestone>/<feature>.md from templates/SPEC_TEMPLATE.md. Fill every section — flag open product decisions for me instead of guessing.

## Implement against a spec

> Implement specs/<path> exactly. Follow docs/standards/CODING_STANDARDS.md and context/CONSTRAINTS.md. Include the migration${m.derived.multiTenant ? " with RLS policies scoped through organization membership" : " with owner-scoped RLS"} and tests per the spec's Testing section. If the spec is wrong, stop and tell me first.

## Review against a spec

> Review the current diff against specs/<path>, requirement by requirement: each FR and AC — met, and where? Security section — implemented? Tests — cover the Testing section? Verdict: mergeable, or a numbered fix list.

## Close out a feature

> <feature> is merged. Update the spec's status and Implementation Notes, context/PROGRESS.md, and any docs now stale. List every file you changed.

## When something feels off

> Stop. Re-read context/CONSTRAINTS.md and the current spec. List anything in the current implementation that violates either, then propose the smallest correction.
`
  );
}
