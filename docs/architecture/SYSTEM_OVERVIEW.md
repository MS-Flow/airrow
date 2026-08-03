# Airrow — System Overview

A living, high-level map of the app. Detail lives in the code and in per-issue specs; this stays
short and current.

## Purpose
Airrow turns an adaptive CTO interview into a complete, production-grade **engineering foundation**
(architecture, specs, docs, roadmap, standards, prompt library, AI context) for a new software
project. Founders then build locally with VS Code + Claude Code. **Airrow prepares projects for
AI-assisted development — it never writes the application code itself.** The `/start` command it
ships *inside* a generated repo is the deliberate exception (spec 66): the founder runs it there, and
it takes that repo to the bare minimum that runs. A foundation generated for an **imported** project
ships `/cleanup` instead (spec 91) — it reads the code that is already there and rewrites the
documents to match it, and changes no code at all. Exactly one of the two, decided by the project's
origin. Airrow's own servers still generate documents only.

## Shape
pnpm workspaces monorepo (pnpm 9, Node ≥20):

| Package | Role |
|---------|------|
| `apps/web` | Next.js 15 App Router application (React 19, TypeScript strict, Tailwind v4, shadcn/ui) |
| `packages/engine` | Pure, headless generation engine — no app imports, no env access |
| `packages/schemas` | Shared Zod schemas & types (project model, interview) |

Backend platform: **Supabase** (Postgres + RLS, Auth, Storage, Realtime). Hosting: **Vercel**. Repo
delivery: **GitHub App**. Document authoring: **Claude API**. Billing: **Stripe** (spec 99).

**Supabase is required; every other integration is optional.** Without a Claude key, authoring is
deterministic and the founder still gets a complete foundation and a ZIP. Without GitHub App
credentials, ZIP delivery covers delivery. Without Stripe keys, the app runs and Pro shows as
unavailable rather than throwing. (The file-backed store in `.data/` that this paragraph used to
describe is gone — the DataStore has been Supabase-only since spec 14, and `lib/data/` holds nothing
else.)

## Data flow (one direction)
```
app/** routes (RSC by default)
  → client components
    → Server Actions / Route Handlers
      → feature queries.ts / actions.ts
        → apps/web/src/lib/data/store.ts  (DataStore: the one path to Supabase)
          → Postgres (+RLS) · Storage · Claude API · GitHub App · Stripe
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

## Importing an existing project (specs 63, 68, 67)
A founder with a codebase already in flight enters at `/app/projects/import` instead of
`/app/projects/new`. Two sources, one import: an uploaded ZIP, or a **public GitHub repository**
picked from a list (spec 67). Both are read server-side, then:

1. **Read** — `features/import/archive.ts` unzips the upload, refusing anything over 50 MB or 5,000
   files (checked before *and* during decompression) and any entry whose path escapes the tree.
   `node_modules`, `.git`, `dist` and `.next` are skipped without being decompressed. A repository
   takes the same path: `lib/github.ts` fetches the default branch's zipball with the founder's
   **scope-less** GitHub identity and `features/import/repo.ts` hands it to that same reader, so
   there is one implementation of the limits and one of the analysis, not two kept in step.
2. **Analyse** — `analyzeImport` (in `packages/engine`, pure and LLM-free) derives what the manifests
   prove: framework, database, capabilities, hosting, repo provider, tenancy. Each derived answer
   carries the evidence behind it. Anything it cannot prove is left for the founder — never guessed.
3. **Prefill** — the derived answers seed the interview, which then runs exactly as it always does,
   into the same `generate(templateFiles, projectModel)`. There is no second generation path.
4. **Diff** — `diffAgainstExisting` sorts generated output into new / already-identical / conflicting.
   A conflict is only ever written when the founder picks it on `/app/projects/[id]/import`;
   an undecided conflict keeps their file.

5. **Show** — `mergePreviewFiles` + `buildPreviewTree` put those paths in the *preview* tree next to
   Airrow's own files, each row tagged with where it comes from. Shape only: the founder's files are
   listed by name, never opened, because their content was never stored.
6. **Deliver** — `DownloadProject` picks between two downloads, on whether a merge is *possible and
   wanted* rather than on whether the project was imported (spec 188). Only an uploaded **ZIP** meets
   that bar: Airrow holds the sole copy of those files, so `MergedDownload` overlays Airrow's output
   onto the founder's own archive **in the browser**, cached in IndexedDB at import time. The server
   sends only what `applyResolutions` deemed safe to write, so the overlay is correct by
   construction. If this browser no longer holds the archive the founder is asked to pick it again —
   with a secondary "Foundation only" link, so a second machine is never a dead end.

   A **repository** import gets the foundation on its own, from the plain ZIP route: their code is in
   a repository they control and already have checked out, and nothing ever cached an archive for it,
   because the files were read server-side. Routing it to the merge is what made that button
   permanently demand an archive that never existed. Wherever the download is the foundation alone
   the button says **"Download foundation"**, so it is never mistaken for the whole project.

**Only digests are stored.** `import_files` holds path, size and an **HMAC-SHA256** of each imported
file, keyed by a pepper that lives in the app environment and never in the database
(`IMPORT_DIGEST_PEPPERS`, versioned per import so it can be rotated). A raw hash of a short file — a
single `.env` line — is guessable; a keyed one is not. That is enough to diff, while the founder's
source never outlives the request that analysed it (§II) and never reaches Airrow's storage at all.
The same holds for a repository: the zipball dies with the request that read it. **Private
repositories** and **delivering back as a pull request** still wait on the GitHub App integration —
both need permissions a scope-less identity does not have. ZIP covers the import flow end to end,
and is the only way in for a private project.

## Roles & tenancy
Supabase Auth: email + password, **GitHub OAuth with no scopes** (spec 67), and **Google** (spec 140) —
identities that reach nothing an anonymous visitor could not already fetch. An address the provider
itself has not verified is refused at `/auth/callback`, since linking on an unproven address would hand
somebody else's account away; a verified one links to the account that already holds it, so the same
workspace meets the founder whichever way they came in. Every user gets a personal **organization** at
signup; all resources hang off `organization_id`, and RLS enforces tenancy on every table.

New passwords must carry an uppercase, a lowercase and a number on top of the eight-character floor
(spec 140), enforced by `signupSchema`; a special character is deliberately **not** required, because
that rule produces `Passw0rd!` more reliably than it produces strong passwords. Guessability is judged
instead by a zxcvbn score gate on the signup form. `loginSchema` deliberately keeps the older, looser
rule so accounts created before it still sign in.

## External services & failure posture
| Service | Use | Failure posture |
|---|---|---|
| Claude API | Document authoring | Retry w/ backoff; job fails visibly, resumable per-document. No key: deterministic authoring, still a complete foundation |
| GitHub App | Repo creation/push | ZIP always available as fallback |
| Stripe | Pro subscriptions (spec 99) | No keys: Pro shows as unavailable, nothing throws. Webhook failures release the event so Stripe's retry can finish the job |
| Supabase | Data/auth/storage/realtime | Platform dependency |
| Vercel | Hosting, background jobs | Platform dependency |

## Plans and billing (specs 74, 99, 100)
An organization carries a `plan` (`free` | `pro`). Free is **one** foundation plus two free
regenerations within 24 hours of its first run; Pro is unlimited and adds importing an existing
project. An unchanged regeneration makes no Claude call and is never charged.

`checkAllowance` (`features/generation/allowance.ts`) is the single place that answers "may this
organization generate?", and it reads the plan server-side from Postgres on every attempt.
**`organizations.plan` changes only on something Stripe told us**, through `applySubscriptionState`
and nothing else: the **webhook**, which is the primary path and the only one that runs when nobody is
at a screen (renewals, failed payments, cancellations), and **`features/billing/sync.ts`**, which asks
Stripe's API directly when a founder returns from Checkout or presses "check again". Checkout
returning proves the browser reached a URL, not that money moved — that has not changed, and the sync
is not the redirect: it re-reads the subscription server-side with our own key. Spec 100 added it
because every other route to the plan ran through webhook delivery, so one missing listener or one
unmigrated database left a paying founder on free with no way out. Because the plan is an entitlement
sitting on a row members may otherwise edit, it is protected by column-level privilege rather than
RLS; see [`DATABASE_DESIGN.md`](DATABASE_DESIGN.md).

See [`SYSTEM_ARCHITECTURE.md`](SYSTEM_ARCHITECTURE.md) for the deeper diagram and the decisions behind
this shape.
