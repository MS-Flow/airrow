# CLAUDE.md — AI Assistant Context for Arrow

You are working on **Arrow**: a SaaS that generates the complete engineering foundation (specs, docs, architecture, standards, AI context) for new software startups. Arrow prepares projects for AI-assisted development; it never builds the apps themselves. Arrow is built using its own methodology — this repo is the reference implementation.

## Read before any work

1. `context/PROGRESS.md` — current state and what to work on next
2. `context/CONSTRAINTS.md` — hard rules you must never break
3. The spec for the feature you're implementing (`specs/`)

## Deeper context (read as needed)

- `context/PROJECT.md` — business, vision, users
- `context/ARCHITECTURE.md` — condensed architecture; full docs in `docs/architecture/`
- `context/DECISIONS.md` — decision summaries; full ADRs in `adr/`
- `docs/standards/` — coding, testing, security, git, documentation standards

## Non-negotiable workflow

1. **No spec, no code.** Every feature starts from a complete spec (`templates/SPEC_TEMPLATE.md`, rules in `specs/README.md`).
2. If implementation must diverge from the spec, **update the spec first**.
3. Follow `checklists/FEATURE_CHECKLIST.md` for every feature, top to bottom.
4. Update `context/PROGRESS.md` (and docs) in the same change as the work itself.
5. Significant technical decisions → new ADR in `adr/`.

## Stack

pnpm/Turborepo monorepo · Next.js App Router + TypeScript strict + Tailwind + shadcn/ui (`apps/web`) · pure headless generation engine (`packages/engine`) · shared Zod schemas (`packages/schemas`) · Supabase (Postgres+RLS, Auth, Storage, Realtime) · Vercel · GitHub.

## Key rules (full list in context/CONSTRAINTS.md)

- No `any`; Zod at every boundary; Server Components by default.
- `packages/engine` never imports app code or reads env directly.
- Every table has RLS + denial tests. Secrets never in code or output.
- Engine LLM output is always validated against document contracts before acceptance.
