# CLAUDE.md

This file provides guidance to Claude Code when working with code in the {{PROJECT_NAME}} repository.

## Starting a chat here

**New to this project? Type one of these. That is the whole first session.**

| Step | You type                                | What happens                                                        |
| ---- | --------------------------------------- | ------------------------------------------------------------------- |
| 1    | `{{FIRST_COMMAND}}`                     | {{FIRST_COMMAND_EFFECT}}                                            |
| 2    | "read START_HERE.md and walk me through it" | The accounts only you can create — one at a time, in order       |
| 3    | `/createspec "<the thing you want>"`    | Scaffolds the spec and the branch, and asks what it does not know   |
| 4    | `/clarify`                              | Answers the open questions in that spec, one at a time              |
| 5    | `/implement`                            | Builds it, tests it, and runs the verification bar                  |
| 6    | `/analyze` → `/push` → `/pr-check`      | Checks the work against the spec, commits, opens the pull request   |

Steps 3–6 are the loop, repeated once per change, forever. Nothing else needs remembering.

**Assistant:** if someone opens a session with no spec and no command — "can you add X?", "why is this
broken?" — answer the question, and if the answer means changing code, say so and offer
`/createspec` rather than starting. `{{FIRST_COMMAND}}` only applies while
`{{FIRST_COMMAND_PATH}}` still exists; when it does not, this project is past that step and step 3 is
where a founder starts.

## After a command finishes

{{AFTER_EACH_COMMAND}}

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
