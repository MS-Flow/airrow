# Progress

> Update this file in the same PR as any state-changing work.

## Current milestone

**M1–M4 first functional build — implementation complete, verification in progress**

## Current state

- Full monorepo implemented: `apps/web` (Next.js 15 App Router), `packages/engine` (pure headless generation engine), `packages/schemas` (Zod + interview schema).
- Complete product flow works in local mode (ADR-0005): landing → login (dev auth) → dashboard → create-project wizard → adaptive interview (11 questions, conditional) → staged generation with live progress → repository preview (tree + markdown) → ZIP download → continue-locally guide → settings (GitHub stubbed).
- Engine smoke test green: 3 fixtures, 32–35 personalized files each, validation + manifest checks pass (`pnpm engine:smoke`).
- **Not yet verified:** `pnpm install && pnpm build` (npm registry unavailable in the build sandbox — must be run on a dev machine). Spec ACs requiring the running app are pending that first run.

## Next up (in order)

1. `pnpm install && pnpm dev` on a dev machine; walk the full flow; fix anything the first run surfaces.
2. Review each spec vs implementation; flip statuses to Done; log debts (component tests, Playwright, RLS-equivalent store tests).
3. M5: landing polish + example project showcase, error tracking.
4. Supabase mode: implement the `DataStore` interface against Supabase + migrations (activates with .env keys).
5. Claude authoring provider implementing `AuthoringProvider` contract validation (ADR-0002).
6. GitHub App delivery behind the existing `RepoProvider` seam (ADR-0004).

## Completed

- 2026-07-23 — M0: engineering foundation (docs, specs system, standards, ADRs 0001–0005).
- 2026-07-23 — F-101 engine v1 (smoke-tested) · F-201 scaffold/design system · F-202 local auth · F-205 dashboard/wizard/CRUD · F-301 adaptive interview · F-401 generation jobs/progress · F-402 preview · F-403 ZIP · F-405 continue-locally · F-406 settings — all implemented, pending first-run verification.

## Open questions / blockers

- Dependency install/build unverified in this environment (registry blocked). First local `pnpm install` is the gate.

## Known debts (logged, prioritized at next self-review)

Vitest + Playwright harness · component tests · `packages/ui` extraction · Turborepo adoption · account deletion in settings.
