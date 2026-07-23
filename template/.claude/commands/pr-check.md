---
description: Pre-PR safety check — fetch, detect merge conflicts and overlapping files against the target branch, then surface the PR command.
argument-hint: [target branch — defaults to this branch's parent per the branch hierarchy]
allowed-tools: Bash, Read, Grep, Glob
---

**If `$ARGUMENTS` is empty, reply with only this line and stop — do nothing else:**
> Vilken målgren ska jag PR-kolla mot? (annars kollar jag mot förälder i grenhierarkin)

Run a merge-safety check before opening a PR for the current branch.

**Target branch** = `$ARGUMENTS` if given, else infer from the hierarchy in
@.claude/spec-kit/constitution.md:
- On an issue branch `NNN-kort` → target its `feature/<name>` (never `develop`/`main`).
- On a `feature/<name>` branch → target `develop`.
- On `develop` → target `main`.
If the parent feature is ambiguous, ask — never default to `main`.

Steps:
1. `git fetch -q origin`.
2. **Divergence** — `git rev-list --count <branch>..origin/<target>` and the reverse.
3. **Conflict check** — `git merge-tree --write-tree origin/<target> <branch>`. Exit 0 = clean;
   non-zero or `CONFLICT` = conflicts. Fall back to a throwaway `git merge --no-commit --no-ff` in a
   temp worktree if `--write-tree` is unsupported.
4. **Overlap** — files changed on both sides since the merge base (`comm -12` of the two
   `git diff --name-only <base>..<...>` lists).
5. **Verdict:**
   - Clean + no overlap → green light; print `gh pr create --base <target> --head <branch>`.
   - Conflicts or overlap → list the files and suggest syncing first (`git merge origin/<target>` or
     `git merge <feature>` for an issue branch), resolve, retry.

Read-only except `git fetch`; do not open the PR or push automatically.
