# Spec: Downloaded foundation must fully reflect the new interview answers

**GitHub issue:** #10 — "Downloaded foundation must fully reflect the new interview answers"
**Branch:** `10-foundation-reflects-answers` (from `feature/interview-generator`)
**Feature:** Interview-driven project generator
**Depends on:** [1-interview-generator.md](1-interview-generator.md) (the `template/` + `renderScaffold`
split, whose app-wiring criterion is still open) · [6-fix-interview-template.md](6-fix-interview-template.md)
(architecture-first interview)
**Status:** 🔄 In progress

<!--
Canonical single-file spec format for Airrow. One file per issue: specs/NNN-kort.md. It combines the
WHAT, the HOW (exact file:line changes), acceptance criteria, verification and edge cases in one
document — do NOT split into separate plan.md / tasks.md files.
Status legend: ⏳ Not started · 🔄 In progress · ✅ Done
Mark anything undecided inline with [NEEDS CLARIFICATION: …] so /clarify can find it.
-->

---

## User story
As a **founder who just finished the Airrow interview** I want **every file in the downloaded
`<slug>-foundation.zip` to come from the canonical template and reflect the answers I actually gave — and
to end with concrete, ordered next steps for my chosen stack** so that **I can open the folder, follow the
instructions, and keep building with zero guesswork and no generic template leftovers.**

---

## Background
Current state (line anchors refined during `/implement`):
- **There are two parallel generators, and the ZIP uses the wrong one.**
  [`apps/web/src/features/generation/runner.ts:25`](../apps/web/src/features/generation/runner.ts#L25)
  calls `generate(model)` from [`packages/engine/src/index.ts`](../packages/engine/src/index.ts), which
  assembles ~30 **hand-authored** documents from
  [`packages/engine/src/documents/`](../packages/engine/src/documents/) (`core.ts`, `docs.ts`, `specs.ts`,
  `standards.ts`) — including `START_HERE.md`, `context/*`, `prompts/*`, `templates/*` and the `adr/`
  tree. The ZIP route
  ([`apps/web/src/app/api/projects/[id]/zip/route.ts`](../apps/web/src/app/api/projects/%5Bid%5D/zip/route.ts))
  just streams that artifact.
- The **canonical scaffold** is [`template/`](../template/) — 15 files with `{{TOKENS}}`, catalogued in
  [`template/.airrow-template.json`](../template/.airrow-template.json) as fixed-workflow vs. tailored
  paths. The pure renderer
  [`packages/engine/src/scaffold.ts`](../packages/engine/src/scaffold.ts) (`renderScaffold`,
  `deriveScaffoldValues`) exists and is tested, but **was never wired into generation** — see the open
  criterion at [`specs/1-interview-generator.md:78`](1-interview-generator.md).
- **The gap:** spec #6 added the richer answers (`vision`, `tenancy`, `authModel`, `roles`,
  `capabilities`, `aiUsage`, `integrations`, `dataSensitivity`, `hosting`, `scale`, `database`) but the
  shipped documents still read the *derived projections* in many places — `m.features` at
  [`docs.ts:78`](../packages/engine/src/documents/docs.ts#L78),
  [`:206`](../packages/engine/src/documents/docs.ts#L206),
  [`:248`](../packages/engine/src/documents/docs.ts#L248),
  [`:333`](../packages/engine/src/documents/docs.ts#L333),
  [`core.ts:54`](../packages/engine/src/documents/core.ts#L54),
  [`specs.ts:156`](../packages/engine/src/documents/specs.ts#L156); `m.security` at
  [`docs.ts:56`](../packages/engine/src/documents/docs.ts#L56),
  [`standards.ts:80`](../packages/engine/src/documents/standards.ts#L80),
  [`core.ts:164`](../packages/engine/src/documents/core.ts#L164),
  [`:274`](../packages/engine/src/documents/core.ts#L274). Maintaining answer coverage across two
  divergent file sets is the root cause, not a missing interpolation here and there.
- **Existing plumbing that already covers part of it:** `resolveProjectModel`
  ([`model.ts`](../packages/engine/src/model.ts)) resolves every new field and exposes label helpers
  (`hostingLabel`, `databaseLabel`, `usesSupabase`, `backendSummary`) plus `derived` flags;
  `deriveScaffoldValues` already maps a large token set and emits `[NEEDS CLARIFICATION]` markers for
  blanks; `renderScaffold` already returns a founder-approval `ScaffoldPlan`.
- Onboarding content predates the current setup workflow now documented in
  [`docs/guides/INFRASTRUCTURE_SETUP.md`](../docs/guides/INFRASTRUCTURE_SETUP.md) (landed on
  `feature/interview-generator`), so the generated getting-started must be rewritten against it.

---

## Design decision
**The `template/` folder becomes the single source of truth for generated output, and the only one.**
Generation switches to `renderScaffold(template/**, model)`; the hand-authored
`packages/engine/src/documents/*` set is retired along with the entire ADR concept (`adr/README.md`,
`adr/0001-stack.md`, `templates/ADR_TEMPLATE.md`, and every ADR reference in generated prose).

`template/` grows the files issue #10 requires that it doesn't have yet — a tokenized vision document, a
getting-started/next-steps document matching the current setup workflow, and conditional per-capability
spec files — so the output stays as rich as before while every byte is answer-driven and lives in one
reviewable place. Token coverage is extended in `deriveScaffoldValues` so each interview answer
(`tenancy`, `authModel`, `roles`, `capabilities`, `aiUsage`, `integrations`, `dataSensitivity`, `scale`)
drives at least one token or conditional file.

Deliberately **not** touched: the interview question set and `InterviewAnswers`/`ProjectModel` shapes
(settled in #6), the ZIP route and delivery path, the founder-approval preview flow, and Airrow's own DB
schema.

### Decisions taken (were `[NEEDS CLARIFICATION]`)
- **No conditional files.** `renderScaffold` stays a 1:1 map over the template — every project gets the
  same 21 files. Per-capability content is a `CAPABILITY_SPECS` token rendering one brief per selected
  capability inside `specs/README.md`. Simplest mechanism that satisfies "one spec per selected
  capability, nothing for what wasn't selected" without adding a rule engine (constitution §I, simple
  over clever).
- **`START_HERE.md` only** as the entry point — one root file carrying setup → first spec → the loop.
  No `GETTING_STARTED.md`, so the two can never drift apart (duplicated content is a bug, §IV).
- **Nothing extra** beyond `docs/VISION.md` + `START_HERE.md`: no ROADMAP, DATA_MODEL, or prompt library.
  The dropped engine-authored documents are not reintroduced.
- **`vision` reaches four files:** `docs/VISION.md` and `CLAUDE.md` directly via the `VISION` token, plus
  `README.md` and `SYSTEM_OVERVIEW.md` through `DOMAIN_OVERVIEW`. That resolves the issue's truncated
  acceptance line.

---

## Exact changes (file:line)
1. **[`apps/web/src/lib/template/load.ts`](../apps/web/src/lib/template/load.ts)** *(new)* — server-side
   `loadTemplate()`: walks up from `cwd` for `template/.airrow-template.json`, enumerates `template/**`
   with POSIX-relative paths, excludes the meta file. Mirrors the existing `findRepoRoot()` pattern in
   [`store.ts:119`](../apps/web/src/lib/data/store.ts#L119). The I/O lives here so the engine stays pure.
2. **[`apps/web/src/features/generation/runner.ts:26`](../apps/web/src/features/generation/runner.ts#L26)** —
   `generate(loadTemplate(), model, …)`; the staged per-file progress UX is unchanged.
3. **[`apps/web/next.config.ts`](../apps/web/next.config.ts)** — `outputFileTracingRoot` + 
   `outputFileTracingIncludes: { "/**": ["../../template/**"] }` so the template survives a production
   build. (Used `process.cwd()`, not `import.meta.dirname` — Next compiles the config to CJS.)
4. **[`template/`](../template/)** — new `START_HERE.md` and `docs/VISION.md`; `specs/README.md` gains
   `{{CAPABILITY_SPECS}}`; `SYSTEM_OVERVIEW.md` gains sign-in / data-isolation / external-systems /
   security-posture sections; `CLAUDE.md` gains a "What we're building" block; `README.md` points at
   `START_HERE.md` and names the deploy target; `constitution.md` drops "Amendments require an ADR";
   `docs/README.md` indexes `VISION.md`; `BRANCHING.md` translated from Swedish and made
   repo-provider-aware; `.airrow-template.json` rewritten (v2 — 12 new tokens, refreshed path lists).
5. **[`packages/engine/src/scaffold.ts`](../packages/engine/src/scaffold.ts)** — 12 new token
   derivations (`VISION`, `MVP_FOCUS`, `CAPABILITY_SCOPE`, `CAPABILITY_SPECS`, `TENANCY_MODEL`,
   `AUTH_MODEL`, `INTEGRATIONS`, `SECURITY_POSTURE`, `SCALE_POSTURE`, `REPO_PROVIDER`, `SETUP_STEPS`,
   `FIRST_SPEC_HINT`); `deploySteps` is hosting-aware; `dataInvariants`/`keyConventions` now read
   `dataSensitivity`, `aiUsage`, and `scale`; new exported `hasUnresolvedToken`.
6. **[`packages/engine/src/index.ts`](../packages/engine/src/index.ts)** — `author()` and the hardcoded
   `adr/README.md` blob deleted; `generate(template, model, options)` renders the scaffold;
   `validate()`'s required list repointed at the template output and its `{{` check narrowed to
   `hasUnresolvedToken` (GitHub Actions `${{ … }}` expressions are legitimate).
7. **`packages/engine/src/documents/`** — deleted (`core.ts`, `docs.ts`, `specs.ts`, `standards.ts`).
8. **[`packages/engine/src/model.ts`](../packages/engine/src/model.ts)** — `dataSensitivity` carried on
   the model; `aiUsage` no longer guesses `llm_calls`; `isSpaFramework`/`authSummary`/`featureList`
   pruned as unused.
9. **[`packages/schemas/src/types.ts`](../packages/schemas/src/types.ts)** — `ProjectModel.dataSensitivity`.
10. **Docs synced in the same change** (§IV): [`CLAUDE.md`](../CLAUDE.md),
    [`SYSTEM_OVERVIEW.md`](../docs/architecture/SYSTEM_OVERVIEW.md),
    [`SYSTEM_ARCHITECTURE.md`](../docs/architecture/SYSTEM_ARCHITECTURE.md),
    [`INFORMATION_ARCHITECTURE.md`](../docs/architecture/INFORMATION_ARCHITECTURE.md),
    [`DEVELOPER_GUIDE.md`](../docs/guides/DEVELOPER_GUIDE.md).
11. **Preview: edit files + change answers** *(scope added by the user mid-implementation — see
    Implementation notes)*.
    - **[`apps/web/src/lib/data/store.ts`](../apps/web/src/lib/data/store.ts)** — `updateArtifactFile`:
      replaces one file's content in a stored artifact, re-stamps its manifest bytes, and marks it
      `authored`.
    - **[`apps/web/src/features/preview/actions.ts`](../apps/web/src/features/preview/actions.ts)**
      *(new)* — `saveGeneratedFileAction`: session-scoped, rejects a path the engine never produced and
      refuses to empty a file.
    - **[`apps/web/src/features/preview/PreviewBrowser.tsx`](../apps/web/src/features/preview/PreviewBrowser.tsx)** —
      Edit / Save / Cancel with a textarea; the draft is dropped when the selected file changes.
    - **[`preview/page.tsx`](../apps/web/src/app/app/projects/%5Bid%5D/preview/page.tsx)** — a
      "Change answers" link back to the interview.
    - **[`interview/page.tsx`](../apps/web/src/app/app/projects/%5Bid%5D/interview/page.tsx)** — the
      `status === "ready"` redirect that blocked re-entry is gone; passes `regenerating`.
    - **[`InterviewRuntime.tsx`](../apps/web/src/features/interview/InterviewRuntime.tsx)** —
      `regenerating` copy ("Regenerate … foundation"), a warning that hand edits are not carried over,
      and a "Back to the foundation" escape that leaves without regenerating.
12. **[`.claude/spec-kit/spec-template.md`](../.claude/spec-kit/spec-template.md)** and
    **[`template/.claude/spec-kit/spec-template.md`](../template/.claude/spec-kit/spec-template.md)** —
    restructured for human readability: one-sentence plain-language summary, a status table, a skim
    hint, an italic "what belongs here" line under each heading, and acceptance criteria moved above the
    `file:line` plan. Section names deliberately unchanged — the slash commands and constitution refer
    to them by name.
13. **Tests/fixtures** — [`scaffold.test.ts`](../packages/engine/src/scaffold.test.ts) reworked onto the
    template output (27 tests, one assertion per interview answer);
    [`model.test.ts`](../packages/engine/src/model.test.ts) narrowed to resolution only;
    [`scripts/engine-smoke.mjs`](../scripts/engine-smoke.mjs) loads the template and gains the
    "Chartwise" fixture (multi-tenant + AI + regulated + self-hosted + Postgres).

**No change needed:** the ZIP route (streams whatever the artifact holds), the interview UI, and the
`ProjectModel` contract.

---

## Data model
**No schema changes.** Engine/template/output work only. No migrations, no new tables, no RLS changes on
Airrow's own data. Stored artifacts from previous runs keep their existing shape — regeneration produces
the new file set.

---

## Acceptance criteria
- [x] The downloaded ZIP is produced from `template/**` via `renderScaffold` — no file originates from
      `packages/engine/src/documents/*`, and that directory is gone.
- [x] No ADR artifacts or references anywhere in the generated output (`adr/`, `ADR_TEMPLATE.md`, prose
      mentions).
- [x] The ZIP contains no old-template or generic filler — every document interpolates the real answers;
      no `{{TOKEN}}` survives.
- [x] Each of `vision`, `tenancy`, `authModel`, `roles`, `capabilities`, `aiUsage`, `integrations`,
      `dataSensitivity`, `hosting`, `scale` visibly changes at least one generated file, proven by a test.
- [x] `vision` is clearly present in `VISION.md`, `CLAUDE.md`, `README.md`, and `SYSTEM_OVERVIEW.md`.
- [x] The chosen stack (framework, hosting, repo provider, database/Supabase) is stated consistently in
      every document — no contradictions.
- [x] The generated next-steps document (`START_HERE.md`) gives concrete, ordered steps for the selected
      stack: setup → first spec → implement loop.
- [x] Optional answers left blank render `[NEEDS CLARIFICATION: …]`, never invented content.
- [x] Nothing is referenced that wasn't selected (no brief or section for an unchosen capability or
      integration).
- [x] `pnpm engine:smoke` passes, including a multi-tenant + AI + non-Vercel fixture whose output is
      spot-checked.
- [x] The spec template is readable by a human skimming it — plain-language summary, status table, and
      "what goes here" hints — in both Airrow's own `.claude/spec-kit/spec-template.md` and the copy
      founders download in `template/`, and the two stay identical apart from `{{PROJECT_NAME}}`.
- [x] Typecheck passes; lint adds no new issues; tests green (note known pre-existing failures).

### Verification
- **Reworked tests** — [`packages/engine/src/scaffold.test.ts`](../packages/engine/src/scaffold.test.ts)
  (27 tests): the invariant skeleton; no unresolved token in any file; **one test per interview answer**
  (`vision`, `mvpFocus`, `tenancy`, `authModel`, `roles`, `capabilities`, `aiUsage`, `integrations`,
  `dataSensitivity`, `scale`, `hosting`, `database`, `repoProvider`); "carries no Architecture Decision
  Record leftovers"; "never contradicts itself across documents"; "gives ordered next steps from setup
  to the implement loop"; and four never-invent tests (blank `VISION`/`CORE_ENTITIES` flagged, missing
  payment provider flagged, no capabilities stated plainly).
- **Resolution** — [`model.test.ts`](../packages/engine/src/model.test.ts) (6 tests) narrowed to the
  projection logic, plus a regression for "never guesses the kind of AI when the founder skipped it".
- **Smoke** — `pnpm engine:smoke` → **SMOKE PASSED**, 4 fixtures × 21 files, including the new
  *Chartwise* fixture (multi-tenant + AI agents + regulated data + self-hosted + Postgres). It asserts
  no ADR text, no "Vercel" for a non-Vercel host, no "Supabase" for a non-Supabase project, and exactly
  one capability brief per selected capability.
- **Manual spot-check** — rendered the Chartwise fixture and read `START_HERE.md` and `docs/VISION.md`
  end to end: setup steps name PostgreSQL (not Supabase), the deploy step names the self-hosted target,
  the first-spec hint quotes the MVP focus, and the v1 scope lists exactly the six selected capabilities.
- **Production build** — `pnpm build` succeeds with the file-tracing config, so the template ships with
  a deployed app rather than only working in dev.
- **Preview edit + change answers — driven against the running app** (`pnpm dev`, real session cookie,
  the user's `testset` project): the preview header renders "Change answers"; the interview route now
  returns 200 for a `ready` project (it used to redirect away) and shows the regenerate copy;
  `updateArtifactFile` persisted an edit (manifest bytes 1165 → 1191, `source` → `authored`) and
  rejected a path the engine never produced; the edited text then appeared both on the re-fetched
  preview page and inside the downloaded ZIP (21 files). Test data restored afterwards.
- **Package manager & AI opt-out** — `scaffold.test.ts` "uses the package manager the chosen framework
  actually ships with" (Vite output contains no `pnpm` at all; CI uses `npm ci`, deploy uses `npx`) and
  "drops AI entirely when the founder answers \"no AI after all\""; `model.test.ts` "drops the AI
  capability when the founder answers \"no AI after all\"". Manually spot-checked a Vite + no-AI render.
- **Results:** `pnpm -r typecheck` clean · `pnpm -r lint` clean · `pnpm -r test` → engine **36/36**,
  schemas no test files, web 2 skipped. **Pre-existing:** the web RLS tests
  (`organizations.rls.test.ts`, from spec #9) skip without a local Supabase, and its `pg` devDependency
  was missing from the working copy until `pnpm install` was re-run — neither is caused by this change.

---

## Implementation notes
- **Output shrank from ~30 authored files to 21 template files.** Dropped with the authored set:
  `context/*`, `prompts/PROMPT_LIBRARY.md`, `templates/*`, `docs/ROADMAP.md`,
  `docs/architecture/{ARCHITECTURE,TECH_STACK,DATABASE}.md`, `docs/standards/*`, `WORKFLOW.md`,
  `CHECKLIST.md`, `specs/mvp/*.md`, and the whole `adr/` tree. Their surviving signal moved into
  `START_HERE.md`, `docs/VISION.md`, the expanded `SYSTEM_OVERVIEW.md`, and the `CAPABILITY_SPECS`
  briefs in `specs/README.md` — chosen deliberately over reintroducing files ("keep it minimal").
- **Deviations from the spec as written, both deliberate:**
  1. **`ProjectModel` gained `dataSensitivity`** even though the spec said the model shape stays
     untouched. Without it the model only carried the coarse `security: standard | elevated`
     projection, so `pii` and `regulated` were indistinguishable and the "`dataSensitivity` visibly
     changes output" criterion could not be met honestly. `security` is retained as its projection, so
     nothing else changed.
  2. **`resolveProjectModel` no longer defaults a blank `aiUsage` to `llm_calls`.** That default
     invented an answer, contradicting both this spec's and #6's edge-case rule ("AI section flagged,
     not guessed"). It now resolves to `"none"` and the AI brief renders a `[NEEDS CLARIFICATION]`
     marker. `aiUsage` is a required question when AI is selected, so a complete interview is unaffected.
- **`validate()`'s `{{` check was too broad.** The template ships GitHub Actions workflows containing
  `${{ secrets.* }}`, which is not an unresolved token. Narrowed to a shared `hasUnresolvedToken()`
  exported from `scaffold.ts` so the renderer and the validator agree on one definition.
- **`template/docs/architecture/BRANCHING.md` was still in Swedish** — the English translation landed in
  the main repo (commit f7843c0) but never in the template, so every generated foundation shipped a
  Swedish document. Translated, and made repo-provider-aware (it hardcoded "GitHub"). Not in the
  original plan; fixed here because it is exactly the "old-template leftover" the issue targets.
- **Package manager follows the framework (user report).** Every generated command was hardcoded to
  pnpm, so a Vite + React project was told to install pnpm and run `pnpm dev` — a contradiction with
  the npm-based `npm create vite@latest` toolchain it actually ships with. `packageManager(model)` now
  returns `npm` for Vite and `pnpm` for Next.js, and it drives all five `CMD_*` tokens, `SETUP_STEPS`,
  the CI workflow (`cache:`, `npm ci` vs `pnpm install --frozen-lockfile`, no `pnpm/action-setup` for
  npm), and the Vercel deploy step (`npx` vs `pnpm dlx`). Regression test asserts a Vite project
  contains the string "pnpm" nowhere in its output.
- **"No AI after all" option (user request).** The `aiUsage` question is required and only appears once
  AI is ticked, so a founder who selected it by mistake was trapped in four AI architectures. Added a
  `none` option; `resolveProjectModel` then drops `ai` from the capability list entirely, so no AI
  brief, convention, or clarification marker is generated. `InterviewAnswers.aiUsage` widened to
  `AiUsage | "none"` with the Zod enum updated to match.
- **Deploy workflow no longer claims Vercel for non-Vercel hosts** — `deploySteps` emits a named,
  loudly-warning placeholder for Azure / self-hosted instead of Vercel CLI commands. The #6 caveat
  approach was still a contradiction inside the generated YAML itself.
- **Preview editing + returning to the answers (scope added mid-implementation).** I flagged that this
  is preview-UI and mutation work rather than "the foundation reflects the answers", and belongs in its
  own issue per §IV; the user reaffirmed ("bygg ba nu"), so it ships here. **Deliberately not built:**
  merge semantics between hand edits and a regeneration. Regeneration creates a new job and therefore a
  new artifact, so edits simply belong to the artifact they were made on — the review screen states
  this in plain language rather than silently discarding work. A per-file "keep my edit" merge remains
  a follow-up.
- **Spec-template readability (done ahead of `/implement`, user request).** Both templates were rewritten
  to the same structure: `# Spec NNN — <title>` with an "In one sentence" callout, a metadata table
  replacing the bold-key list, a "Short on time?" pointer at *User story* + *Acceptance criteria*, an
  italic purpose line under every heading, and **Acceptance criteria / Verification moved above
  Exact changes** so a reader meets the outcomes before the file-level plan. Heading names were kept
  byte-identical because `.claude/commands/{createspec,implement,analyze}.md` and
  `.claude/spec-kit/constitution.md` reference them in prose — renaming them would have broken the
  workflow contract for no readability gain. `{{PROJECT_NAME}}` in the downloaded copy is untouched.

---

## Edge cases
- `capabilities` empty → no capability spec files, no dangling references, onboarding still complete.
- `authModel = public` (no accounts) → no auth spec, no sign-in steps in the next-steps document.
- `tenancy = single_user` → per-user scoping everywhere; no `organization_id` language leaks in.
- `integrations` blank while `capabilities ∋ integrations` → `[NEEDS CLARIFICATION: …]`, not invented
  vendors.
- `capabilities ∋ ai` with `aiUsage` blank → AI section flagged, not guessed.
- Non-Supabase database → setup steps must not tell the founder to create a Supabase project.
- Non-Vercel hosting → deploy steps name the chosen host (or carry the explicit "defaults to Vercel —
  adjust" caveat established in #6).
- A previously generated artifact (old file set) is re-downloaded → still streams; only new runs produce
  the template output.

---

## Out of scope
- Changing the interview question set or `ProjectModel` shape (settled in
  [6-fix-interview-template.md](6-fix-interview-template.md)).
- The founder-approval preview UI for `ScaffoldPlan` — still tracked by
  [1-interview-generator.md](1-interview-generator.md); this spec only repoints the generation source.
- Application implementation code in generated output — Airrow generates foundations only
  (constitution §0).
- Non-Supabase Auth/Storage/Realtime deep generation and a Microsoft/.NET stack profile — follow-ups
  from #6.
- Any DB migration or RLS change on Airrow's own tables.
