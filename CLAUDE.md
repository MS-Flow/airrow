# CLAUDE.md

This file provides guidance to Claude Code when working with code in the airrow repository.

## Communication style
Be concise but clear. Short responses save tokens — avoid restating what was asked, keep summaries
at the bare minimum, and omit filler. One clear sentence beats a paragraph.

## Clean code
Always write clean code. Avoid duplication — if the same expression appears twice, restructure to
eliminate it. Prefer clarity over cleverness: a reader should understand intent from the code itself.

## Read first (in order)
1. **`.claude/spec-kit/constitution.md`** — the single source of truth for all rules. When any file
   disagrees with it, the constitution wins.
2. The spec for your issue in `/specs` (`specs/NNN-kort.md`).
3. `docs/architecture/SYSTEM_OVERVIEW.md` and `docs/guides/DEVELOPER_GUIDE.md` — how the app is built.
4. Product context as needed: `docs/VISION.md`.

## Before implementing anything
1. Read the relevant spec file in `/specs` before writing code.
2. If no spec exists for the task, say so and ask before proceeding — or run `/createspec`.
3. Follow the patterns in `docs/architecture/SYSTEM_OVERVIEW.md` and `docs/guides/DEVELOPER_GUIDE.md`.

The spec lifecycle is automated via slash commands (`/createspec → /clarify → /implement → /analyze`,
plus `/pr-check` before a PR) governed by `.claude/spec-kit/constitution.md`. See `specs/README.md`.
`/security` sits outside that loop: it reviews the whole repository for vulnerabilities, fixes only
what changes nothing a user can see, asks before anything else, and writes `SECURITY_AUDIT.md` —
gitignored, because it lists the holes that are still open (spec 157).

## After implementing anything
Update the corresponding spec in `/specs` to reflect what was actually built — check off acceptance
criteria, note any deviations.

## Branching & workflow
We work via GitHub: a **feature** is a GitHub Project, **issues** are linked to it. Branch hierarchy:
`main` ← `develop` ← `feature/<name>` ← `<nr>-kort` (issue branch, no `issue/` prefix). PR direction
is strict and never skipped: `<nr>-kort` → its `feature/<name>` → `develop` → `main`. **Never** PR an
issue branch to `main`/`develop`. Full detail in `docs/architecture/BRANCHING.md`.

## Commands
pnpm workspaces monorepo (pnpm 9, Node ≥20). Run from the repo root:
- `pnpm dev`              # start the Next.js dev server (apps/web on http://localhost:3000)
- `pnpm build`           # production build
- `pnpm -r typecheck`    # TypeScript strict check across all packages (tsc --noEmit)
- `pnpm -r lint`         # ESLint across all packages
- `pnpm -r test`         # run all tests (Vitest)
- `pnpm test:scripts`    # tests for the CI helpers in scripts/ (outside the workspace)
- `pnpm --filter web test <file>`   # run a single test file
- `pnpm engine:smoke`    # headless generation-engine smoke test (no install needed)

## Architecture
Layered, and data flows in one direction:

`app/**` routes (RSC by default) → client components → **Server Actions / Route Handlers** →
feature `queries.ts` / `actions.ts` → `apps/web/src/lib/data/store.ts` (the DataStore) → Supabase.
The **generation engine** (`packages/engine`) is a pure, headless
`generate(templateFiles, projectModel) → RepoTree + Manifest` — no app imports, no env access. All
generated output comes from the canonical scaffold in `template/`; the app reads it from disk and
passes it in.

- External calls happen **only server-side**: the Claude API from exactly two places — the engine's
  authoring provider (`features/generation/author.ts`) and the public chat — Archer —
  (`features/chat/provider.ts`, specs 141 and 158), each with its own key so the public chat can never
  spend generation's budget; Supabase / GitHub App / Stripe via the DataStore and server actions —
  plus one **read** that is neither, and deliberately: `features/billing/prices.ts` asks Stripe what
  Pro costs so the landing card can name a figure, cached an hour so a public page cannot become one
  API call per visitor (spec 179). It is called straight from the landing RSC, writes nothing, and is
  still server-side. Never from client components; never from `packages/engine` or `packages/schemas`
  directly.
- **Analytics runs on both sides, and is write-only on both.** Not a new exception to §I: spec 153
  already beacons to Vercel from a client component, because §I's rule is about the calls carrying our
  data and our credentials — Claude, Supabase, the GitHub App. This carries neither, and can read
  nothing. `features/analytics/` sends product events to PostHog from both sides: `server.ts` (the only
  importer of `posthog-node`) carries `signup`, `foundation_generated`, `zip_downloaded`,
  `checkout_started` and `paid`, so a content blocker cannot delete the bottom of the funnel;
  `client.tsx` carries `pageview` and the interview steps, and **imports `posthog-js` dynamically after
  the key check** — 228 kB that a deployment measuring nothing must not download. The complete list of
  what may leave the process is `events.ts` — enforced at runtime by `sanitize`, not by convention. The browser
  side runs `persistence: "memory"`: **no cookie, no device storage, and therefore still no consent
  banner** (spec 153's promise, kept by spec 182). Changing that one option makes the cookie policy
  false and a banner mandatory.
- **Archer** is mounted from the two layouts — `app/(public)/layout.tsx` and `app/app/layout.tsx` — and
  therefore renders on every public page *and* every `/app` screen (spec 159, which lifted spec 158's
  deliberate `/app` exclusion). Pages never import `ChatWidget` themselves. When it cannot answer, or
  someone asks for a person, it points at `/app/support` and says the sign-in step first (spec 158).
- Pure logic lives in `packages/engine` and `packages/schemas`; they must never import from `apps/*`
  and never read `process.env`.
- **Autogenerated — do not hand-edit:** `pnpm-lock.yaml`, `.next/`, generated repo artifacts under
  `.data/`, and any Supabase-generated types.

## Key conventions
- **TypeScript strict; `any` is forbidden.** Zod validates every boundary — forms, actions, engine
  I/O, and **all LLM output** (validated against document contracts before acceptance).
- **Server Components by default;** data access only through feature `queries.ts` / `actions.ts`.
- **Multi-tenancy:** every resource hangs off `organization_id`. Every table has RLS **with denial
  tests** — no exceptions, including "internal" tables.
- **Security:** secrets never in code, client bundles, logs, or generated output. Generated/authored
  files are untrusted text — rendered sanitized, never executed. Repo access via GitHub App
  installations for private content and every write; reading public content may use the signed-in
  user's scope-less OAuth identity. Never user PATs, and no repo credential is persisted.
- **Product:** Airrow generates engineering *foundations* — never application code from our servers.
  The one exception is the `/start` command shipped **inside** a generated repo: the founder runs it
  on their own machine, where it installs the tools that machine lacks (git, the stack's runtime, the
  repo host's CLI — signing in to none of them) and builds the product's core action (`mvpFocus`) for
  real, to the design in `UI_ARCHITECTURE.md` — that is the ceiling, not a second feature, and
  everything past it goes
  through the spec loop (spec 66, amended by spec 123). `/start` rewrites `START_HERE.md`'s step 1 and
  then **removes itself**, once its own verification bar has passed — in that order; a failed or
  partial run leaves both untouched (spec 159). An **imported** project gets a pair in its place,
  split along observing versus mutating (spec 214, amending spec 91's single `/cleanup`): **`/sync`**
  reads the existing codebase into `.claude/project-map.md` and rewrites the foundation's documents
  from it — no code, no deletions, no branches, and it never removes itself, because documents drift
  forever. **`/cleanup`** is the only command that reorganises the founder's own files: `git mv` toward
  *the project's own ecosystem's* conventions, references updated in the same pass, unused files
  proposed per category and deleted only on a yes, and the workflow's local branches created. It never
  changes behaviour, **stages everything and commits nothing**, resumes from its own
  `.claude/cleanup-plan.json`, and removes itself once its verification bar passes. It also **reports
  what it may not touch** (spec 217): what the build is tied to and what leaving would cost, what
  phones home and whether it is live, which of the project's names disagree, and what arrived through
  the vendor that is good on merit and **stays** — security middleware first, judged on what a file
  does and never on what its name says. Removing any of that changes behaviour, so it hands off a
  paste-ready `/createspec` line and the capability it would cost instead. **Whether `/cleanup` ships
  is the founder's own answer**, asked outright of an integrated import with restructuring
  recommended; declining ships `/sync` alone, with every document still written. A foundation ships
  exactly one of these sets, decided by the project's origin and that answer. ZIP delivery must always work with no
  integration connected.
- **An import lands integrated or hidden, and the founder picks (spec 187).** Integrated is the
  original shape. **Hidden** nests the entire foundation under one folder the founder names —
  validated as a single path segment, **stored** on `import_sources`, never re-derived — and
  `/sync` has git ignore it via `.git/info/exclude`, so the shared repository's diff stays empty;
  the committed `.gitignore` line is offered, never written without a yes. The nesting happens **once,
  in `generate()`**, so what is stored is what is delivered and nothing downstream knows the mode
  exists: nothing collides, so there are no conflicts and no `.airrow.md` sidecars. Hidden ships **no
  CI** (a workflow in an ignored folder can never run) and **no `/cleanup` at all** (spec 214) —
  reorganising a repository the team shares is the change this layout exists to never make. Its
  `/sync` is narrowed to the folder: it builds no branch model, rewrites none of the team's documents,
  and reports nothing for deletion.
  **A hidden foundation is invisible to the assistant too, until `/sync` links it out (spec 215).**
  Commands are discovered from where a session starts and from its parents, never from a folder
  below, so at the repository root the foundation does not exist. `/sync` may create three entries
  outside the folder and no more: a namespaced `.claude/commands/<folder>` directory link — Claude
  Code renders it `/<folder>:sync`, so it can shadow nothing a team could name — a bare
  `.claude/commands/sync.md` **only where the team does not already own that name**, and a root
  `CLAUDE.local.md` importing the foundation's own. All three go in `.git/info/exclude`, none is
  written without an explicit yes, and on Windows they are a junction and a hardlink rather than a
  symlink, which needs elevation. The first session cannot use them, because `/sync` is what makes
  them: it bootstraps with `cd <folder>; claude --add-dir ..`, and `START_HERE.md`'s step 1 is
  rewritten to the root route only after the links exist.
  Offered only when the analysis found code; a documents-only import gets `/start` and stays
  integrated.
- **Curated UI directions are a visual language, never a layout (spec 165).** Each of the three
  directions on the design question points at a **theme** — palette, type, corner, spacing, surface,
  motion — that `/start` installs on top of shadcn/ui at an **exact pinned version**, never `@latest`.
  It installs **no screens and no layout blocks**: what is on a screen, and how someone moves between
  screens, comes from the founder's own answers, and a picked picture must never outrank them. The
  interview shows each direction as a *specimen* of the look, drawn from that same record (or a real
  capture of it — `pnpm capture:ui-kits`), so the picture cannot drift from what gets installed. The
  pick is **stored** (`uiKit`), not derived from the prose: editing the words must not cancel an
  install. `UI_ARCHITECTURE.md` names the theme, version and licence, and every foundation that
  installs the library ships `THIRD_PARTY_NOTICES.md` — a custom stack and an imported project
  install nothing and get neither. Only permissive licences may be installed
  (`PERMISSIVE_LICENCES`); a weekly workflow reports a stale pin and never bumps one.
- **UI references:** the interview's design question accepts links and uploaded screenshots (spec 159).
  Links are an ordinary answer and are **never fetched**; images live in the private `ui-references`
  bucket with an org-scoped row each, are read only by the authoring provider's UI call, and never
  reach a generated file — what ships is the model's description of them. Uploading needs an account;
  the guest interview still writes nothing server-side.
- **Plans:** an organization carries a `plan` (`free` | `pro`). Free is one foundation plus two free
  regenerations within 24h; Pro is unlimited and adds importing an existing project. `checkAllowance`
  is the only place that decides, always server-side from Postgres. **`organizations.plan` is written
  only from something Stripe told us**: the webhook (`api/stripe/webhook`) and the direct API read in
  `features/billing/sync.ts`, both through `applySubscriptionState`. A Checkout redirect still proves
  nothing and grants nothing — spec 100 amended spec 99's "webhook only" to name the second path,
  because a founder whose webhook never arrives must not be stuck paying for free. Specs 74, 99, 100.
  Pro can also be **earned**: inviting someone who then generates their first foundation is worth a
  week, capped at three per workspace. That week is a `plan_grants` row, never `organizations.plan` —
  the entitlement is resolved as *the plan or an active grant*, and only `claimAllowance` and the
  import gate may **start a queued one**, so a screen that merely reports never spends it. Spec 122.
  Support can also **give** Pro from the admin console for a fixed 30, 90 or 365 days (spec 164): a
  `plan_grants` row with `source = 'support'`, written already-started so it never queues behind
  anything, refused when Stripe is already paying, and ended by closing its window rather than deleting
  it. Still never `organizations.plan` — a write there would be reconciled away by the next webhook.
  The public card and `/app/upgrade` show the founding rate **beside the list price it discounts from**,
  struck through (spec 182, narrowing spec 179's rule that the list price must never appear: the figure
  presented as payable is still always the founding one). Both come from Stripe; when the list price
  cannot be read the founding figure renders alone.
