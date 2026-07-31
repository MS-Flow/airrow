# Airrow — Spec Constitution

The single source of truth for how Airrow is built and what every spec and change must respect. When
any other file disagrees with this one, **this file wins**. It holds the *invariants* (the
non-negotiables) and links to the canonical deep-dives for detail, so detail can evolve without the
rules drifting. Amendments are recorded in the spec that changes them (or a short note under `docs/`).

Canonical sources it governs: [`CLAUDE.md`](../../CLAUDE.md) ·
[`SYSTEM_OVERVIEW.md`](../../docs/architecture/SYSTEM_OVERVIEW.md) ·
[`SYSTEM_ARCHITECTURE.md`](../../docs/architecture/SYSTEM_ARCHITECTURE.md) ·
[`DATABASE_DESIGN.md`](../../docs/architecture/DATABASE_DESIGN.md) ·
[`UI_ARCHITECTURE.md`](../../docs/architecture/UI_ARCHITECTURE.md) ·
[`INFORMATION_ARCHITECTURE.md`](../../docs/architecture/INFORMATION_ARCHITECTURE.md) ·
[`DEVELOPER_GUIDE.md`](../../docs/guides/DEVELOPER_GUIDE.md) ·
[`BRANCHING.md`](../../docs/architecture/BRANCHING.md).

---

## 0. Product invariants (the promise)
Every feature, screen, and generated file is judged against these.
- **Preparation, and a starting point.** Airrow's hosted product generates engineering *foundations* —
  documents, rules, workflow and CI — never application code. The `/start` command it ships **inside**
  a generated repository is the deliberate exception: run explicitly by the founder, on their own
  machine, it scaffolds the stack and then builds the product's core action — `mvpFocus` — for real,
  to the design in `UI_ARCHITECTURE.md`, using only information already in the repo. **The ceiling is
  `mvpFocus`, built well** — not a second feature, not a roadmap item, not a capability picked for
  later, and never a guess at the product: everything created must trace back to something the
  founder actually wrote, or it is left as a `[NEEDS CLARIFICATION]` marker rather than invented.
  Presentation may go further than function — `/start` may finish the screen to the design language
  already in the repo where the founder's own direction was thin — but schema, persistence and any
  real auth service stay out; those are the founder's first spec. Everything past `mvpFocus` goes
  through the spec loop. A foundation generated for a project that **already exists** ships `/cleanup`
  in its place: run the same way, it reads the codebase that is there and rewrites the foundation's
  documents to describe it. Its ceiling is narrower — it changes no code and deletes nothing. A
  foundation ships exactly one of the two, decided by where the project came from. Airrow's servers
  still never write application code, and ZIP delivery is still a complete foundation on its own.
  (Amended by [spec 66](../../specs/66-start-command.md), which records the previous wording, extended
  by [spec 91](../../specs/91-cleanup-command.md), and amended again by
  [spec 123](../../specs/123-foundation-starts-strong.md) — which records the "bare minimum that runs"
  wording spec 66 introduced.)
- **The output is the product.** Generated repos must read like a senior CTO wrote them for *this*
  project — never like a filled-in template. Generic output is a top-severity bug.
- **Adaptive, never bureaucratic.** The interview asks only questions whose answers change the output.
  If removing a question wouldn't change the result, remove the question.
- **Opinionated defaults, deliberate escape hatches.** Recommend the golden path with confidence;
  offer choices only where they genuinely matter. Never add options to seem flexible.
- **Founder-in-control & trust through transparency.** Nothing destructive or irreversible runs
  automatically. The founder previews the *entire* output (file tree + key files) and explicitly
  approves before anything is written, provisioned, or committed. No lock-in: plain files, open
  structure, any AI assistant (Claude Code is the primary target).
- **The founder must succeed after Airrow.** Optimize for the founder's month two, not their minute
  ten — ship the onboarding, guides, and workflow that carry them through months of AI-assisted work.
- **Airrow is built with Airrow.** This repo is the reference implementation. If a practice is too
  heavy for us, we don't generate it for customers; a better practice we discover, both adopt.

## I. Architecture invariants
- **One-way data flow.** `app/**` routes (RSC by default) → client components → Server Actions /
  Route Handlers → feature `queries.ts` / `actions.ts` → the DataStore
  (`apps/web/src/lib/data/store.ts`). Never reach around a layer; routes are thin, logic lives in
  features, pure logic lives in packages.
- **External calls are server-side only, in one place each.** The Claude API has exactly **two**
  callers, and adding a third takes an amendment: the generation engine's authoring provider
  (`features/generation/author.ts`), which writes foundations, and the landing chat's provider
  (`features/chat/provider.ts`), which answers visitors. They share no key — the chat is a public,
  unauthenticated surface and carries its own, so abuse of it can never reach generation's budget.
  Supabase / GitHub App only via the DataStore and server actions. Never from client components;
  never from `packages/engine` or `packages/schemas`. (Amended by
  [spec 141](../../specs/141-landing-chat.md), which records the previous wording: "Claude API only
  via the generation engine's authoring provider".)
- **The engine stays pure.** `packages/engine` is a headless `generate(projectModel) → RepoTree +
  Manifest`. `packages/engine` and `packages/schemas` **never** import from `apps/*` and **never**
  read `process.env` (config is injected).
- **Types & errors.** TypeScript `strict`; `any` is forbidden (use `unknown` + narrowing; `as` casts
  carry a justifying comment). Shared types live once in `packages/schemas`, derived from Zod via
  `z.infer` at every boundary. Prefer discriminated unions over booleans-with-meaning; the engine
  returns `Result`-style typed errors, not thrown strings. No barrel files that hide the dep graph;
  no circular imports.
- **Simple over clever.** Boring technology, obvious code; an abstraction is earned by ≥2 concrete uses.
- **Autogenerated, never hand-edited:** `pnpm-lock.yaml`, `.next/`, generated repo artifacts under
  `.data/`, and Supabase-generated types.

## II. Data invariants
- **Tenancy by `organization_id`.** Every resource hangs off an organization; each user gets a
  personal org at signup. Authorization is decided server-side — never trust client-supplied
  org/project IDs. **One table is exempt, and only because there is no tenant to point at:**
  `chat_rate_limits` counts answers for anonymous visitors on the public landing page. What replaces
  tenancy there is that nobody may read it — `authenticated` is granted nothing on the table and
  cannot execute the functions that write it, proven by denial tests like every other table
  ([spec 141](../../specs/141-landing-chat.md)). A resource that *has* an organization still hangs
  off one.
- **RLS everywhere, with denial tests.** Every table has Row-Level Security scoped through org
  membership, and server code *additionally* scopes queries (defense in depth). No exceptions,
  including "internal" tables. Access control ships in the same change as the new table/resource.
- **Migrations are the only way schema changes happen.** Idempotent, replay cleanly from zero,
  committed in `supabase/migrations`. Never hand-edit the schema in the Supabase dashboard.
- **Customer IP is protected.** Interview answers and artifacts are encrypted at rest, reached only
  via RLS-scoped paths, and served from Storage via short-expiry signed URLs. Deleting a project
  cascades to its interviews, models, jobs, artifacts, and Storage objects. Logs carry IDs and
  metadata only — never answer content or generated document bodies.
- **Manifest of record.** Generation records per file (source, template id + version, prompt version,
  model, inputs hash) in Postgres — do not bypass it. Full schema: `DATABASE_DESIGN.md`.
- **Repo access is least-privilege, and never a user PAT.** Reading **public** content may use the
  signed-in user's OAuth identity with **no scopes** — that reaches nothing an anonymous visitor
  could not already fetch. Everything beyond it — private content, and every write — goes through a
  **GitHub App installation** with minimal permissions and short-lived tokens. User PATs are never
  accepted, and no repo credential is ever persisted. (Amended by
  [spec 67](../../specs/67-github-login-import.md), which records the previous wording.)

## III. Design invariants
- **Tokens, not literals.** Use the Tailwind v4 / design-system tokens (color, spacing, radii, type) —
  never hardcode hex/px in components. Design bar: Linear / Vercel / Stripe; dark-mode first.
- **Reuse before create.** Reuse the shared shadcn/ui-based components (`apps/web/src/components/ui`)
  before writing a new one; extend the system rather than forking it. Route/screen map: `UI_ARCHITECTURE.md`.
- **Explicit states.** Loading / error / empty are real components, not conditionals scattered in JSX;
  no `useEffect` for data fetching.
- **Sanitized rendering.** Generated/authored Markdown is untrusted — render sanitized (DOMPurify),
  never `dangerouslySetInnerHTML` with user-derived content, never execute it.

## IV. Process invariants  (PORTABLE — keep as-is, only names change)
- We work via GitHub: a **feature** is a GitHub Project, and **issues** are linked to that feature.
  Each issue gets a spec and a branch.
- **Spec before code.** Every issue gets a `specs/NNN-kort.md` before implementation; the spec is the
  source of truth and code is reviewed *against* it. One feature at a time. When code and spec
  disagree, stop and **fix the spec first**.
- **Branch model (this supersedes any older "trunk-based / `feat/F-XXX`" rule).** Branch `NNN-kort`
  (issue number + short name, **no** `issue/` prefix) is cut from its `feature/<name>`. **PR direction
  is strict and never skipped:** issue branch → its `feature/<name>` → `develop` → `main`. An issue
  branch is **never** PR'd to `main` or `develop`. If unsure which feature an issue branched from,
  check `git merge-base` or ask. Full model: `BRANCHING.md`.
- **Conventional Commits**, atomic and buildable: `feat:`, `fix:`, `docs:`, `chore:`, `refactor:`,
  `test:` (scope by feature where useful). Small PRs — one coherent slice; squash-merge with a clean
  title.
- **Decisions are recorded.** Any decision that would cost >1 day to reverse is written down — in the
  spec that introduces it or a short note under `docs/` — with or before the implementing PR, never
  reconstructed after the fact.
- **AI context stays synchronized.** `CLAUDE.md` and docs update in the **same** change as the code
  they describe. Stale context is a broken build. Single source of truth: a fact lives in exactly one
  file, everything else links; duplicated content is a bug.
- After implementing: check off acceptance criteria, set the spec **Status**, and update
  [`../../specs/README.md`](../../specs/README.md).

## V. Testing invariants  (PORTABLE — test runner is Vitest)
- **Test what breaks the product:** the generation engine, data integrity, and critical flows.
  Coverage is a byproduct, not a target.
- Tests are **co-located** with the code (`*.test.ts` / `*.test.tsx`), matching Vitest's glob so CI
  runs them automatically. Test names read as behavior (`denies artifact access to non-members`).
- Tests are **deterministic**: no dependence on local time/timezone, randomness, or the network. CI
  pins `TZ=UTC`; anchor fake time in UTC (`vi.setSystemTime`).
- **Layer bar:** Unit (Vitest) for engine stages, schema validation, utils — required for all engine +
  business logic. Snapshot (Vitest) of engine output vs golden fixtures — a snapshot diff is a
  product decision, reviewed like code, never blindly regenerated. Integration (Vitest + local
  Supabase) for the data layer, **every table's RLS (access *and* denial)**, and every mutation. E2E
  (Playwright) for the critical path (signup → interview → generate → preview → deliver).
- **Engine testing (highest bar):** the authoring provider is an interface; tests use a deterministic
  mock. LLM-dependent behavior is validated via document contracts. Fixture interviews cover the
  product-type × feature matrix; adding a question requires updating fixtures.
- Bug fixes ship with a regression test that fails before the fix. Failing or skipped tests never
  merge. Each spec's **Verification** section names the tests it adds; `/implement` writes them,
  `/analyze` confirms they exist and are green before closing a spec.

## VI. Verification bar  (Airrow stack commands)
A change is not done until:
- Typecheck is clean:  `pnpm -r typecheck`
- Linter adds **no new** issues:  `pnpm -r lint`
- Tests are green:  `pnpm -r test`  (single file while iterating: `pnpm --filter web test <file>`) —
  noting known pre-existing failures — **and** `pnpm test:scripts` for the CI helpers in `scripts/`,
  which live outside the workspace and are therefore out of `-r`'s reach (amended by spec 53).
- Security addressed: every spec has a Security note; high-severity dependency advisories block a release.
- The relevant acceptance criteria are demonstrably met (by a test or an explicit manual check).
