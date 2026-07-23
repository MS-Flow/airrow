# Airrow — Developer Guide

## Setup
Requirements: **Node ≥20** and **pnpm 9** (`corepack enable` or `npm i -g pnpm@9`).

```bash
pnpm install
pnpm dev            # apps/web on http://localhost:3000
pnpm engine:smoke   # headless generation-engine smoke test (no install needed)
```

Airrow runs in **local mode** out of the box: dev auth, file-backed store in `.data/`, deterministic
document authoring, ZIP delivery. Supabase / Claude authoring / GitHub push activate via `.env` — copy
`.env.example` and fill what you need.

## Code organization
```
apps/web/src/
  app/**            App Router routes (Server Components by default)
  features/<area>/  feature slices — components + actions.ts / queries.ts
  components/ui/     shared shadcn/ui-based design system
  lib/               auth, data/store.ts (the DataStore), middleware helpers
packages/engine/src/    pure generation engine (documents/, pipeline)
packages/schemas/src/   Zod schemas & types shared across app + engine
```

## Patterns
- **Server Components by default.** Reach for a client component only for interactivity.
- **Data access only through feature `queries.ts` / `actions.ts`**, which call the DataStore. Never
  hit Supabase / the filesystem directly from a component.
- **Zod at every boundary** — forms, server actions, engine I/O, and all LLM output. `any` is
  forbidden (TypeScript strict).
- **`packages/engine` and `packages/schemas` stay pure** — no imports from `apps/*`, no `process.env`.
- **Design tokens, not literals** — use the Tailwind/design-system tokens; reuse `components/ui`
  before adding a component.
- **Untrusted Markdown** (generated/authored) is rendered sanitized (DOMPurify), never executed.

## Testing (Vitest)
- Co-locate tests with the code: `*.test.ts` / `*.test.tsx`, picked up by Vitest's glob and CI.
- Deterministic only: no reliance on local time/timezone, randomness, or the network. CI pins
  `TZ=UTC`; anchor fake time with `vi.setSystemTime`.
- The engine is testable offline via its mock authoring provider + snapshot fixtures.

```bash
pnpm -r test                      # all packages
pnpm --filter web test <file>     # single file while iterating
```

## Verification bar (run before any PR)
```bash
pnpm -r typecheck   # tsc --noEmit, strict
pnpm -r lint        # ESLint — no new issues
pnpm -r test        # Vitest — green (note known pre-existing failures)
```
> ESLint + Vitest are the agreed tools. If a package still lacks its `lint` / `test` script or dev
> dependency, wire it in the change that first needs it — don't skip the bar.

## Workflow
Spec-driven, via slash commands: `/createspec → /clarify → /implement → /analyze`, with `/push` and
`/pr-check` around the PR. Governed by [`../../.claude/spec-kit/constitution.md`](../../.claude/spec-kit/constitution.md).
Branch + PR direction: see [`../architecture/BRANCHING.md`](../architecture/BRANCHING.md).

## Troubleshooting
- **`pnpm dev` fails to start:** confirm Node ≥20 and `pnpm -v` ≈ 9; re-run `pnpm install`.
- **Type errors after schema edits:** `packages/schemas` is the source of truth — rebuild types with
  `pnpm -r typecheck` to see the real boundary breaks.
- **Engine changes:** run `pnpm engine:smoke` for a fast end-to-end sanity check without the app.
