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
   - **Assign the issue to the runner.** For a real issue number, run
     `gh issue edit <n> --add-assignee "@me"` (quote `"@me"` — PowerShell treats a bare `@me` as the
     splat operator) so the assignee reflects whoever is working the spec.
     Skip this for description-based (`#TBD`) specs. It is idempotent — re-running when already
     assigned is a no-op. If `gh` is missing/unauthenticated or the edit fails, warn and continue;
     **never** block spec/branch creation on assignment — note it so the runner can assign manually.
2. **Derive a short name** — 2–4 kebab-case words from the issue title.
3. **Set up the branch.** Determine the parent `feature/<name>` — the GitHub Project the issue is
   linked to. **Always ask which `feature/*` branch the issue branch should be based on** — never
   assume, never default to `main`/`develop`. List available feature branches
   (`git branch -a --list "*feature/*"`) and ask via `AskUserQuestion`.
   - If already on `NNN-<kort>` matching this issue, keep it.
   - Otherwise, for a real issue number, create AND link in one step:
     `git checkout feature/<name> && git pull && gh issue develop <n> --base feature/<name>
     --name NNN-<kort> --checkout` (registers the branch in the issue's Development section so
     it closes automatically on merge — see `.github/workflows/close-issue-on-merge.yml`). If
     `gh issue develop` is unavailable, fall back to `git checkout -b NNN-<kort>` and note it wasn't linked.
   - For a description-based spec (no issue yet): `git checkout -b NNN-<kort>`.
   - Respect the constitution's PR-direction rule; issue branches never target `main`/`develop`.
   - **Don't merge `develop` into the new issue branch.** After `git pull` on `feature/<name>`, check
     `git log feature/<name>..origin/develop --oneline`; if non-empty, tell the user the feature branch
     is behind `develop` by that many commits and that they may want a separate `git merge develop`
     into `feature/<name>` first. Merging `develop` straight into an issue branch drags unrelated
     history into its eventual PR to `feature/<name>` — sync at the feature level instead.
4. **Scaffold `specs/NNN-<kort>.md`** from the template. Fill the header, User story, and an initial
   Acceptance criteria list. Leave Background/Exact changes for `/implement`. Mark every unknown with
   `[NEEDS CLARIFICATION: …]`.
5. Report the created file path, the branch, and the count of `[NEEDS CLARIFICATION]` markers. If issue
   assignment was skipped or failed (Step 1), say so and tell the runner to assign manually. Then
   suggest running `/clarify`.
