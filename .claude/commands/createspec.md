---
description: Scaffold a new spec from an issue number or a description, and set up its branch.
argument-hint: <issue-number> | "<feature description>"
allowed-tools: Read, Write, Bash, Grep, Glob, AskUserQuestion
---

**If `$ARGUMENTS` is empty, reply with only this line and stop — do nothing else:**
> Vilken issue ska specen skapas för? (issue-nr eller en kort beskrivning)

Start a new spec for: **$ARGUMENTS**

Follow the Airrow spec-driven workflow. Read the constitution first:
@.claude/spec-kit/constitution.md and the template @.claude/spec-kit/spec-template.md.

Steps:
1. **Resolve the issue.**
   - If `$ARGUMENTS` is a number: try `gh issue view <n> --json number,title,body,labels`. If `gh` is
     missing or errors, ask the user to paste the issue title + body — do not fail.
   - If `$ARGUMENTS` is a description: no issue yet. Use `#TBD` and leave a
     `[NEEDS CLARIFICATION: assign issue #]` marker.
2. **Derive a short name** — 2–4 kebab-case words from the issue title.
3. **Set up the branch.** Determine the parent `feature/<name>` — the GitHub Project the issue is
   linked to. **Always ask which `feature/*` branch the issue branch should be based on** — never
   assume, never default to `main`/`develop`. List available feature branches
   (`git branch -a --list "*feature/*"`) and ask via `AskUserQuestion`.
   - If already on `NNN-<kort>` matching this issue, keep it.
   - Otherwise, for a real issue number, create AND link in one step:
     `git checkout feature/<name> && git pull && gh issue develop <n> --base feature/<name>
     --branch-name NNN-<kort> --checkout` (registers the branch in the issue's Development section so
     it closes automatically on merge — see `.github/workflows/close-issue-on-merge.yml`). If
     `gh issue develop` is unavailable, fall back to `git checkout -b NNN-<kort>` and note it wasn't linked.
   - For a description-based spec (no issue yet): `git checkout -b NNN-<kort>`.
   - Respect the constitution's PR-direction rule; issue branches never target `main`/`develop`.
4. **Scaffold `specs/NNN-<kort>.md`** from the template. Fill the header, User story, and an initial
   Acceptance criteria list. Leave Background/Exact changes for `/implement`. Mark every unknown with
   `[NEEDS CLARIFICATION: …]`.
5. Report the created file path, the branch, and the count of `[NEEDS CLARIFICATION]` markers, then
   suggest running `/clarify`.
