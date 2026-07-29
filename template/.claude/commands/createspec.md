---
description: Scaffold a new spec from an issue number or a description, and set up its branch.
argument-hint: <issue-number> | "<feature description>"
allowed-tools: Read, Write, Bash, Grep, Glob, AskUserQuestion
---

**If `$ARGUMENTS` is empty, reply with only this line and stop — do nothing else:**
> Vilken issue ska specen skapas för? (issue-nr eller en kort beskrivning)

Start a new spec for: **$ARGUMENTS**

Follow the {{PROJECT_NAME}} spec-driven workflow. Read the constitution first:
@.claude/spec-kit/constitution.md and the template @.claude/spec-kit/spec-template.md.

Steps:
1. **Resolve the {{ISSUE_TERM}}.**
   - If `$ARGUMENTS` is a number: try `{{CLI_ISSUE_VIEW}}`. If {{CLI_NAME}} is missing or errors, ask
     the user to paste the {{ISSUE_TERM}} title + body — do not fail.
   - If `$ARGUMENTS` is a description: no {{ISSUE_TERM}} yet. Use `#TBD` and leave a
     `[NEEDS CLARIFICATION: assign {{ISSUE_TERM}} #]` marker.
2. **Derive a short name** — 2–4 kebab-case words from the {{ISSUE_TERM}} title.
3. **Set up the branch.** Determine the parent `feature/<name>` — the {{BOARD_TERM}} the
   {{ISSUE_TERM}} belongs to. **Always ask which `feature/*` branch the branch should be based on** —
   never assume, never default to `main`/`develop`. List available feature branches
   (`git branch -a --list "*feature/*"`) and ask via `AskUserQuestion`.
   - If already on `NNN-<kort>` matching this {{ISSUE_TERM}}, keep it.
   - Otherwise: `git checkout feature/<name> && git pull`, then create and link the branch with
     `{{CLI_BRANCH_LINK}}`. Linking is what lets the tracker close the {{ISSUE_TERM}} when the branch
     merges. If the link step is unavailable, fall back to `git checkout -b NNN-<kort>` and say it
     was not linked.
   - For a description-based spec (no {{ISSUE_TERM}} yet): `git checkout -b NNN-<kort>`.
   - Respect the constitution's PR-direction rule; issue branches never target `main`/`develop`.
4. **Scaffold `specs/NNN-<kort>.md`** from the template. Fill the header, User story, and an initial
   Acceptance criteria list. Leave Background/Exact changes for `/implement`. Mark every unknown with
   `[NEEDS CLARIFICATION: …]`.
5. Report the created file path, the branch, and the count of `[NEEDS CLARIFICATION]` markers, then
   suggest running `/clarify`.
