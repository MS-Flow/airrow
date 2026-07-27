# CLAUDE.md

This file provides guidance to Claude Code when working with code in the {{PROJECT_NAME}} repository.

## What we're building
{{DOMAIN_OVERVIEW}}

**Where this goes:** {{VISION}}

**The MVP must, above all else:** {{MVP_FOCUS}}

Build toward that, not just toward the current ticket. Full picture: `docs/VISION.md`.

## Not our problem
These are deliberate exclusions, not gaps waiting to be filled. Don't build them, don't scaffold for
them, and don't suggest them unless asked directly.

{{NON_GOALS}}

## Communication style
Be concise but clear. Short responses save tokens — avoid restating what was asked, keep summaries
at the bare minimum, and omit filler. One clear sentence beats a paragraph.

## Clean code
Always write clean code. Avoid duplication — if the same expression appears twice, restructure to
eliminate it. Prefer clarity over cleverness: a reader should understand intent from the code itself.

## Read first (in order)
1. **`.claude/spec-kit/constitution.md`** — the single source of truth for all rules. When any file
   disagrees with it, the constitution wins.
2. The spec for your issue in `/specs` (`specs/NNN-kort.md`).
3. `docs/VISION.md` — what this becomes if it wins.
4. `docs/architecture/SYSTEM_OVERVIEW.md` and `docs/guides/DEVELOPER_GUIDE.md`.

## Before implementing anything
1. Read the relevant spec file in `/specs` before writing code.
2. If no spec exists for the task, say so and ask before proceeding — or run `/createspec`.

The spec lifecycle is automated via slash commands (`/createspec → /clarify → /implement → /analyze`,
plus `/pr-check` before a PR) governed by `.claude/spec-kit/constitution.md`. See `specs/README.md`.

## After implementing anything
Update the corresponding spec in `/specs` — check off acceptance criteria, note any deviations.

## Branching & workflow
We work via {{REPO_PROVIDER}}: a **feature** is a {{BOARD_TERM}}, **{{ISSUE_TERM}}s** are linked to it. Branch hierarchy:
`main` ← `develop` ← `feature/<name>` ← `<nr>-kort` (issue branch, no `issue/` prefix). PR direction
is strict and never skipped: `<nr>-kort` → its `feature/<name>` → `develop` → `main`. **Never** PR an
issue branch to `main`/`develop`. Full detail in `docs/architecture/BRANCHING.md`.

## Commands
{{PROJECT_NAME}} — {{STACK_SUMMARY}}. Run from the repo root:
- `{{CMD_DEV}}`        # start the dev server
- `{{CMD_BUILD}}`      # production build
- `{{CMD_TYPECHECK}}`  # type check
- `{{CMD_LINT}}`       # linter
- `{{CMD_TEST}}`       # run all tests

## Architecture
{{ARCHITECTURE_LAYERS}}

## Key conventions
{{KEY_CONVENTIONS}}
