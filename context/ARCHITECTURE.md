# Architecture Context (condensed)

Monorepo (pnpm + Turborepo):

- `apps/web` — Next.js App Router. Marketing + dashboard + interview + preview. Server Actions for mutations.
- `packages/engine` — **the core asset.** Pure headless TS: `generate(projectModel) → RepoTree + Manifest`. Stages: resolve (blueprint) → author (Claude, contract-validated) → assemble → validate → manifest. No app imports, no direct env access. Testable offline via mock authoring provider + golden snapshots.
- `packages/schemas` — shared Zod schemas (project model, interview schema, document contracts). Types via `z.infer`.
- `packages/ui` — shadcn/ui-based design system, dark-first tokens.

**Data:** Supabase Postgres. Chain: organization → project → interview → project_model (immutable versions) → generation_job → artifact (+ artifact_files manifest) → delivery. RLS on everything via `is_org_member()`. Personal org auto-created per user.

**Jobs:** generation runs async; progress streamed via Supabase Realtime; artifacts in Supabase Storage.

**Delivery:** ZIP (always available) + GitHub App push via `RepoProvider` interface (Azure DevOps later).

**Key invariants:** engine purity; per-file provenance in manifest (enables future regeneration/sync); LLM output never accepted without contract validation; ZIP never depends on integrations.

Full detail: `docs/architecture/` · decisions: `adr/`.
