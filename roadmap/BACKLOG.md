# Feature Backlog

Prioritized queue. P1 = current/next milestone, P2 = MVP, P3 = post-launch, P4 = future. Each feature gets a spec in `/specs/<milestone>/` before implementation. Status: ⬜ not started · 📝 spec written · 🔨 implemented, in review · ✅ done.

## P1 — M1 Generation Engine

| ID | Feature | Status |
|----|---------|--------|
| F-101 | Project model (typed schema + validation) | 🔨 |
| F-102 | Interview schema & condition engine | 🔨 |
| F-103 | Repository blueprint & template resolver | 🔨 |
| F-104 | Content generation pipeline (local deterministic provider per ADR-0005; Claude provider pending) | 🔨 |
| F-105 | Output assembly, completeness validation, manifest | 🔨 |
| F-106 | Engine CLI + fixture interviews + snapshot tests | 🔨 |

## P1 — M2 App Skeleton

| ID | Feature | Status |
|----|---------|--------|
| F-201 | Next.js scaffold, design tokens, dark-first theme | 🔨 |
| F-202 | Auth (local dev auth per ADR-0005; Supabase Auth pending) | 🔨 |
| F-203 | Data layer (local JSON store per ADR-0005; Supabase schema + RLS pending) | 🔨 |
| F-204 | Dashboard shell (nav, layout, command palette stub) | 🔨 |
| F-205 | Project CRUD | 🔨 |
| F-206 | CI/CD pipeline | ⬜ |

## P2 — MVP (M3–M5)

| ID | Feature | Status |
|----|---------|--------|
| F-301 | Interview runtime & question renderer | 🔨 |
| F-302 | Interview persistence & resume | 🔨 |
| F-303 | Answer review & edit | 🔨 |
| F-401 | Async generation jobs with progress | 🔨 |
| F-402 | Repository preview (tree + markdown) | 🔨 |
| F-403 | ZIP download | 🔨 |
| F-404 | GitHub repo creation & push | ⬜ |
| F-405 | Continue Locally handoff screen | 🔨 |
| F-501 | Landing page | 🔨 |
| F-502 | Example generated project showcase | ⬜ |
| F-503 | Analytics & error tracking | ⬜ |

## P3 — Post-launch

Templates gallery · in-app prompt library · single-document regeneration · organizations & team invites · Stripe billing & plans · Azure DevOps provider · project settings & deletion/export.

## P4 — Future (requires new architecture specs)

Repository synchronization · repo-aware AI chat · automatic doc/spec updates · AI architecture review · AI code review · sprint planning · knowledge graph · marketplace/plugins · enterprise (SSO, audit).
