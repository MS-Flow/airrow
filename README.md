# Arrow

**Arrow generates the perfect engineering foundation for new software startups.**

An adaptive CTO interview → a complete, production-grade repository foundation: architecture, specifications, documentation, roadmap, standards, prompt library, and AI context system. Founders then build locally with VS Code + Claude Code. Arrow prepares projects for AI-assisted development — it never builds the apps themselves.

This repository is Arrow itself, built with Arrow's own Specification Driven Development methodology. It is the reference implementation of what Arrow generates.

## Start here

New to the repo (human or AI): read **[START_HERE.md](START_HERE.md)**. AI assistants: **[CLAUDE.md](CLAUDE.md)**.

## Repository map

| Path | Contents |
|------|----------|
| `context/` | AI context system — current state, constraints, decision summaries |
| `specs/` | Feature specifications (the source of truth) |
| `docs/` | Vision, constitutions, roadmap, architecture, standards |
| `roadmap/` | Milestones and prioritized backlog |
| `adr/` | Architecture decision records |
| `templates/` | Spec, ADR, PR, bug, feature templates |
| `prompts/` | Prompt library for AI-assisted development |
| `checklists/` | Feature and release checklists |

## Status

**M0 — Engineering Foundation** complete: full pre-implementation foundation, no application code yet. Next: M1, the headless generation engine. See `context/PROGRESS.md`.

## Stack (decided, see `adr/`)

Next.js App Router · TypeScript · Tailwind · shadcn/ui · Supabase · Vercel · GitHub · Claude Code · pnpm/Turborepo monorepo with a pure headless generation engine.
