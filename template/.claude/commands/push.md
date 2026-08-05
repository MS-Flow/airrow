---
description: Commit any pending changes and push the current branch (never main/develop, never force).
argument-hint: [commit message — asked for if there are changes and none is given]
allowed-tools: Bash, Read, Grep, Glob
---

Commit and push the current branch. Commit message (if needed): **$ARGUMENTS**.

1. **Branch guard.** {{PUSH_BRANCH_GUARD}}
2. **Pending changes?** Run `git status --short`.
   - If there are uncommitted changes and `$ARGUMENTS` is empty, reply with only this line and stop:
     > Vad ska commit-meddelandet vara? (skriv "y" så genererar jag ett kortfattat meddelande)
   - If there are uncommitted changes, determine the message:
     - `$ARGUMENTS` is `y`/`Y` → generate a concise one-line message from the diff, imperative mood.
     - otherwise → use `$ARGUMENTS` verbatim.
     Then stage everything **except** `.claude/settings.local.json` and commit with that message plus
     the trailer `Co-Authored-By: Claude <noreply@anthropic.com>`.
   - If nothing to commit: skip to push.
3. **Push.** `git push` — add `-u origin <branch>` if no upstream yet. **Never** force-push, never
   skip hooks.
4. **Report** branch, commit (if any), and push result. {{PUSH_REPORT_LINE}}

Do not open a PR — use `/pr-check` then the PR command.
