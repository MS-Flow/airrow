# ADR-0003: Supabase backend; monorepo with headless engine

> Status: Accepted · Date: 2026-07-23

## Context

Airrow needs Postgres, auth, file storage (artifacts), and realtime (generation progress) with a small team and high velocity — and it dogfoods the customer golden path. Separately: where does the generation engine live?

## Decision

- **Supabase** for Postgres + Auth + Storage + Realtime. One platform, RLS-native multi-tenancy, matches the golden path.
- **pnpm/Turborepo monorepo:** `apps/web`, `packages/engine`, `packages/schemas`, `packages/ui`. The engine is a pure, headless package with injected config and zero app or runtime-env dependencies.

## Consequences

RLS is the tenancy backbone and must be tested per table (TESTING_STANDARDS). The headless engine is the pre-commitment that makes Phase 4 (sync agents, CLI, review agents) possible without rewrites, and keeps Airrow portable if the app layer ever changes. Platform lock-in to Supabase accepted knowingly; mitigated by plain Postgres + standard storage semantics.
