# Spec: Interview-driven project generator

**GitHub issue:** #1 — "Interview-driven project generator"
**Branch:** `1-interview-generator` (from `feature/interview-generator`)
**Feature:** Generation
**Depends on:** the canonical template in `template/` and the resolved `ProjectModel` (`packages/schemas`).
**Status:** ✅ Done

<!-- Status legend: ⏳ Not started · 🔄 In progress · ✅ Done -->

---

## User story
As a **startup founder** I want to **answer a short interview and get a tailored, spec-driven project
scaffold** so that **I start with a strict, AI-ready foundation without hand-building any of it — and
I stay in control of what gets written.**

---

## Background
- The generation engine (`packages/engine`) already produces a repo tree, but it emits the *old*
  workflow structure (`START_HERE.md`, `context/PROGRESS.md`, `templates/SPEC_TEMPLATE.md`,
  standards, `specs/mvp/*`) — the very structure this repo just retired
  ([packages/engine/src/index.ts:35](packages/engine/src/index.ts#L35)).
- The **new** invariant skeleton (spec-kit constitution, spec template, 6 commands, branch model, CI,
  minimal docs/specs/.claude) now lives as a canonical, versioned template in [`template/`](template/),
  with an `.airrow-template.json` catalog of fixed-workflow vs. tailored paths and the token set.
- The interview answers already resolve into a validated `ProjectModel`
  ([packages/schemas/src/types.ts:51](packages/schemas/src/types.ts#L51),
  [packages/engine/src/model.ts:33](packages/engine/src/model.ts#L33)).

## Design decision
Split responsibility along the purity boundary: **`template/`** is the human-authored source of
record for the invariant skeleton; a **pure** `renderScaffold(templateFiles, model)` in the engine
derives the interview-variable values, substitutes `{{TOKENS}}`, and returns the files **plus a
`ScaffoldPlan`** for founder approval. File I/O (reading `template/`, writing the output, provisioning
a repo) stays in the app layer. This deliberately does **not** replace the existing `generate()` v1
pipeline yet — that migration is a follow-up issue so v1 delivery keeps working.

## Exact changes (file:line)
1. **`template/**`** — canonical invariant skeleton with `{{TOKENS}}`; `.airrow-template.json`
   catalogs fixed-workflow vs. tailored paths and documents every token.
2. **`packages/engine/src/scaffold.ts`** — pure `renderScaffold` + `deriveScaffoldValues`
   (interview→mapping); unknown tokens become `[NEEDS CLARIFICATION: …]` and are collected into the
   plan (never guessed).
3. **`packages/engine/src/index.ts`** — export `renderScaffold`, `deriveScaffoldValues`, and types.
4. **`packages/engine/src/scaffold.test.ts`** — Vitest coverage (below).
5. **`packages/engine/tsconfig.json`** — exclude `*.test.ts` from `tsc` (Vitest type-strips + runs).
   No change needed to `generate()` — v1 stays intact.

## Data model
**No schema changes.** Consumes the existing `ProjectModel`; emits `GeneratedFile[]` + a new
`ScaffoldPlan` value object (engine-local). When app-side provisioning lands, it must follow the
constitution's data invariants (access control on new resources, idempotent migrations).

## Interview → generation mapping
| Interview section | Fills |
|---|---|
| Product & domain | `PROJECT_NAME/TAGLINE/DESCRIPTION`, `DOMAIN_OVERVIEW` → README, SYSTEM_OVERVIEW |
| Roles & access | `ROLES`, data invariants (RLS vs. per-user) → constitution II |
| Tech stack | `CMD_*`, `STACK_SUMMARY`, `CI_SETUP_STEPS`, `DEPLOY_*` → CLAUDE.md, constitution VI, ci/deploy workflows |
| Core entities | `CORE_ENTITIES` → SYSTEM_OVERVIEW (flagged `[NEEDS CLARIFICATION]` until captured) |
| Design | `DESIGN_INVARIANTS` → constitution III |
| Team & workflow | branch model / DEV envs (invariant) |
| Initial features | seed `specs/NNN-kort.md` (follow-up) |

## Acceptance criteria
- [x] The invariant skeleton (6 commands, constitution, spec template, BRANCHING, branch-policy,
      close-issue-on-merge, ci) is emitted for **every** model.
- [x] Tailored slots are filled from the model; no `{{TOKEN}}` survives in output.
- [x] Process (IV) and Testing (V) invariants are reproduced verbatim — never weakened.
- [x] Values the interview can't supply surface as `[NEEDS CLARIFICATION]` in both the file and the
      plan; nothing is silently guessed.
- [x] `renderScaffold` returns a `ScaffoldPlan` (tree + decisions + clarifications) for founder
      approval before any write.
- [x] Multi-tenant vs. single-tenant models produce different data invariants.
- [x] Typecheck passes; lint adds no new issues; tests green.
- [ ] App wiring: read `template/`, show the preview, require explicit approval, then write/provision.
      *Reading `template/` landed in [10-foundation-reflects-answers.md](10-foundation-reflects-answers.md)
      (`apps/web/src/lib/template/load.ts` → the generation runner); the preview + explicit-approval
      gate is still a follow-up issue.*
- [x] Seed specs generated per selected initial feature — as one brief per selected capability in the
      generated `specs/README.md` ([10-foundation-reflects-answers.md](10-foundation-reflects-answers.md)).

### Verification
- **New tests** — `packages/engine/src/scaffold.test.ts`: invariant skeleton always present; no
  unresolved tokens; Process/Testing verbatim; `CORE_ENTITIES` flagged as clarification;
  plan shape for approval; no duplicate/empty files; single-tenant vs. multi-tenant divergence.
- Full suite: `pnpm -r typecheck` ✓, `pnpm -r lint` ✓, `pnpm -r test` ✓ (engine 8/8; smoke ✓).

## Edge cases
- Missing `mvpFocus` → tagline left unset with a recorded default decision (not invented).
- Unknown token in a template file → `[NEEDS CLARIFICATION]` marker + surfaced in the plan.
- Single-tenant product → per-user data scoping instead of `organization_id`/RLS.

## Out of scope
- Replacing the v1 `generate()` output with the new skeleton (separate migration issue — keeps v1
  ZIP/delivery working).
- The web interview UI, preview screen, approval gate, and repo provisioning (follow-up issue).
- Capturing core entities / initial features in the interview schema (follow-up).

## Implementation notes
Pure `renderScaffold` keeps the engine env-free; the founder-in-control gate is a returned
`ScaffoldPlan` the app must present and get approval on before writing — enforced app-side.
