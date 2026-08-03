# System Architecture

## Overview

Airrow is a Next.js application on Vercel with Supabase as the backend platform, plus one deliberately isolated core: the **generation engine**, a pure TypeScript package with no app dependencies.

```
┌─────────────────────────────────────────────────────────┐
│  Vercel                                                 │
│  ┌───────────────────────────────────────────────────┐  │
│  │ Next.js App (App Router)                          │  │
│  │  · Marketing pages (static)                       │  │
│  │  · Dashboard, Interview, Preview (RSC + client)   │  │
│  │  · Server Actions / Route Handlers (API)          │  │
│  └───────────┬───────────────────────┬───────────────┘  │
│              │                       │                  │
│  ┌───────────▼───────────┐           │                  │
│  │ packages/engine       │           │                  │
│  │ pure TS, headless     │           │                  │
│  │ interview → repo tree │           │                  │
│  └───────────┬───────────┘           │                  │
└──────────────┼───────────────────────┼──────────────────┘
               │ Claude API            │
┌──────────────▼───────────────────────▼──────────────────┐
│  Supabase                                               │
│  Postgres (+RLS) · Auth · Storage (artifacts) · Realtime│
└─────────────────────────────────────────────────────────┘
               │
        GitHub App (repo creation + push)
```

## Monorepo layout

```
apps/web            Next.js application (design system in src/components/ui, shadcn/ui based)
packages/engine     Generation engine (pure, headless)
packages/schemas    Shared Zod schemas & types (project model, interview)
```

pnpm workspaces. The engine and schemas packages must never import from apps.

## The generation engine (core asset)

Pure function at heart: `generate(templateFiles, projectModel) → RepoTree + Manifest`. The generated repository has exactly one source: the canonical scaffold in [`template/`](../../template/), catalogued by `.airrow-template.json` (fixed-workflow vs. tailored paths, and every `{{TOKEN}}`). The app reads those files from disk and passes them in, so the engine keeps its no-I/O purity.

Pipeline stages:

1. **Resolve** — interview answers → `ProjectModel` (validated, with derived flags).
2. **Render** — `renderScaffold` derives a value per `{{TOKEN}}` from the model and substitutes it in every template file. An answer the founder skipped renders `[NEEDS CLARIFICATION: TOKEN]`; nothing is invented to fill a gap.
3. **Validate** — required files present, no unresolved token, no duplicate or empty file.
4. **Manifest** — record per file: source, template id + version, bytes. Stored in Postgres; enables future regeneration, diffing, and repo sync (Phase 4).

`renderScaffold` also returns a `ScaffoldPlan` — file tree, the derived decisions with their provenance, and the outstanding clarifications — which the founder approves before anything is written or provisioned (constitution §0).

Design rules: deterministic where possible, LLM only where personalization adds value. Every LLM output passes schema validation before acceptance. The engine is fully testable offline — the renderer is pure, so fixtures cover the product-type × capability matrix without a network call.

## Generation jobs

Generation is async: a Server Action enqueues a `generation_jobs` row; a job runner (Vercel background function in v1; interface allows moving to a queue later) executes the engine, streams stage progress to the client via Supabase Realtime, and writes the artifact (repo tree) to Supabase Storage + manifest to Postgres.

## Delivery

- **ZIP:** artifact tree → zip stream from Storage.
- **GitHub:** GitHub App (not OAuth user token) creates the repo and pushes the tree via the Git Data API. Provider interface (`RepoProvider`) with a GitHub implementation now; Azure DevOps later.

## Auth & tenancy

Supabase Auth (email + password, GitHub OAuth, Google OAuth). Every user gets a personal organization at signup; all resources hang off `organization_id` (see DATABASE_DESIGN.md). RLS enforces tenancy on every table.

This line previously read "email magic link + GitHub OAuth". Magic link was never built — it was a designed-but-inert button (spec 19) that spec 140 removed rather than leave promising a flow nobody intended to ship.

## External services

| Service | Use | Failure posture |
|---|---|---|
| Claude API | Document authoring | Retry w/ backoff; job fails visibly, resumable per-document |
| GitHub App | Repo creation/push | ZIP always available as fallback |
| Supabase | Data/auth/storage/realtime | Platform dependency |
| Vercel | Hosting, jobs | Platform dependency |

## Cross-cutting

- **Validation:** Zod at every boundary (forms, actions, engine I/O, LLM output).
- **Errors:** typed error results in the engine; Sentry in the app.
- **Observability:** generation stage timings + token usage recorded per job.
- **Secrets:** Vercel/Supabase env vars only. Anthropic key is server-side only, never in engine package code.
