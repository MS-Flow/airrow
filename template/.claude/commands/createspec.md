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
3. **Set up the branch.** {{CREATESPEC_BRANCH_STEP}}
4. **Scaffold `specs/NNN-<kort>.md`** from the template. Fill the header, User story, and an initial
   Acceptance criteria list. Leave Background/Exact changes for `/implement`. Mark every unknown with
   `[NEEDS CLARIFICATION: …]`.
5. Report the created file path, the branch, and the count of `[NEEDS CLARIFICATION]` markers. {{CREATESPEC_REPORT_LINE}} Then suggest running `/clarify`.
