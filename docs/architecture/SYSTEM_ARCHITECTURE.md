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
apps/web            Next.js application
packages/engine     Generation engine (pure, headless)
packages/schemas    Shared Zod schemas & types (project model, interview)
packages/ui         Design system components (shadcn/ui based)
```

pnpm workspaces + Turborepo. The engine and schemas packages must never import from apps.

## The generation engine (core asset)

Pure function at heart: `generate(projectModel) → RepoTree + Manifest`.

Pipeline stages:

1. **Resolve** — project model → repository blueprint (folder tree, file list, static content, variables).
2. **Author** — for each AI-authored document: build a structured prompt from the project model + document contract, call Claude, validate output against the document contract (required sections present, links well-formed). Retry with feedback on validation failure.
3. **Assemble** — merge static + authored files, render cross-references, produce the final tree.
4. **Validate** — completeness check against the blueprint; no unresolved variables; internal links resolve.
5. **Manifest** — record per file: source (static/authored), template id + version, prompt version, model, inputs hash. Stored in Postgres; enables future regeneration, diffing, and repo sync (Phase 4).

Design rules: deterministic where possible, LLM only where personalization adds value (hybrid, per ADR-0002). Every LLM output passes schema validation before acceptance. Engine is fully testable offline via a mock authoring provider and snapshot fixtures.

## Generation jobs

Generation is async: a Server Action enqueues a `generation_jobs` row; a job runner (Vercel background function in v1; interface allows moving to a queue later) executes the engine, streams stage progress to the client via Supabase Realtime, and writes the artifact (repo tree) to Supabase Storage + manifest to Postgres.

## Delivery

- **ZIP:** artifact tree → zip stream from Storage.
- **GitHub:** GitHub App (not OAuth user token) creates the repo and pushes the tree via the Git Data API. Provider interface (`RepoProvider`) with a GitHub implementation now; Azure DevOps later (ADR-0004).

## Auth & tenancy

Supabase Auth (email magic link + GitHub OAuth). Every user gets a personal organization at signup; all resources hang off `organization_id` (see DATABASE_DESIGN.md). RLS enforces tenancy on every table.

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
