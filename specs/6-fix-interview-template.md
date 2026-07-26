# Spec: Redesign the interview into an architecture-first question set

**GitHub issue:** #6 — "Fix interview to follow new updated template"
**Branch:** `6-fix-interview-template` (from `feature/interview-generator`)
**Feature:** Interview-driven project generator
**Depends on:** [1-interview-generator.md](1-interview-generator.md)
**Status:** ✅ Done

<!--
Canonical single-file spec format for Airrow. One file per issue: specs/NNN-kort.md. It combines the
WHAT, the HOW (exact file:line changes), acceptance criteria, verification and edge cases in one
document — do NOT split into separate plan.md / tasks.md files.
Status legend: ⏳ Not started · 🔄 In progress · ✅ Done
Mark anything undecided inline with [NEEDS CLARIFICATION: …] so /clarify can find it.
-->

---

## User story
As a **founder starting a new web app** I want **the interview to ask the questions that actually shape a
system's architecture — and to capture my vision and end goal** so that **the generated foundation
(`CLAUDE.md`, `VISION.md`, architecture docs, specs) is tailored to what I'm building and the AI assistants
that read those files know what they're building toward.**

---

## Background
- The interview is a flat, declarative list in
  [`packages/schemas/src/questions.ts`](../packages/schemas/src/questions.ts) — currently: `productType`,
  `audience`, `features` (checkbox), `roles`, `framework`, `repoProvider`, `team`, `security`, `scale`,
  `mvpFocus`, `coreEntities`, `goal90`. It is typed in
  [`packages/schemas/src/types.ts`](../packages/schemas/src/types.ts), validated at the Zod boundary in
  [`packages/schemas/src/index.ts`](../packages/schemas/src/index.ts), resolved to a `ProjectModel` in
  [`packages/engine/src/model.ts`](../packages/engine/src/model.ts), and consumed by the scaffold token
  renderer [`packages/engine/src/scaffold.ts`](../packages/engine/src/scaffold.ts) and the document authors
  [`packages/engine/src/documents/*`](../packages/engine/src/documents/).
- **Gaps for a new web app:** identity/auth strategy, tenancy & data-isolation model, compliance regime,
  async/background work, and external integrations are only implied by a single `features` checkbox — the
  answers that most change the *architecture* aren't asked directly. Vision/end-goal is thin (`mvpFocus` +
  `goal90` only), so authored docs have little long-term intent to build toward.
- This supersedes the earlier scope of this spec (fill the `CORE_ENTITIES` token). That change already
  landed and its question is retained inside the new set.

---

## Design decision
Replace the flat list with a **themed, adaptive, architecture-first** interview of ~15 questions (typical
visible run 13–15 after conditionals). Principles, all from the constitution §0:
- **Every question changes the output.** Each maps to a concrete artifact — a token, a `ProjectModel`
  field/derivation, a feature spec, or an authored doc section. If it wouldn't change output, it's cut.
- **Opinionated golden path, deliberate escape hatches.** Stack questions default to the golden path
  (Next.js · TS · Tailwind + shadcn/ui · Supabase · Vercel · GitHub) and only offer alternatives where the
  choice genuinely changes the architecture.
- **Vision-forward.** A dedicated vision/end-goal block runs first and is threaded prominently into
  `VISION.md`, `CLAUDE.md`, and `ROADMAP.md` so AI assistants reading the repo understand the destination,
  not just the MVP.
- **Never guess.** Optional questions left blank render `[NEEDS CLARIFICATION: …]` rather than inventing
  content (founder-in-control).

### Proposed question set
Themes ordered as the founder answers them. `→ output` names what each answer drives.

| # | id | title (short) | type | req | showIf | → output |
|---|----|----------------|------|-----|--------|----------|
| 1 | `productType` | What are you building? | single | ✓ | — | architecture shape, doc tone |
| 2 | `vision` | Long-term vision — what does this become if it wins? | text | ✓ | — | `VISION.md`, `CLAUDE.md` purpose, `PROJECT_TAGLINE`/`DOMAIN_OVERVIEW` |
| 3 | `mvpFocus` | What must the MVP do, above all else? | text | ✓ | — | roadmap, first feature specs |
| 4 | `goal90` | What does success look like in 90 days? | text | ✓ | — | `ROADMAP.md` outcomes |
| 5 | `audience` | Who is it for? (B2B / B2C / both / internal) | single | ✓ | web/product types | tenancy defaults, onboarding, billing |
| 6 | `coreEntities` | Core domain objects & relationships (3–7) | text | ✗ | — | `CORE_ENTITIES`, data model doc |
| 7 | `tenancy` | How is data organized & isolated? | single | ✓ | — | data model, RLS invariant (`organization_id` vs per-user) |
| 8 | `authModel` | How do users sign in? | multi | ✓ | tenancy ≠ none/public | auth architecture, `auth` feature spec |
| 9 | `roles` | How sophisticated are roles & permissions? | single | ✓ | tenancy ∈ {organizations, marketplace} | permission model spec |
| 10 | `capabilities` | Which capabilities in year one? | multi | ✓ | — | feature specs, architecture sections |
| 11 | `aiUsage` | What kind of AI? | single | ✓ | capabilities ∋ ai | AI architecture, LLM-output validation, provider |
| 12 | `integrations` | Which external systems will you integrate? | text | ✗ | capabilities ∋ integrations/payments | integration specs |
| 13 | `dataSensitivity` | Data sensitivity & compliance | single | ✓ | — | encryption/audit/RLS emphasis, security note |
| 14 | `scale` | Scale target for v1 | single | ✓ | — | caching/DB/perf posture |
| 15 | `framework` | Web framework | single | ✓ | web product types | `STACK_*`, CI, deploy |
| 16 | `hosting` | Deploy target | single | ✓ | — | `DEPLOY_TARGET`, `DEPLOY_STEPS` |
| 17 | `repoProvider` | Where will your code live? | single | ✓ | — | CI provider, branching docs |
| 18 | `team` | Who's building it? | single | ✓ | — | workflow/branching prescription |

Conditionals (rows 8, 9, 11, 12, 15) keep a typical run at 13–15 visible questions.

**Enums:**
- `tenancy`: `single_user` · `organizations` (multi-tenant) · `marketplace` (two-sided) · `internal`
- `authModel` (multi): `email_password` · `magic_link` · `social` · `sso` · `public`
- `aiUsage`: `llm_calls` · `rag` · `agents` · `ml_models` (model stores `"none"` when AI unselected)
- `dataSensitivity`: `standard` · `pii` (PII at scale / payments) · `regulated` (health, finance, minors)
- `scale`: `validate` · `growth` · `high_scale`
- `capabilities` (multi, typed as `FeatureId`): `payments` · `storage` · `search` · `realtime` ·
  `notifications` · `email` · `ai` · `analytics` · `admin` · `audit_logs` — the identity-adjacent
  capabilities (`auth`, `organizations`, `roles`) are **derived** from `authModel`/`tenancy`/`roles`, not
  offered as checkboxes.
- `framework`: `nextjs` · `vite` — **decided:** no `remix` (not on the golden path; opinionated defaults §0).
- `hosting`: `vercel` · `netlify` · `aws` · `azure` · `self_host`
- `repoProvider`: `github` · `azure_devops` — **decided:** no `gitlab` (keep the supported CI set).

### Internal mapping decision (implementation)
The **interview** (questions + `InterviewAnswers`) is fully replaced. The engine's `ProjectModel` keeps its
existing shape as the internal contract, so the document authors don't need a risky rewrite:
- `resolveProjectModel` translates the new answers into the model: `features: FeatureId[]` is *projected*
  from `capabilities` + `auth` (when `authModel` is not just `public`) + `organizations` (when `tenancy` is
  multi-tenant); `security` is projected from `dataSensitivity` (`standard`→`standard`, else `elevated`);
  `roles` from `tenancy` + the `roles` answer.
- New `ProjectModel` fields carry the richer signal to the docs: `vision`, `tenancy`, `authModel`,
  `aiUsage`, `integrations`, `hosting`. `scale` gains `high_scale` (treated as growth posture in docs).
- `features`/`security` are therefore **not removed** — they become derived projections. This is the
  minimal change that satisfies the redesign while respecting "simple over clever" (constitution §I).

**Deliberately not touched:** the portable Process/Testing invariants in the constitution and the
`.claude/` workflow scaffold — only project-tailored outputs change.

---

## Exact changes (file:line)
Grounded now; `/implement` refines line anchors.
1. **[`packages/schemas/src/questions.ts`](../packages/schemas/src/questions.ts)** — replace
   `interviewQuestions` with the set above; keep the pure evaluator helpers (`isQuestionVisible`,
   `visibleQuestions`, `pruneHiddenAnswers`, `firstUnanswered`, `isInterviewComplete`) unchanged.
2. **[`packages/schemas/src/types.ts`](../packages/schemas/src/types.ts)** — new enums (`Tenancy`,
   `AuthMethod`, `AiUsage`, `DataSensitivity`, `Capability`, `Hosting`); update `InterviewAnswers` and
   `ProjectModel` (add `vision`, `tenancy`, `authModel: AuthMethod[]`, `aiUsage`, `integrations`,
   `dataSensitivity`, `capabilities`, `hosting`; drop `features`/`security`); refresh `derived` flags
   (`multiTenant` from `tenancy`, `hasAi` from `capabilities`, add `hasBackgroundJobs`, `hasIntegrations`).
3. **[`packages/schemas/src/index.ts`](../packages/schemas/src/index.ts)** — rebuild
   `interviewAnswersSchema` + enum schemas for the new fields; keep `.partial()`; update
   `validateCompleteAnswers` (unchanged logic, new fields flow through).
4. **[`packages/engine/src/model.ts`](../packages/engine/src/model.ts)** — resolve the new fields, recompute
   `derived`, and update the label maps (`featureLabel` → `capabilityLabel`, add `tenancyLabel`,
   `authLabel`, etc.).
5. **[`packages/engine/src/scaffold.ts`](../packages/engine/src/scaffold.ts)** — feed new answers into the
   token values (`DOMAIN_OVERVIEW`/`ROLES`/`DATA_INVARIANTS` now keyed off `tenancy` &
   `dataSensitivity`), and derive `PROJECT_TAGLINE`/vision text.
6. **[`packages/engine/src/documents/*`](../packages/engine/src/documents/)** — thread `vision` into
   `vision()`/`claudeMd()`/`roadmap()`; base feature specs on `capabilities`; base auth/permission specs on
   `authModel`/`roles`; base data doc on `tenancy`/`dataSensitivity`.
7. **Fixtures/tests** — update [`scripts/engine-smoke.mjs`](../scripts/engine-smoke.mjs) fixtures to the new
   answer shape; update [`packages/engine/src/scaffold.test.ts`](../packages/engine/src/scaffold.test.ts)
   and add unit tests for the new resolution (tenancy → RLS, capabilities → specs, blank optional → marker).

---

## Data model
**No DB schema changes.** All work is in the in-code interview schema and engine resolution
(`packages/schemas`, `packages/engine`). The generated project's *documented* data model changes (tenancy
now explicit), but no Airrow-side tables/migrations are added.

---

## Acceptance criteria
- [x] Interview is fully replaced by the architecture-first set; every question maps to a named output (no dead questions — constitution §0).
- [x] Vision/end-goal is captured and appears in generated `VISION.md`, `CLAUDE.md`, `context/PROJECT.md`, and the `DOMAIN_OVERVIEW` token.
- [x] `tenancy` drives the data-model / RLS invariant (multi-tenant → `organization_id` + RLS; single-user → per-user scoping); the `features ∋ organizations` inference is gone (now `tenancy`-driven).
- [x] `authModel`, `capabilities`, `aiUsage`, `dataSensitivity`, `hosting` each change generated output (specs, architecture sections, tokens).
- [x] Optional questions left blank render `[NEEDS CLARIFICATION: …]`, never invented content (CORE_ENTITIES + vision fallbacks).
- [x] Interview output validates at the Zod boundary (`interviewAnswersSchema`, `validateCompleteAnswers`).
- [x] `pnpm engine:smoke` passes with the new fixtures.
- [x] `pnpm -r typecheck` clean; `pnpm -r lint` no new issues; `pnpm -r test` green.

### Verification
- **Unit (engine)** — [`packages/engine/src/model.test.ts`](../packages/engine/src/model.test.ts) (new, 7
  tests): auth+organizations projection from `authModel`/`tenancy`, `dataSensitivity`→`security`, `aiUsage`
  only when AI selected, public-only → no accounts; vision threaded into `VISION.md`/`CLAUDE.md`; auth
  methods named in the auth spec; a spec per selected capability.
- **Scaffold** — [`packages/engine/src/scaffold.test.ts`](../packages/engine/src/scaffold.test.ts) (updated
  to the new answer shape): single-tenant uses per-user scoping; CORE_ENTITIES fills / flags correctly.
- **Smoke** — `pnpm engine:smoke` → SMOKE PASSED (3 fixtures exercising organizations/marketplace/internal
  tenancy, `high_scale`, and non-Vercel hosting).
- **Results:** `pnpm -r typecheck` clean · `pnpm -r lint` clean · `pnpm -r test` → engine 16/16 pass
  (schemas/web have no test files). No pre-existing failures observed.

## Implementation notes
- Per the internal-mapping decision, `ProjectModel` keeps `features`/`security` as **projections** of the
  new answers, so the document authors needed only additive threading (vision, identity, integrations,
  AI-usage, hosting) rather than a rewrite. `scale` gained `high_scale`; the two `scale` conditionals in
  `documents/docs.ts` were corrected so `high_scale` gets the growth/high-scale posture (previously an
  unhandled value would have fallen through to the validation branch).
- Open enums resolved as opinionated defaults: no `remix` framework, no `gitlab` repo provider.
- **`/analyze` finding (fixed):** `hosting` was initially threaded into only the `DEPLOY_TARGET` token and
  the TECH_STACK row, leaving 9 hardcoded "Vercel" mentions across the authored docs — a self-contradiction
  for non-Vercel projects (constitution §0 "output is the product"). Resolved by threading
  `hostingLabel[m.hosting]` through all of them (`core.ts`, `docs.ts`, `standards.ts`); the deploy *workflow*
  stays Vercel-based behind an explicit "defaults to Vercel — adjust" caveat shown only for non-Vercel hosts.
  Regression test added: `model.test.ts` "hosting threads consistently (no Vercel contradiction)".
- **Post-close follow-up (user request):** added a `hobby` product type ("Side project / for fun") to the
  `productType` question — wired through `ProductType`, `productTypeSchema`, `productTypeLabel`, and the
  resolver (audience defaults to `b2c` and stays hidden; framework question is shown). Regression test:
  `model.test.ts` "defaults a hobby / for-fun project to a consumer audience".
- **Minimalism pass (user request):** removed the `goal90` question — a 90-day-metric prompt that didn't
  shape architecture (long-term intent is already captured by `vision`). Its engine references were rewired:
  `VISION.md` drops the "90-day definition" section, `ROADMAP.md` Milestone 3 now points at the vision, the
  analytics spec and `context/PROJECT.md` reference `mvpFocus`/`vision` instead. `vision` and `mvpFocus`
  copy was tightened to read as one-sentence, self-explanatory prompts. The rest of the question set was
  reviewed and kept — each remaining question is necessary or conditional/optional (skippable).
- **Framework variety (user request):** expanded the web `framework` question from `nextjs`/`vite` to also
  offer `remix` and `astro` — all four share the golden-path stack (TS · Tailwind · shadcn/ui · Supabase ·
  Vercel), so output stays consistent. The engine's binary `=== "nextjs"` doc branches were generalized via
  an `isSpaFramework` helper + a `frameworkPreset` map so Remix/Astro render as server frameworks (loaders/
  actions) rather than being mislabeled "Vite + React SPA". **Not** added: native mobile / API /
  browser-extension frameworks (Expo, Hono, WXT, …) — those need a different generated stack (no
  shadcn/Server-Components) and would otherwise produce self-contradictory foundations; that is a larger,
  spec-worthy change tracked as a follow-up. Regression tests: `model.test.ts` "web framework variety".
- **Database provider (user request, scoped to "Postgres providers"):** added a `database` question before
  `hosting` — `supabase` (golden path) · `neon` · `vercel_postgres` · `postgres` (self-hosted). All are
  PostgreSQL, so RLS, SQL migrations, and the constitution §II data invariants stay intact. Threaded
  `databaseLabel`/`usesSupabase`/`backendSummary` helpers through the stack-identity surfaces (README,
  CLAUDE.md, context/ARCHITECTURE, TECH_STACK, ADR-0001, `STACK_SUMMARY` token, GETTING_STARTED, security
  env line, auth spec). Non-Supabase choices render "wire your own Auth/Storage" caveats instead of claiming
  Supabase Auth/Storage/Realtime. **Known bound:** deep feature-spec internals for `storage`/`realtime` and
  the `auth.uid()`/`supabase/migrations` conventions still name Supabase as the recommended provider — full
  non-Supabase Auth/Storage/Realtime generation would be a larger, spec-worthy change. Regression tests:
  `model.test.ts` "database provider threads consistently".
- **Option-set narrowing (user request):** `framework` → `nextjs`/`vite` (removed `remix`/`astro`);
  `hosting` → `vercel`/`azure`/`self_host` (removed `aws`/`netlify`); `database` → `supabase`/`postgres`
  (removed `neon`/`vercel_postgres`). The framework doc branches were collapsed back to a clean 2-way
  (nextjs vs vite) — no dead branches left. A Microsoft stack (.NET framework, MSSQL/Azure SQL database) was
  **requested but not added**: it is not a label change — it would require the engine to generate a
  fundamentally different foundation (C# · ASP.NET/Blazor · EF Core · xUnit · NuGet · SQL Server RLS) that
  shares almost nothing with the TS/React/Supabase/Postgres engine, and MSSQL breaks constitution §II's
  PostgreSQL mandate. Tracked as a follow-up: a dedicated "Microsoft/.NET stack profile" spec.
- **Final verification:** `pnpm -r typecheck` clean · `pnpm -r lint` clean · `pnpm -r test` → engine 22/22 ·
  `pnpm engine:smoke` → SMOKE PASSED. No pre-existing failures.

---

## Edge cases
- `tenancy = single_user` → no `organization_id`; data scoped per owning user; `roles` question hidden.
- `authModel = public` (no accounts) → auth spec omitted; `authModel`/`roles` hidden.
- `capabilities` empty → still emits the invariant skeleton; no feature specs; no dead references.
- `capabilities ∋ ai` but `aiUsage` blank → AI section flagged, not guessed.
- Vision left short/blank → `PROJECT_TAGLINE`/vision sections fall back to `[NEEDS CLARIFICATION]`.
- Non-web `productType` (mobile, extension, api) → `framework` hidden; stack defaults applied.

---

## Out of scope
- Application implementation code — Airrow generates foundations only (constitution §0).
- Interview **UI** changes beyond consuming the new schema (the UI renders from `questions.ts`).
- Any DB migration or RLS change on Airrow's own tables.
