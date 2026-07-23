# Arrow — Engineering Constitution

Non-negotiable engineering rules for building Arrow. Amendments require an ADR.

## Methodology

1. **Specification Driven Development.** No feature is implemented before its spec exists in `/specs`. The spec is the source of truth; code review reviews code *against the spec*.
2. **Workflow per feature:** read context → write/refine spec → implement → test → review against spec → update docs and context → merge. Never skip a step; never work on two features at once.
3. **Highest-priority unfinished work first.** Milestones and the backlog define priority. No random feature jumps.
4. **After every milestone: self-review.** Architecture, folder structure, docs, specs, code quality, prompt library, tech debt. Findings become backlog items or refactors.

## Stack (fixed for v1, changes require ADR)

- Next.js (App Router) + TypeScript strict + Tailwind + shadcn/ui
- Supabase: PostgreSQL, Auth, Storage, Edge Functions, Realtime
- Vercel deployment; GitHub repository; Claude Code as primary AI assistant

## Code

5. **TypeScript strict mode, no `any`.** Types are documentation. Shared types live in one place and are imported, never duplicated.
6. **Modular by feature.** Code is organized by feature/domain, not by technical layer. A feature's UI, logic, and types live together.
7. **Simple over clever.** Choose boring technology and obvious code. Abstractions must be earned by at least two concrete uses.
8. **Server-first.** Server Components and Server Actions by default; client components only where interactivity requires them.
9. **All data access goes through a typed data layer.** No raw Supabase calls scattered through components. Row Level Security on every table, always.

## Quality

10. **Tested per the testing standards.** Business logic and the generation engine have unit tests; critical flows have integration tests. Untested generation logic cannot merge.
11. **Security is a requirement, not a feature.** Every spec has a Security section. Secrets never in code. Input validation at every boundary (Zod).
12. **Documentation is part of Definition of Done.** A feature that works but isn't documented and reflected in the AI context files is not done.

## Process

13. **Trunk-based with short-lived feature branches.** `main` is always deployable. Conventional Commits. PRs follow the PR template and reference their spec.
14. **Decisions are recorded.** Any significant technical decision gets an ADR in `/adr` — before or with the implementing PR, never after the fact from memory.
15. **AI context stays synchronized.** `CLAUDE.md` and `/context` are updated in the same PR as the change they describe. Stale context is treated as a broken build.
