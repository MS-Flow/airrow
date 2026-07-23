# Arrow — Roadmap

Sequenced by dependency and value. Detail per milestone lives in `roadmap/MILESTONES.md`; feature detail in `roadmap/BACKLOG.md`.

## Phase 1 — Foundation & Core Engine

**M0 — Engineering Foundation** *(current)*
Arrow's own vision, constitutions, architecture, specs system, standards, AI context, prompt library. This document set.

**M1 — Generation Engine (headless)**
The heart of Arrow, built and tested before any UI: interview schema → project model → hybrid generation (deterministic structure + Claude-authored content) → complete repository foundation as a file tree. CLI-invokable, snapshot-tested.

**M2 — App Skeleton & Auth**
Next.js app, Supabase auth, dark-first design system, dashboard shell, project CRUD.

## Phase 2 — MVP Product

**M3 — Adaptive Interview**
The CTO interview UI: adaptive question flow driven by the interview schema, answer persistence, resume, review-and-edit.

**M4 — Generation, Preview & Delivery**
Interview → generation job → in-app repo preview (file tree + rendered markdown) → ZIP download → one-click GitHub repo creation and push → "Continue Locally" handoff guide.

**M5 — Landing & Launch**
Landing page, onboarding polish, example generated project, analytics, error tracking. Public launch.

## Phase 3 — Growth

**M6 — Templates & Prompt Library surfaces** — browsable templates, in-app prompt library, regeneration of individual documents.
**M7 — Organizations & Billing** — teams, roles, Stripe subscriptions, plan limits.
**M8 — Azure DevOps integration.**

## Phase 4 — The Living Foundation (direction, not commitments)

Repository synchronization; repository-aware AI chat; automatic spec/doc updates; AI architecture and code review; sprint planning; knowledge graph; marketplace and plugins; enterprise.

## Architectural pre-commitments for Phase 4

Decisions we make *today* so Phase 4 is possible without rewrites:

- Generation engine is a pure, headless module (`packages/engine`) with no app dependencies — reusable by future agents.
- Every generated file records its template, inputs, and version in the database — enabling diffing, regeneration, and sync later.
- Projects belong to organizations from day one (a personal org is auto-created), so teams and billing bolt on without a data migration.
- GitHub integration is a provider interface, not hard-coded — Azure DevOps implements the same interface later.
- All generation runs as async jobs with stored artifacts — the same job infrastructure later serves sync and review agents.
