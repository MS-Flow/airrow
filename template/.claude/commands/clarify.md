---
description: Resolve ambiguities in the active spec by asking targeted questions, then fold answers in.
argument-hint: [spec file — defaults to the spec matching the current branch]
allowed-tools: Read, Edit, Grep, Glob, Bash, AskUserQuestion
---

**If `$ARGUMENTS` is empty, reply with only this line and stop — do nothing else:**
> Vad vill du ha förtydligat?

Clarify the spec matching the current git branch, focusing on: **$ARGUMENTS**.

1. Read the spec and scan for `[NEEDS CLARIFICATION: …]` markers plus underspecified areas (vague
   acceptance criteria, undefined data shapes, unstated edge cases, missing scope boundaries).
2. Ask the user **at most 5** targeted questions via `AskUserQuestion` — highest-impact ambiguities
   first. Offer concrete options with a recommended default where you have one.
3. Fold each answer into the correct section and **remove the resolved marker**. Do not invent
   answers; if the user skips a question, leave its marker.
4. Report how many markers were resolved and how many remain. When none remain, suggest `/implement`.

Respect @.claude/spec-kit/constitution.md — if an answer would violate an invariant, flag it rather
than recording it silently.
