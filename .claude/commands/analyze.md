---
description: Cross-check spec vs. implementation vs. constitution, and if all passes, close the spec out.
argument-hint: [spec file — defaults to the spec matching the current branch]
allowed-tools: Read, Edit, Grep, Glob, Bash
---

**If `$ARGUMENTS` is empty, reply with only this line and stop — do nothing else:**
> Vilken spec ska jag analysera? (issue-nr)

Analyze and close out: **$ARGUMENTS**.

Read @.claude/spec-kit/constitution.md and the spec, then inspect the working tree / diff.

**Part 1 — cross-check (read-only).** Report a short pass/fail per category with `file:line` evidence:
1. **Unmet acceptance criteria** — any checkbox not actually satisfied by the code.
2. **Spec ↔ code drift** — code the spec doesn't describe, or spec items with no code.
3. **Constitution violations** — any architecture/data/design invariant broken.
4. **Verification gaps** — missing tests for a criterion; typecheck/lint/tests not run or not green.
5. **PR direction** — intended target is the spec's `feature/<name>`, **never** `main`/`develop`.

**Part 2 — close out (only if every category passes).** If anything fails, report it and stop.
If all pass:
6. In the spec: tick all remaining criteria, set **Status: ✅ Done**, add/finish an **Implementation
   notes** block (verification result + deviations).
7. Update [`../../specs/README.md`](../../specs/README.md): set this feature's row to ✅ Done.
8. **Surface the PR command** — issue branch → its `feature/<name>`, e.g.
   `gh pr create --base feature/<name> --head NNN-<kort>`. Never propose a PR to `main`/`develop`.
   Do not open the PR or push automatically — hand over the command, suggest `/pr-check` first.
