# Airrow — System Overview

A living, high-level map of the app. Detail lives in the code and in per-issue specs; this stays
short and current.

## Purpose
Airrow turns an adaptive CTO interview into a complete, production-grade **engineering foundation**
(architecture, specs, docs, roadmap, standards, prompt library, AI context) for a new software
project. Founders then build locally with VS Code + Claude Code. **Airrow prepares projects for
AI-assisted development — it never writes the application code itself.**

## Shape
pnpm workspaces monorepo (pnpm 9, Node ≥20):

| Package | Role |
|---------|------|
| `apps/web` | Next.js 15 App Router application (React 19, TypeScript strict, Tailwind v4, shadcn/ui) |
| `packages/engine` | Pure, headless generation engine — no app imports, no env access |
| `packages/schemas` | Shared Zod schemas & types (project model, interview) |

Backend platform: **Supabase** (Postgres + RLS, Auth, Storage, Realtime). Hosting: **Vercel**. Repo
delivery: **GitHub App**. Document authoring: **Claude API**. Airrow runs fully in **local mode** out
of the box (dev auth, file-backed store in `.data/`, deterministic authoring, ZIP delivery); Supabase
/ Claude / GitHub activate via `.env`.

## Data flow (one direction)
```
app/** routes (RSC by default)
  → client components
    → Server Actions / Route Handlers
      → feature queries.ts / actions.ts
        → apps/web/src/lib/data/store.ts  (DataStore: local files today, Supabase behind same API)
          → Postgres (+RLS) · Storage · Claude API · GitHub App
```
External calls happen **server-side only**. The engine is a pure
`generate(templateFiles, projectModel) → RepoTree + Manifest`; any LLM output is Zod-validated against
document contracts before acceptance, with feedback-retry on failure.

## Generation pipeline (`packages/engine`)
[`template/`](../../template/) is the **single source of generated output** — the canonical scaffold,
catalogued in `.airrow-template.json`. The app reads it from disk (the engine stays pure) and passes it
in: Resolve (interview answers → `ProjectModel`) → Render (`renderScaffold` substitutes every
`{{TOKEN}}` from the model; unanswered optionals become `[NEEDS CLARIFICATION]` markers, never invented
content) → Validate (required files present, no unresolved token) → Manifest (per-file source, template
id + version, bytes → Postgres). `renderScaffold` also returns a `ScaffoldPlan` for the founder to
approve before anything is written.

## Roles & tenancy
Supabase Auth (email magic link + GitHub OAuth). Every user gets a personal **organization** at
signup; all resources hang off `organization_id`, and RLS enforces tenancy on every table.

## External services & failure posture
| Service | Use | Failure posture |
|---|---|---|
| Claude API | Document authoring | Retry w/ backoff; job fails visibly, resumable per-document |
| GitHub App | Repo creation/push | ZIP always available as fallback |
| Supabase | Data/auth/storage/realtime | Platform dependency |
| Vercel | Hosting, background jobs | Platform dependency |

See [`SYSTEM_ARCHITECTURE.md`](SYSTEM_ARCHITECTURE.md) for the deeper diagram and the decisions behind
this shape.
