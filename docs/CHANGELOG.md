# Changelog

## First functional build (M1–M4 scope) · 2026-07-23

- `packages/engine`: pure headless generation engine — model resolution, 30+ personalized documents (incl. per-feature specs), validation, manifest with provenance. Smoke-tested on 3 fixtures.
- `packages/schemas`: Zod boundary validation + declarative 11-question adaptive interview schema (single source for UI and engine).
- `apps/web`: Next.js 15 App Router, dark-first design system, landing, local dev auth (ADR-0005), dashboard, create-project wizard, adaptive interview with persistence/resume/review, staged generation with live progress, repository preview (tree + sanitized markdown), ZIP delivery, continue-locally guide, settings with GitHub connection stub.
- ADR-0005: local-mode data layer + deterministic authoring behind interfaces; Supabase/Claude/GitHub activate via env.
- Specs F-101, F-201, F-202, F-205, F-301, F-401, F-402, F-403, F-405, F-406 written and implemented (status: In Review pending first local run).

## M0 — Engineering Foundation · 2026-07-23

- Complete pre-implementation foundation authored: vision, product & engineering constitutions, roadmap, milestones, backlog.
- Architecture defined: system, database, UI, information architecture. Monorepo + headless engine design.
- Specification system, five document templates, five standards documents, feature & release checklists.
- ADRs 0001–0004: Next.js App Router; hybrid generation engine; Supabase + monorepo; ZIP + GitHub delivery.
- AI context system (`CLAUDE.md`, `context/`) and prompt library established.
