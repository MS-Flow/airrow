# Constraints — hard rules, never break

## Process

1. No feature implementation without a complete spec in `/specs`. Ever.
2. Spec diverging from reality → fix the spec first, then code.
3. Docs and `context/PROGRESS.md` update in the same PR as the change.
4. Significant decisions require an ADR; never silently contradict an existing ADR.
5. Work the backlog in priority order; one feature at a time.

## Code

6. TypeScript strict; `any` forbidden.
7. Zod validation at every boundary — including all LLM output (document contracts).
8. `packages/engine` and `packages/schemas`: no imports from `apps/*`, no direct env access.
9. Server Components by default; data access only through feature `queries.ts`/`actions.ts`.
10. Every table has RLS with denial tests. No exceptions, including "internal" tables.

## Security

11. Secrets never in code, client bundles, logs, or generated output.
12. Generated/authored files are untrusted text: rendered sanitized, never executed.
13. No user PATs for repo access — GitHub App installations only.

## Product

14. Airrow never generates application implementation code — foundations only.
15. ZIP delivery must always work without any integration connected.
16. Generated output must be project-specific; generic template-feeling output is a release blocker.
