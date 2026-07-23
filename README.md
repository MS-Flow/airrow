# Airrow

**Airrow generates the perfect engineering foundation for new software startups.**

An adaptive CTO interview → a complete, production-grade repository foundation: architecture, specifications, documentation, roadmap, standards, prompt library, and AI context system. Founders then build locally with VS Code + Claude Code. Airrow prepares projects for AI-assisted development — it never builds the apps themselves.

This repository is Airrow itself, built with Airrow's own Specification Driven Development methodology. It is the reference implementation of what Airrow generates.

## Start here

New to the repo (human or AI): read **[START_HERE.md](START_HERE.md)**. AI assistants: **[CLAUDE.md](CLAUDE.md)**.

## Repository map

| Path | Contents |
|------|----------|
| `apps/web` | The Airrow application (Next.js 15, App Router) |
| `packages/engine` | Generation engine — pure, headless, dependency-free |
| `packages/schemas` | Shared Zod schemas + interview schema |
| `context/` | AI context system — current state, constraints, decisions |
| `specs/` | Feature specifications (the source of truth) |
| `docs/` | Vision, constitutions, roadmap, architecture, standards |
| `roadmap/` | Milestones and prioritized backlog |
| `adr/` | Architecture decision records |
| `templates/` | Spec, ADR, PR, bug, feature templates |
| `prompts/` | Prompt library for AI-assisted development |
| `checklists/` | Feature and release checklists |

## Run it

```bash
pnpm install
pnpm dev          # app on http://localhost:3000
pnpm engine:smoke # generation engine smoke test (no install needed)
```

Airrow runs fully in **local mode** out of the box (ADR-0005): dev auth, file-backed store in `.data/`, deterministic document authoring, ZIP delivery. Supabase / Claude authoring / GitHub push activate via `.env` — see `.env.example`.

## Status

**M0 foundation complete; first functional build implemented** — full flow works: interview → generation → preview → ZIP → continue-locally. See `context/PROGRESS.md`.

## Stack (decided, see `adr/`)

Next.js 15 App Router · TypeScript strict · Tailwind v4 · Supabase-ready · Vercel · GitHub · Claude Code · pnpm monorepo: `apps/web`, `packages/engine` (pure, headless), `packages/schemas`.
