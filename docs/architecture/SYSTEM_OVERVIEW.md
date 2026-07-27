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

## Importing an existing project (specs 63, 68)
A founder with a codebase already in flight enters at `/app/projects/import` instead of
`/app/projects/new`. The archive is read server-side, then:

1. **Read** — `features/import/archive.ts` unzips the upload, refusing anything over 50 MB or 5,000
   files (checked before *and* during decompression) and any entry whose path escapes the tree.
   `node_modules`, `.git`, `dist` and `.next` are skipped without being decompressed.
2. **Analyse** — `analyzeImport` (in `packages/engine`, pure and LLM-free) derives what the manifests
   prove: framework, database, capabilities, hosting, repo provider, tenancy. Each derived answer
   carries the evidence behind it. Anything it cannot prove is left for the founder — never guessed.
3. **Prefill** — the derived answers seed the interview, which then runs exactly as it always does,
   into the same `generate(templateFiles, projectModel)`. There is no second generation path.
4. **Diff** — `diffAgainstExisting` sorts generated output into new / already-identical / conflicting.
   A conflict is only ever written when the founder picks it on `/app/projects/[id]/import`;
   an undecided conflict keeps their file.

5. **Show** — `buildFileTree` turns those paths into the structure view on the same screen. Shape
   only: names and sizes, never content.
6. **Deliver** — the download is assembled **in the browser**: `MergedDownload` overlays Airrow's
   files onto the founder's own archive, cached in IndexedDB at import time. The server sends only
   what `applyResolutions` deemed safe to write, so the overlay is correct by construction. If this
   browser no longer holds the archive, the founder is asked to pick it again rather than handed a
   silent additions-only ZIP.

**Only digests are stored.** `import_files` holds path, size and an **HMAC-SHA256** of each imported
file, keyed by a pepper that lives in the app environment and never in the database
(`IMPORT_DIGEST_PEPPERS`, versioned per import so it can be rotated). A raw hash of a short file — a
single `.env` line — is guessable; a keyed one is not. That is enough to diff, while the founder's
source never outlives the request that analysed it (§II) and never reaches Airrow's storage at all.
Importing from a repository, and delivering back as a pull request, wait on the GitHub App
integration; ZIP delivery covers the import flow end to end today.

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
