# Airrow

**Airrow turns a founder's interview into a minimal, spec-driven project scaffold — where the founder stays in control.**

A startup founder answers a short, adaptive interview in the Airrow web app. From the answers, Airrow
generates a new repository foundation whose **content is tailored** to their product, stack, and first
features — but whose **structure is strict**: a spec-driven workflow, a single
constitution, the branch/PR model, and CI.

Airrow prepares projects for AI-assisted development — it **never writes the application code itself**.
The founder then builds locally with preferred IDE + agents, following the exact same workflow this
repo uses.

## The promise (what's always generated vs. tailored)

| Invariant (always, regardless of answers)                           | Variable (derived from the interview)                        |
| ------------------------------------------------------------------- | ------------------------------------------------------------ |
| Spec-kit: constitution + spec template + 6 slash commands           | Tech stack → verification commands, CI steps, deploy target  |
| Strict branch/PR model (`main ← develop ← feature ← NNN-kort`)      | Architecture / data / design invariants (constitution I–III) |
| CI structure (ci, branch-policy, close-issue-on-merge, deploy-dev)  | Domain, roles, core entities → README + SYSTEM_OVERVIEW      |
| Minimal, navigable layout (`docs/`, `specs/`, `.claude/`) — no slop | Seed specs for the founder's first features                  |
| Founder-in-control: nothing runs until previewed and approved       | Naming, domain language, design tokens                       |

## This repository

Airrow is built with Airrow's own methodology — it is the reference implementation of what it
generates. The canonical scaffold the product hands to new projects lives in [`template/`](template/).

| Path                                   | Contents                                                                              |
| -------------------------------------- | ------------------------------------------------------------------------------------- |
| [`apps/web`](apps/web)                 | The Airrow application (Next.js 15, App Router)                                       |
| [`packages/engine`](packages/engine)   | Generation engine — pure, headless, dependency-free                                   |
| [`packages/schemas`](packages/schemas) | Shared Zod schemas + interview schema                                                 |
| [`template/`](template/)               | The canonical spec-driven scaffold the app generates for customers                    |
| [`.claude/`](.claude/)                 | The spec constitution, spec template, and workflow slash commands                     |
| [`docs/`](docs/)                       | Living overview, architecture, developer guide — see [docs/README.md](docs/README.md) |
| [`specs/`](specs/)                     | One spec per issue (`NNN-kort.md`) — see [specs/README.md](specs/README.md)           |

## Read first

- **Working here (human or AI):** [CLAUDE.md](CLAUDE.md) → the constitution
  [.claude/spec-kit/constitution.md](.claude/spec-kit/constitution.md) → the spec for your issue.
- **The product & vision:** [docs/VISION.md](docs/VISION.md).
- **Architecture:** [docs/architecture/SYSTEM_OVERVIEW.md](docs/architecture/SYSTEM_OVERVIEW.md).

## Run it

```bash
pnpm install
pnpm dev            # app on http://localhost:3000
pnpm -r typecheck   # strict typecheck
pnpm -r lint        # ESLint
pnpm -r test        # Vitest
pnpm engine:smoke   # generation-engine smoke test (no install needed)
```

Airrow runs fully in **local mode** out of the box: dev auth, file-backed store in
`.data/`, deterministic authoring, ZIP delivery. Supabase / Claude authoring / GitHub push activate
via env — see `apps/web/.env.example`, copied to `apps/web/.env.local` (Next reads env only from the
app directory, never the repo root).

## Workflow

Spec-driven, via slash commands: `/createspec → /clarify → /implement → /analyze`, with `/push` and
`/pr-check` around the PR. Governed by the single [constitution](.claude/spec-kit/constitution.md).
Branch direction is strict — see [docs/architecture/BRANCHING.md](docs/architecture/BRANCHING.md).
